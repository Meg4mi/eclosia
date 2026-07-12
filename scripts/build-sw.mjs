/**
 * Post-build : génère out/sw.js avec la liste complète des assets exportés
 * (precache-all — l'app est 100 % statique) et un hash de version.
 * Cache-first strict : après le premier chargement, zéro requête réseau.
 */

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const OUT = path.resolve(process.cwd(), 'out');

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

const files = walk(OUT)
  .map((f) => '/' + path.relative(OUT, f).split(path.sep).join('/'))
  .filter((f) => f !== '/sw.js');

// URLs de navigation : /page.html est aussi servi sur /page et /page/
const urls = new Set(['/']);
for (const f of files) {
  urls.add(f);
  if (f.endsWith('.html')) {
    const clean = f.replace(/\.html$/, '');
    if (clean !== '/index') {
      urls.add(clean);
      urls.add(clean + '/');
    }
  }
}

const hash = createHash('sha256');
for (const f of files.sort()) hash.update(readFileSync(path.join(OUT, f.slice(1))));
const version = hash.digest('hex').slice(0, 12);

const sw = `/* Service worker généré au build — precache-all, cache-first. */
const CACHE = 'eclose-${version}';
const ASSETS = ${JSON.stringify([...urls], null, 0)};

// pas de skipWaiting automatique : le nouveau SW attend la fermeture des
// anciens onglets, sinon une page déjà chargée peut perdre ses chunks hashés
// à la purge du cache. L'activation immédiate n'arrive QUE sur geste
// utilisateur (« recharger » dans l'app), suivie d'un reload synchronisé.
//
// Install résiliente (JAMAIS un addAll qui échoue en bloc) : un seul asset qui
// répond en redirection ou en erreur ne doit pas faire échouer TOUT l'install,
// sinon le nouveau SW est jeté, n'atteint jamais « waiting », le toast de mise
// à jour ne s'affiche pas et l'appareil reste figé sur l'ancien cache
// indéfiniment. Deux pièges couverts :
//  - un asset servi en redirection (ex. clean-URLs de l'hébergeur) : cache.put
//    REJETTE une réponse marquée « redirected » sur WebKit/Safari (là où
//    Chromium tolère — d'où un bug invisible aux e2e). On reconstruit alors
//    une réponse propre.
//  - un asset absent (404) ou une erreur réseau : on l'ignore au lieu de tout
//    faire échouer (cache-first : il sera récupéré au besoin).
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      Promise.all(
        ASSETS.map(async (u) => {
          try {
            const res = await fetch(u, { cache: 'reload' });
            if (!res.ok) return;
            await c.put(
              u,
              res.redirected
                ? new Response(await res.blob(), {
                    status: 200,
                    statusText: 'OK',
                    headers: res.headers,
                  })
                : res
            );
          } catch (_) {
            /* asset injoignable : ne jamais bloquer l'install entière */
          }
        })
      )
    )
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      if (e.request.mode === 'navigate') {
        return caches.match('/index.html').then((idx) => idx || fetch(e.request));
      }
      return fetch(e.request);
    })
  );
});
`;

writeFileSync(path.join(OUT, 'sw.js'), sw);
console.log(`sw.js : ${urls.size} URLs précachées, version ${version}`);
