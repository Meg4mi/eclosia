# Contribuer à Éclose

Merci de l'intérêt que tu portes au projet. Éclose est un logiciel libre
(AGPL-3.0) : les contributions sont bienvenues, tant qu'elles respectent ce qui
fait l'identité de l'app — la confidentialité radicale et le registre calme.

## Philosophie en une phrase

**Tout se calcule sur l'appareil, rien ne part ailleurs, et l'app ne culpabilise
jamais.** Une contribution qui va contre ça ne sera pas fusionnée, aussi bien
écrite soit-elle.

## Non-objectifs (ne seront jamais acceptés)

Ces refus sont des choix de conception, pas des oublis :

- Aucune revendication contraceptive ou médicale.
- Pas de compte, de synchronisation cloud, de freemium, de publicité, de SDK
  tiers ni d'analytics.
- Pas de suivi de grossesse, pas d'astrologie.
- **Zéro requête réseau au runtime** : pas d'API route, pas de `fetch`, pas de
  CDN, pas de fonts distantes. Un test automatisé (`e2e/network-audit.spec.ts`)
  le vérifie et ne doit pas être affaibli.

## Mise en route

```bash
npm install
npm run dev        # http://localhost:3000
```

Chromium pour les tests Playwright s'installe via `npx playwright install
--with-deps chromium` (inutile dans les environnements où il est déjà présent).

## La chaîne qualité (obligatoire avant toute PR)

Ces cinq commandes doivent être vertes — la CI (`.github/workflows/ci.yml`)
rejoue exactement la même chaîne sur chaque PR :

```bash
npm run lint       # tsc --noEmit (strict, jamais de « any »)
npm test           # Vitest — lib/ pur, couverture des fonctions métier
npm run build      # next build + génération du service worker (jamais next build seul)
npm run e2e        # Playwright (nécessite un build à jour)
npm run parity     # garde de parité pixel du cadran vs prototype (> 0,5 % = échec)
```

## Où va quoi

- `lib/` — **tout ce qui se calcule** : pur, sans DOM, couvert par Vitest. Toute
  nouvelle logique métier va ici, avec ses tests, jamais dans un composant.
- `components/` + `app/` — **tout ce qui se voit** : mince, couvert par les e2e.
- `i18n/fr.json` + `i18n/en.json` — **aucun texte en dur** : toute chaîne visible
  passe par les deux dictionnaires. Registre calme, tutoiement, jamais
  culpabilisant ni alarmiste.

## Conventions

- **TypeScript strict**, patterns fonctionnels, pas de classes, pas de `any`.
- Le nom « Éclose » n'est écrit qu'à un seul endroit : `lib/config.ts`. Les
  identifiants techniques restent sans accent (`eclose`).
- **Commits conventionnels, en français** (`feat:`, `fix:`, `docs:`, `refactor:`…).

## Signaler un bug ou proposer une idée

Ouvre une *issue* avant une grosse PR : on vérifie ensemble que la piste est
compatible avec les non-objectifs, ça évite du travail perdu. Pour une faille de
sécurité, préfère un signalement privé plutôt qu'une issue publique.

## Licence des contributions

En proposant une contribution, tu acceptes qu'elle soit distribuée sous licence
**AGPL-3.0**, comme le reste du projet.
