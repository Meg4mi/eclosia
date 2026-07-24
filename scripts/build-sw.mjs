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
// Install résiliente (JAMAIS un addAll qui échoue en bloc) : un asset ORDINAIRE
// qui répond en redirection ou en erreur ne doit pas faire échouer TOUT
// l'install, sinon le nouveau SW est jeté, n'atteint jamais « waiting », le toast
// de mise à jour ne s'affiche pas et l'appareil reste figé sur l'ancien cache
// indéfiniment. Deux pièges couverts :
//  - un asset servi en redirection (ex. clean-URLs de l'hébergeur) : cache.put
//    REJETTE une réponse marquée « redirected » sur WebKit/Safari (là où
//    Chromium tolère — d'où un bug invisible aux e2e). On reconstruit alors
//    une réponse propre.
//  - un asset absent (404) ou une erreur réseau : on l'ignore au lieu de tout
//    faire échouer (cache-first : il sera récupéré au besoin).
//
// EXCEPTION — le shell de démarrage (start_url « / ») est CRITIQUE. S'il manque
// du cache, la PWA « ne s'ouvre plus » hors-ligne (écran « pas de connexion »,
// IndexedDB pourtant intacte). Le traiter en best-effort comme les autres est un
// piège : si son fetch échoue (blip réseau, hôte qui hoquette, WebView iOS
// suspendue en plein install), l'install RÉUSSIT quand même, le nouveau SW
// s'active et « activate » SUPPRIME l'ancien cache (encore complet) — l'appareil
// se retrouve avec un cache neuf sans shell servable. On le précache donc EN
// PREMIER et sa perte fait ÉCHOUER l'install : le SW est jeté, l'ancien continue
// de servir hors-ligne, on retentera au prochain lancement. Jamais de cache neuf
// sans shell.
const SHELL = '/';

// cache.put REJETTE une réponse « redirected » sur WebKit/Safari (Chromium
// tolère) : on reconstruit alors une réponse propre, encoding inclus.
async function store(cache, url, res) {
  await cache.put(
    url,
    res.redirected
      ? new Response(await res.blob(), { status: 200, statusText: 'OK', headers: res.headers })
      : res
  );
}

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(async (c) => {
      // 1. Shell critique d'abord : sa perte fait échouer tout l'install.
      const shell = await fetch(SHELL, { cache: 'reload' });
      if (!shell.ok) throw new Error('shell precache failed: ' + shell.status);
      await store(c, SHELL, shell);
      // 2. Le reste : best-effort, un asset injoignable ne bloque jamais l'install.
      await Promise.all(
        ASSETS.filter((u) => u !== SHELL).map(async (u) => {
          try {
            const res = await fetch(u, { cache: 'reload' });
            if (!res.ok) return;
            await store(c, u, res);
          } catch (_) {
            /* asset injoignable : ne jamais bloquer l'install entière */
          }
        })
      );
    })
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

// Auto-réparation — WebKit (iOS) peut PURGER le Cache Storage sous pression
// disque SANS désenregistrer le service worker (storage.persist() n'est qu'un
// vœu). L'install ne rejouant qu'au changement de version, un cache purgé
// restait vide pour toujours : chaque lancement en ligne marchait (réseau,
// donc invisible), chaque lancement à froid hors-ligne échouait (« pas de
// connexion », IndexedDB pourtant intacte). À chaque navigation, si le shell
// manque du cache, on re-précache tout (même discipline que l'install : shell
// d'abord, le reste best-effort). Cache intact → un seul caches.match, zéro
// requête réseau : l'audit réseau reste vert.
let repairing = null;
function repair() {
  repairing ??= (async () => {
    try {
      const c = await caches.open(CACHE);
      if (await c.match(SHELL, MATCH)) return;
      const shell = await fetch(SHELL, { cache: 'reload' });
      if (!shell.ok) return;
      await store(c, SHELL, shell);
      await Promise.all(
        ASSETS.filter((u) => u !== SHELL).map(async (u) => {
          try {
            if (await c.match(u, MATCH)) return;
            const res = await fetch(u, { cache: 'reload' });
            if (res.ok) await store(c, u, res);
          } catch (_) {
            /* hors-ligne ou asset injoignable : on retentera à la prochaine navigation */
          }
        })
      );
    } catch (_) {
      /* idem */
    } finally {
      repairing = null;
    }
  })();
  return repairing;
}

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ignoreVary : les assets sont servis avec « Vary: Accept-Encoding » (l'hôte
// statique négocie gzip/br). Sans ce drapeau, un match cache-first dépend de la
// négociation de contenu de la requête — un Accept-Encoding qui diffère de celui
// utilisé au précache fait rater le match, la requête part au réseau et échoue
// hors-ligne. On sert toujours l'octet caché, indépendamment de l'encodage.
const MATCH = { ignoreSearch: true, ignoreVary: true };

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  // chaque lancement de l'app passe par une navigation : point d'ancrage de
  // l'auto-réparation (no-op quand le cache est intact)
  if (e.request.mode === 'navigate') e.waitUntil(repair());
  e.respondWith(
    caches.match(e.request, MATCH).then((hit) => {
      if (hit) return hit;
      // Repli navigation : servir le shell de l'app. On tente d'abord la
      // start_url « / » (clé canonique, toujours précachée depuis le fetch('/')
      // de l'install) puis « /index.html » — sur un hôte à clean-URLs, « / » est
      // la seule clé fiable (/index.html y répond en redirection). Sans ce repli
      // « / », une navigation hors-ligne vers une route non précachée casse.
      if (e.request.mode === 'navigate') {
        return caches
          .match('/', MATCH)
          .then((root) => root || caches.match('/index.html', MATCH))
          .then((shell) => shell || fetch(e.request));
      }
      // Écriture au retour : un raté de cache servi par le réseau est stocké
      // (clé sans query, cohérente avec ignoreSearch) — comble les trous d'un
      // précache partiel ou d'une purge, sans attendre la réparation complète.
      return fetch(e.request).then((res) => {
        if (e.request.method === 'GET' && res.ok) {
          const copy = res.clone();
          void caches
            .open(CACHE)
            .then((c) => store(c, url.origin + url.pathname, copy))
            .catch(() => undefined);
        }
        return res;
      });
    })
  );
});
`;

writeFileSync(path.join(OUT, 'sw.js'), sw);
console.log(`sw.js : ${urls.size} URLs précachées, version ${version}`);
