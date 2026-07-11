# Brief Claude Code — Éclose
**App de suivi de cycle menstruel. Nom : Éclose** (domaine : eclose.app — variable unique `APP_NAME`, ne jamais coder le nom en dur ailleurs que dans la config ; l'accent apparaît dans l'UI et la marque, jamais dans les identifiants techniques)

---

## 1. Vision

PWA de suivi menstruel qui combine ce qu'aucune app du marché ne combine : la confidentialité radicale d'Euki, le sérieux scientifique de Clue, et une direction artistique « encre vivante × instrument de précision » unique dans la catégorie.

**Trois piliers non négociables :**

1. **Local-first radical.** Aucune donnée ne quitte l'appareil. Pas de compte, pas de backend, pas d'analytics, zéro requête réseau après le premier chargement (vérifiable dans les DevTools — c'est un argument marketing). IndexedDB est la source de vérité.
2. **Une interaction par jour.** Le geste central tient en 5 secondes : un chip « règles » (intensité en 3 gouttes) + 3 pastilles de symptômes adaptées à la phase courante. Onboarding = une seule question. Le logging complet est optionnel, jamais culpabilisant.
3. **Prédiction honnête.** Jamais de date sèche. Toujours une fenêtre (« probablement entre le 24 et le 27 juillet ») avec niveau de confiance affiché, qui se resserre avec l'historique.

**Non-objectifs (ne jamais implémenter, même sur demande future) :**
- Aucune revendication contraceptive ni positionnement médical (terrain réglementaire de Natural Cycles). Disclaimer discret dans les réglages.
- Pas de compte, pas de cloud sync en v1, pas de freemium, pas de pub, pas de SDK tiers (le scandale Flo/Meta est notre contre-exemple fondateur).
- Pas de suivi de grossesse en v1.
- Pas de contenu astrologie.

---

## 2. Stack & contraintes techniques

- **Next.js 16 (16.2.x stable) App Router + React 19 + TypeScript strict** (`strict: true`, pas de `any`), Turbopack par défaut, patterns fonctionnels, pas de classes. Démarrer avec `next@latest` et utiliser `next upgrade` pour les mises à jour ; ne jamais figer sur une majeure en fin de support.
- **Animations : Motion** (ex framer-motion, package `motion`, import `motion/react`) — en mode **léger obligatoire** : `LazyMotion` + `domAnimation` chargés une fois au layout, composants `m.*` uniquement (jamais `motion.*`, pour garder le bundle minimal). Périmètre autorisé : bottom sheet (spring + drag-to-dismiss, remplace le handler touch artisanal du prototype), micro-interactions des chips (tap scale, apparition), transitions d'écrans, onboarding, `AnimatePresence` sur les patterns. **Périmètre interdit : le ruban d'encre** — le canvas rAF du prototype reste tel quel, Motion ne touche jamais au rendu du cadran. Toute animation Motion passe par `useReducedMotion()`.
- **PWA complète** : `manifest.json` (standalone, theme-color `#120d14`, icônes maskable), service worker en precache-all (l'app est 100 % statique), `next-pwa` ou SW manuel — proposer et faire valider avant d'implémenter.
- **Déploiement Vercel**, output statique. **Aucune API route, aucun appel réseau runtime.** Les fonts Google (Fraunces, Newsreader) doivent être self-hostées via `next/font` (sinon requêtes réseau → brise la promesse).
- **Persistance : Dexie.js** sur IndexedDB. Demander `navigator.storage.persist()` au premier log.
- **Rendu du cadran** : canvas 2D (ruban d'encre) + overlay SVG (graduations, labels, zones tactiles). Pas de Three.js, pas de WebGL — le prototype prouve que canvas 2D suffit.
- Pas de librairie UI, pas de Tailwind : CSS modules ou vanilla-extract, tokens en CSS custom properties (voir §6).
- Conventional commits. Plan d'implémentation soumis pour approbation avant chaque phase de code.

---

## 3. Source de vérité visuelle

Le fichier `phase-encre-v2.html` (fourni à côté de ce brief) est **la référence exacte** du look and feel : couleurs, typographie, animation du ruban, graduations, aiguille hairline, feuille de phase, chips. Le portage React doit être visuellement indistinguable du prototype avant toute évolution. Le canvas se transpose dans un `useEffect` avec cleanup du rAF ; l'overlay SVG passe en JSX.

---

## 4. Modèle de données (Dexie)

```ts
// db.ts
interface Cycle {
  id: string;            // ulid
  startDate: string;     // ISO date (jour 1 des règles)
  endDate?: string;      // dernier jour de règles (optionnel)
  lengthDays?: number;   // calculé à la clôture (start suivant - start)
}

interface DailyLog {
  date: string;          // ISO date, clé primaire
  flow: 0 | 1 | 2 | 3;   // aucune / légère / moyenne / abondante
  symptoms: string[];    // ids de symptômes (voir catalogue §7)
  note?: string;         // champ libre optionnel (v1.1)
}

interface Settings {
  id: 'singleton';
  appName: string;
  locale: 'fr' | 'en';
  reducedMotion: 'system' | 'on' | 'off';
  onboardedAt?: string;
  avgPeriodLength: number; // défaut 5, recalculé
}
```

Règles métier :
- Un `flow > 0` loggé sur un jour non couvert par un cycle ouvre un nouveau cycle si le dernier start date de plus de 10 jours ; sinon il étend les règles courantes.
- La clôture d'un cycle (nouveau start) calcule `lengthDays` du précédent.
- Toute écriture est optimiste, sans spinner : l'UI ne doit jamais attendre IndexedDB.

---

## 5. Moteur de cycle (lib/engine.ts — pur, testé)

Fonctions pures, sans dépendance au DOM, couvertes par Vitest :

- `predict(cycles: Cycle[]): Prediction` → `{ meanLength, sd, windowStart, windowEnd, confidence }`.
  - `meanLength` = moyenne des 6 derniers cycles clos (ou tous si < 6).
  - Fenêtre = `[lastStart + mean − sd, lastStart + mean + sd]` (sd min 1 jour).
  - `confidence`: 'faible' (< 2 cycles), 'moyenne' (2–3), 'élevée' (≥ 4 et sd ≤ 2), 'moyenne' sinon. Afficher aussi « basé sur N cycles ».
- `phases(prediction, periodLength): PhaseRange[]` → menstruelle J1–P, folliculaire P+1 → ov−3, ovulatoire ov−2 → ov+1 (ov = L−14), lutéale ov+2 → L. Frontières affichées en dégradé (lissage couleur 3 passes, cf. prototype), jamais en coupure nette.
- `dayOf(date, lastStart): number` → jour du cycle courant.
- `patterns(logs, cycles): Pattern[]` → moteur d'insights, voir §8.

Cas limites à gérer explicitement : 0 cycle (mode découverte, cadran neutre 28 j), 1 cycle (prédiction 'faible' basée dessus), cycle en retard (jour courant > windowEnd → message calme « ton cycle dépasse ta fenêtre habituelle », jamais alarmiste), cycles < 21 j ou > 40 j (suggérer doucement d'en parler à un médecin, une fois, sans répéter).

---

## 6. Design tokens

```css
--bg:#120d14; --ink:#f1e8e2; --muted:#8d7f88;
--hair:rgba(241,232,226,.12);
--c-menst:#e2543f; --c-foll:#a9c27a; --c-ovul:#f0b153; --c-lute:#a678c9;
```

- **Display** : Fraunces (poids 200 pour le grand « J16 », opsz 144). **Texte** : Newsreader, l'italique porte tout le registre éditorial. Pas de troisième famille.
- Teinte ambiante (`--tint`) et accent suivent la phase courante ; transition 1,5 s.
- `prefers-reduced-motion` : ruban statique (t=0), pas de rAF en boucle, pulsations désactivées — déjà implémenté dans le prototype, à conserver ; côté Motion, `useReducedMotion()` bascule les springs en transitions instantanées.
- Grammaire d'animation : les springs Motion doivent rester dans le registre « organique calme » du prototype — stiffness basse, damping élevé, jamais de bounce marqué. Une seule courbe de sheet, une seule durée de fade, réutilisées partout (définies dans un `motion-tokens.ts`).
- Performance : rAF unique, canvas dimensionné en devicePixelRatio, viser 60 fps sur mobile milieu de gamme ; si le blur canvas coûte trop cher sur Android, pré-rendre la nappe floue dans un offscreen canvas mis à jour à 15 fps.

---

## 7. Écrans & interactions

**Onboarding (première ouverture)** — un seul écran, une seule question : « Quand ont commencé tes dernières règles ? » (date picker + « je ne sais plus » → mode découverte). Rien d'autre. Pas de prénom, pas d'objectifs, pas de questionnaire.

**Aujourd'hui (écran principal)** — le cadran : ruban d'encre animé, graduations hairline (1/jour, majeure /7, labels J1·J8·J15·J22), fenêtre d'incertitude cotée en pointillés sur la graduation, aiguille hairline vers la goutte « aujourd'hui » qui respire. Centre : jour + phase + phrase contextuelle. Sous le cadran : prédiction honnête, puis la ligne de saisie (chip règles à 3 gouttes + 3 chips symptômes).

Chips adaptatives : catalogue global d'une vingtaine de symptômes avec ids stables ; défauts par phase (menst : douleurs/fatigue/humeur basse ; foll : énergie haute/bon sommeil/motivation ; ovul : énergie haute/libido/douleur ovulation ; lut : sommeil agité/irritabilité/envies sucrées). Dès 2 cycles de données, remplacer les défauts par les 3 symptômes que l'utilisatrice logge réellement le plus dans cette phase. Un bouton « + » ouvre le catalogue complet.

**Feuille de phase (tap sur un arc)** — bottom sheet : description, faits typiques (énergie/sommeil/humeur…), « ensuite », section **Tes patterns**. Swipe down pour fermer. L'accent global glisse vers la couleur de la phase consultée.

**Historique (v1)** — liste verticale minimaliste des cycles clos (dates, longueur, mini-arc), accès aux logs d'un jour passé pour correction.

**Réglages (v1)** — export/import chiffré (§9), langue, motion, effacement total (double confirmation), disclaimer non-médical, à propos.

Navigation : 3 destinations max (Aujourd'hui / Historique / Réglages), barre discrète ou geste — proposer avant d'implémenter.

---

## 8. Moteur de patterns

Objectif : transformer les logs en une ou deux phrases par phase, du type « Ton sommeil se dégrade à J-3 des règles, 3 cycles sur 4 ».

Algorithme v1, volontairement simple et explicable :
- Pour chaque symptôme et chaque position relative (J1…Jn depuis le début, et J-1…J-7 avant les règles suivantes), compter la récurrence inter-cycles.
- Un pattern est retenu si présent dans ≥ 60 % des cycles clos (min 3 cycles) sur une fenêtre de ± 1 jour.
- Formulation : toujours sourcée (« vu sur tes N derniers cycles »), jamais causale, jamais prescriptive. Max 2 patterns par phase, triés par récurrence.
- Aucun pattern avant 3 cycles : afficher « Encore N cycles et je pourrai te montrer tes patterns personnels ».

---

## 9. Export / import chiffré

- Export : JSON complet (cycles + logs + settings) chiffré **AES-GCM via Web Crypto**, clé dérivée d'une passphrase (PBKDF2, ≥ 300k itérations, salt aléatoire embarqué). Fichier `.eclose` téléchargé localement.
- Import : même chemin inverse, avec préviu (« 14 cycles, 380 jours de logs ») avant écrasement, et fusion plutôt qu'écrasement si des données existent (les logs importés ne remplacent jamais un log local plus récent sur la même date).
- C'est le seul mécanisme de sauvegarde en v1 ; le proposer doucement après le 2ᵉ cycle clos.

---

## 10. i18n & copy

- FR d'abord, structure i18n dès le départ (dictionnaires JSON, pas de texte en dur), EN en v1.1.
- Registre : éditorial, calme, tutoiement, jamais culpabilisant, jamais alarmiste, jamais « girly ». L'italique Newsreader porte les phrases contextuelles. Les phrases du prototype sont la référence de ton.

---

## 11. Jalons

- **M1 — Cœur** : portage fidèle du prototype (cadran, saisie, feuille de phase), Dexie, onboarding 1 question, moteur de prédiction testé. Critère : utilisable au quotidien par une première utilisatrice réelle.
- **M2 — Mémoire** : historique, chips adaptatives, moteur de patterns, gestion des cas limites (retard, cycles irréguliers).
- **M3 — PWA & confiance** : manifest + SW + installabilité iOS/Android, export/import chiffré, page réglages, audit « zéro requête réseau » automatisé (test Playwright qui échoue si une requête part après le boot).

À la fin de chaque jalon : démo + revue avant de continuer. Aucun démarrage de M+1 sans validation.

---

## 12. Règles de collaboration

- Plan d'implémentation détaillé soumis **avant** tout code, à chaque jalon.
- TypeScript strict, patterns fonctionnels, conventional commits.
- Toute déviation visuelle par rapport à `phase-encre-v2.html` doit être signalée et justifiée.
- Tests : Vitest sur `lib/engine.ts` et `lib/patterns.ts` (100 % des fonctions pures), Playwright pour l'audit réseau et le smoke test du parcours saisie.
- Économie de tokens : ne pas relire les fichiers inchangés, s'appuyer sur ce brief comme contexte de référence.
