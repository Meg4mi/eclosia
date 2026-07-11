# Éclose

Suivi de cycle menstruel. **Ton cycle, sur ton appareil.**

PWA 100 % statique et locale : aucune donnée ne quitte jamais l'appareil. Pas de compte, pas de serveur, pas d'analytics, **zéro requête réseau après le premier chargement** — vérifiable dans les DevTools (onglet Network), et vérifié par un test automatisé.

## Trois principes

1. **Local-first radical.** IndexedDB est la seule source de vérité. La seule sauvegarde est un export chiffré (AES-GCM, clé dérivée d'une phrase secrète) que l'utilisatrice garde où elle veut. Un verrou local optionnel (code, jamais stocké en clair) protège l'app d'un regard indiscret.
2. **Une interaction par jour.** Un chip « règles » (intensité en 3 gouttes) + 3 pastilles de symptômes adaptées à la phase courante. Onboarding en une seule question.
3. **Prédiction honnête.** Jamais de date sèche : une fenêtre (« probablement entre le 24 et le 27 juillet ») avec un niveau de confiance affiché, qui se resserre avec l'historique.

## Stack

- **Next.js 16** (App Router, Turbopack, `output: 'export'`) · **React 19** · **TypeScript strict**
- **Dexie.js** sur IndexedDB (lecture réactive via `dexie-react-hooks`)
- **Motion** (`LazyMotion` + `domMax`, composants `m.*`) pour la feuille et les micro-interactions — le ruban d'encre reste du canvas 2D pur (rAF)
- **CSS Modules** + design tokens en custom properties, fonts **Fraunces / Newsreader** self-hostées via `next/font`
- **Web Crypto** (AES-GCM, PBKDF2 300 000 itérations) pour l'export `.eclose`
- PWA : manifest + service worker precache-all généré au build

## Démarrer

```bash
npm install
npm run dev        # développement (http://localhost:3000)
npm run build      # build statique dans out/ + génération du service worker
npm start          # sert out/ en local
```

## Qualité

```bash
npm run lint       # typecheck strict
npm test           # Vitest — moteur de cycle, patterns, règles métier, crypto
npm run e2e        # Playwright — audit « zéro requête réseau » + parcours saisie
npm run parity     # garde de parité pixel avec le prototype (après npm run build)
```

`npm run parity` rend l'app et le prototype de référence (`phase-encre-v2.html`) dans des conditions identiques et échoue si plus de 0,5 % des pixels du cadran ou de la feuille de phase divergent. La CI GitHub Actions rejoue toute la chaîne sur chaque PR.

## Architecture

```
app/               écrans (Aujourd'hui, Historique, Réglages) — clients, minces
components/        cadran (canvas + SVG), saisie, feuilles, onboarding, nav
lib/               tout ce qui se calcule : pur, sans DOM, testé
  engine.ts        prédiction, phases, jour de cycle
  patterns.ts      moteur d'insights (récurrences inter-cycles)
  logbook.ts       règles métier d'écriture (cycles ↔ logs), optimiste
  ink.ts           couleurs du ruban, géométrie du cadran
  crypto.ts        export/import chiffré
  db.ts            schéma Dexie
i18n/              dictionnaires fr/en — aucun texte en dur dans le code
```

## Déploiement

Hébergement statique quelconque ; Vercel recommandé :

- Build command : `npm run build` (indispensable — génère aussi le service worker)
- Output directory : `out`
- `vercel.json` fournit le `Cache-Control: no-cache` sur `sw.js` et le manifest

## Note

Éclose n'est pas un dispositif médical et ne peut pas servir de contraception. Les prédictions sont des estimations basées sur l'historique personnel.
