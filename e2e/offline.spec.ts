import { createServer, type Server } from 'node:http';
import { createGzip } from 'node:zlib';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { type Socket } from 'node:net';
import { type BrowserContext, expect, test } from '@playwright/test';

/**
 * PWA hors-ligne (le cœur du produit : « rien ne quitte l'appareil », donc tout
 * doit fonctionner sans réseau). On sert `out/` depuis un serveur éphémère que
 * l'on ÉTEINT ensuite : un vrai « connection refused », pas une simulation
 * `setOffline` (que WebKit sous Playwright neutralise). Après extinction, la PWA
 * doit s'ouvrir ET s'hydrater — l'app shell servi par le service worker
 * precache-all. Garde-fou contre toute régression de l'accès hors-ligne.
 *
 * L'hôte imite un hébergeur statique : clean-URLs et « Vary: Accept-Encoding »
 * (négociation gzip) — c'est ce Vary qui exige `ignoreVary` côté service worker.
 */

// Playwright exécute depuis la racine du projet (là où vit playwright.config.ts).
const OUT = path.resolve(process.cwd(), 'out');

const CTYPE: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.webmanifest', '.txt', '.svg']);

const resolveFile = (urlPath: string): string | null => {
  if (urlPath === '/') return path.join(OUT, 'index.html');
  const direct = path.join(OUT, urlPath);
  if (existsSync(direct) && statSync(direct).isFile()) return direct;
  if (existsSync(direct + '.html')) return direct + '.html'; // clean-URL → page.html
  return null;
};

const startHost = async (): Promise<{ server: Server; port: number; kill: () => Promise<void> }> => {
  const sockets = new Set<Socket>();
  const server = createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0] ?? '/');
    let file = resolveFile(urlPath);
    if (!file && (req.headers.accept ?? '').includes('text/html')) file = path.join(OUT, '404.html');
    if (!file || !existsSync(file)) {
      res.writeHead(404);
      res.end();
      return;
    }
    const ext = path.extname(file);
    const headers: Record<string, string> = {
      'Content-Type': CTYPE[ext] ?? 'application/octet-stream',
      Vary: 'Accept-Encoding',
    };
    const body = readFileSync(file);
    if (COMPRESSIBLE.has(ext) && (req.headers['accept-encoding'] ?? '').includes('gzip')) {
      headers['Content-Encoding'] = 'gzip';
      res.writeHead(200, headers);
      const gz = createGzip();
      gz.pipe(res);
      gz.end(body);
    } else {
      res.writeHead(200, headers);
      res.end(body);
    }
  });
  server.on('connection', (s) => {
    sockets.add(s);
    s.on('close', () => sockets.delete(s));
  });
  await new Promise<void>((r) => server.listen(0, r));
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  const kill = async (): Promise<void> => {
    await new Promise<void>((r) => server.close(() => r()));
    for (const s of sockets) s.destroy(); // couper les keep-alive → vrai hors-ligne
    await new Promise<void>((r) => setTimeout(r, 300));
  };
  return { server, port, kill };
};

test('la PWA installée s\'ouvre et s\'hydrate hors-ligne', async ({ browser }) => {
  test.skip(!existsSync(path.join(OUT, 'sw.js')), 'requiert un build (out/sw.js)');

  const host = await startHost();
  let context: BrowserContext | undefined;
  try {
    context = await browser.newContext({ baseURL: `http://localhost:${host.port}` });

    // 1. Première visite en ligne : enregistre le SW et précache tout.
    const install = await context.newPage();
    await install.goto('/');
    await install.waitForLoadState('networkidle');
    await install.waitForFunction(() => !!navigator.serviceWorker.controller, null, {
      timeout: 20_000,
    });
    // attendre que le precache soit consistant (tous les assets exportés)
    await expect
      .poll(
        () =>
          install.evaluate(async () => {
            const [key] = await caches.keys();
            if (!key) return 0;
            const c = await caches.open(key);
            return (await c.keys()).length;
          }),
        { timeout: 15_000 },
      )
      .toBeGreaterThan(50);
    await install.close();

    // 2. Couper le réseau pour de bon.
    await host.kill();

    // 3. Relancer la PWA (contexte fresh page) : la navigation start_url doit
    //    être servie depuis le cache.
    const app = await context.newPage();
    const failed: string[] = [];
    app.on('requestfailed', (r) => {
      const p = new URL(r.url()).pathname;
      if (p !== '/sw.js') failed.push(p); // le check de MAJ du SW échoue hors-ligne : normal
    });

    await app.goto('/', { waitUntil: 'domcontentloaded', timeout: 15_000 });

    // 4. L'app s'affiche ET s'hydrate (React monté, pas un simple HTML statique).
    await expect(app.getByText('today, in one gesture').or(app.getByText('When did your last period start?'))).toBeVisible({ timeout: 10_000 });
    await expect.poll(() => app.locator('button').count(), { timeout: 10_000 }).toBeGreaterThan(0);
    expect(failed, `assets non servis hors-ligne : ${failed.join(', ')}`).toEqual([]);

    // 5. Une navigation hors-ligne vers une sous-route fonctionne aussi.
    const sub = await context.newPage();
    await sub.goto('/history', { waitUntil: 'domcontentloaded', timeout: 15_000 });
    await expect(sub.locator('body')).not.toBeEmpty();
    await sub.close();
    await app.close();
  } finally {
    await context?.close();
    await host.kill().catch(() => undefined);
  }
});
