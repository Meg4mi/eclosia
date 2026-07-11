# CLAUDE.md — Éclose

## Statut du projet

**Le brief (`brief-claude-code.md`) est intégralement implémenté** (jalons M1, M2 et M3 : cadran, saisie, feuille de phase, moteur de prédiction, onboarding, historique, chips adaptatives, moteur de patterns, réglages, export/import chiffré, PWA, audits automatisés). **Il ne sert plus à rien de le lire** : il est conservé comme archive historique. **Le code et le présent fichier font foi.** En cas de contradiction entre le brief et le code, le code a raison — les écarts sont des décisions prises et validées en cours de route (voir « Écarts assumés »).

`phase-encre-v2.html` n'est PAS du code mort : c'est la **référence de parité visuelle** utilisée par `npm run parity`. Ne pas le supprimer. Toute évolution visuelle du cadran doit être appliquée aux deux (app + prototype) pour que la garde reste exacte.

## Commandes

```bash
npm run dev          # développement
npm run build        # next build + génération du SW dans out/ (toujours cette commande, jamais next build seul)
npm run lint         # tsc --noEmit (strict)
npm test             # Vitest — lib/ pur, 100 % des fonctions
npm run e2e          # Playwright (nécessite un build à jour ; sert out/ sur :4173)
npm run parity       # garde de parité pixel (cadran + feuille) vs prototype (nécessite un build ; échec si > 0,5 % de pixels divergents)
```

Avant tout push : `lint` + `test` + `build` + `e2e` + `parity` doivent être verts — la CI (`.github/workflows/ci.yml`) rejoue exactement cette chaîne sur chaque PR.
Dans cet environnement distant, Chromium est à `/opt/pw-browsers/chromium` (auto-détecté ; en CI/local c'est la résolution Playwright normale) — ne jamais lancer `playwright install` ici.

## Règles non négociables

- **Zéro requête réseau au runtime.** Pas d'API route, pas de fetch, pas de CDN, pas de fonts distantes (self-hostées via `next/font`). Le test `e2e/network-audit.spec.ts` échoue sinon — ne pas l'affaiblir.
- **TypeScript strict, patterns fonctionnels, pas de classes, pas de `any`.**
- **Aucun texte en dur** : tout passe par `i18n/fr.json` + `en.json` (registre : calme, tutoiement, jamais culpabilisant ni alarmiste).
- **« Éclose » n'est écrit qu'à un seul endroit** : `lib/config.ts` (`APP_NAME`). Identifiants techniques sans accent (`eclose`).
- **Motion ne touche jamais au ruban d'encre** (le canvas rAF de `InkRing.tsx`). Périmètre Motion : feuilles, chips, onboarding, transitions. `LazyMotion` avec **`domMax`** — pas `domAnimation`, qui n'inclut pas les gestes drag (bug historique, ne pas « re-optimiser »).
- **Une seule courbe d'animation de feuille** (`lib/motion-tokens.ts`) : `cubic-bezier(.32,.72,.28,1)` 480 ms, celle du prototype. Registre « organique calme », jamais de bounce marqué.
- **Écritures optimistes** : l'UI n'attend jamais IndexedDB, pas de spinner.
- **Conventional commits, en français.**

## Non-objectifs (ne jamais implémenter, même sur demande)

Aucune revendication contraceptive ou médicale · pas de compte, cloud sync, freemium, pub, SDK tiers ou analytics · pas de suivi de grossesse · pas d'astrologie.

## Architecture — où va quoi

- `lib/` : **tout ce qui se calcule** — pur, sans DOM, couvert par Vitest. Toute nouvelle logique métier va ici avec ses tests, jamais dans un composant.
- `components/` + `app/` : **tout ce qui se voit** — mince, non testé unitairement, couvert par les e2e.
- Lecture réactive : `useLiveQuery` (dexie-react-hooks) ; pas de store global, le besoin n'existe pas à cette échelle.

## Pièges connus (appris à la dure)

- **La date du jour vient de `useToday()`** (lib/hooks), jamais de `todayISO()` appelé dans un composant : le hook re-rend à minuit et au retour au premier plan — sinon une app laissée ouverte logge sur la veille.
- **Service worker sans `skipWaiting` automatique** : le nouveau SW attend la fermeture des anciens onglets, sinon une page déjà chargée perd ses chunks hashés à la purge du cache. La seule activation immédiate passe par le toast « nouvelle version prête · recharger » (`SwRegister`) : geste utilisateur → `SKIP_WAITING` → reload sur `controllerchange`. Ne pas « accélérer » autrement.
- **Banc de parité** : le CSS global injecté dans le prototype référence `var(--font-newsreader)` que seul next/font définit — le script injecte les variables manquantes, et tolère ± 2 px d'alignement vertical sur la feuille (ancrage bas fractionnaire).

- **`InkRing.tsx`** : la nappe floue (blur par trait, identique au prototype) est pré-rendue dans un offscreen à cadence adaptative. Le coût du blur canvas est payé à la **rasterisation différée**, pas à l'appel de dessin — on jauge la lenteur de l'appareil sur le delta de frame qui SUIT un rendu de nappe. Appliquer le blur par frame sur le canvas principal écroule l'event loop (2 fps en rendu logiciel) et retarde les événements IndexedDB de plusieurs secondes.
- **Feuilles scrollables** : avec `touch-action: pan-y`, le navigateur émet `pointercancel` avant que Motion ne voie le geste — le swipe-to-dismiss « en haut du scroll » est piloté par des listeners `touchmove` non-passifs dans `BottomSheet.tsx`, qui écrivent la même motionValue que le drag Motion. Ne pas simplifier.
- **Dexie** : la version d'IndexedDB stockée = version Dexie × 10 (un `indexedDB.open('eclose', 1)` externe casse). Les scripts de seed ouvrent sans numéro de version.
- **Dossiers `_*` sous `app/`** : privés pour l'App Router, jamais routés.

## Règles métier clés (résumé exécutable)

- **Règle des 10 jours** (`lib/logbook.ts`) : un flow > 0 à ≤ 10 j du dernier début étend les règles ; au-delà, il ouvre un nouveau cycle (clôture du précédent, `lengthDays` = différence des débuts). `setFlow` retourne `newCycleStarted` : l'UI affiche alors « nouveau cycle, J1 · annuler » (8 s) — le rebase silencieux du cadran est vécu comme un bug.
- **Prédiction** (`lib/engine.ts`) : moyenne des 6 derniers cycles clos, fenêtre `lastStart + mean ± sd` (sd min 1 j), confiance faible/moyenne/élevée. 0 cycle → mode découverte (cadran neutre 28 j) ; retard → message calme, jamais alarmiste.
- **Patterns** (`lib/patterns.ts`) : récurrence ≥ 60 % des cycles clos (min 3), fenêtre ± 1 j, max 2 par phase, formulation toujours sourcée, jamais causale.
- **Chips adaptatives** (`lib/symptoms.ts`) : défauts par phase, remplacés dès 2 cycles clos par les 3 symptômes réellement les plus loggés dans la phase (cycle en cours compris, sur sa longueur estimée).
- **Verrou local** (`lib/pin.ts`) : code 4–8 chiffres, hash PBKDF2 + salt dans Settings, déverrouillage valable par session (`sessionStorage`). Aucune récupération — c'est documenté dans l'UI. Menace couverte : regard indiscret, pas attaque outillée.
- **Import** (`lib/logbook.ts` `mergeImport`) : les logs/réglages locaux gagnent, sauf appareil vierge où les réglages importés s'appliquent ; un import de données marque l'onboarding comme fait.
- **Note du jour** : champ `note` de DailyLog, éditée dans la feuille catalogue et l'éditeur d'historique (`NoteField`, écriture débouncée).

## Écarts assumés vs le prototype/brief (décisions validées)

- Fenêtre de prédiction : formule du brief §5 (`lastStart + mean ± sd`), soit +1 jour vs le prototype qui décalait d'un jour.
- Wordmark « Phase » → `APP_NAME` ; tagline « encre vivante · précision d'instrument » supprimée partout.
- Label « lutéale » ajouté sur le cadran (le prototype l'omettait) — prototype de référence mis à jour en conséquence.
- Lissage du ruban : 2 passes .22/.56/.22 au lieu de 3 passes .28/.44/.28 (le rouge menstruel était délavé sur 5 jours) — prototype de référence mis à jour à l'identique, frontières toujours en dégradé.
- Encre menstruelle du ruban : #b23122 (`INK_COLORS` dans lib/ink.ts) au lieu du token #e2543f — le filament éclaircit ×1,28 avec écrêtage, ce qui virait le rouge au corail ; l'accent UI reste --c-menst. Prototype aligné.
- `domMax` au lieu de `domAnimation` (le drag l'exige).
- En reduced-motion, un resize redessine une frame statique (bug silencieux du prototype, corrigé).

## Déploiement

Vercel : Build Command **`npm run build`** (sinon pas de service worker), Output `out`, headers gérés par `vercel.json`. L'app est du statique pur — n'importe quel hébergeur statique convient.
