/**
 * Seul endroit du code où le nom de l'app est écrit.
 * L'accent apparaît dans l'UI et la marque, jamais dans les identifiants techniques.
 */
export const APP_NAME = 'Éclose';
export const APP_DOMAIN = 'eclose.app';
export const APP_URL = `https://${APP_DOMAIN}`;
export const APP_DESCRIPTION = 'Your cycle, on your device.';
export const THEME_COLOR = '#120d14';

/** Code source public (logiciel libre, AGPL-3.0). Lien externe uniquement —
 * jamais requêté au runtime, ouvert dans le navigateur sur geste utilisateur. */
export const REPO_URL = 'https://github.com/Meg4mi/eclosia';

/** Page de soutien (dons Liberapay). Lien externe uniquement, jamais requêté au
 * runtime, ouvert dans le navigateur sur geste utilisateur. */
export const SUPPORT_URL = 'https://liberapay.com/Meg4mi';

/** Mots-clés statiques pour le référencement (métadonnées de build, jamais
 * rendus dans l'UI). Langue par défaut = anglais (§SEO). Registre calme,
 * jamais médical ni contraceptif (§non-objectifs). */
export const APP_KEYWORDS = [
  'cycle tracker',
  'menstrual cycle',
  'period',
  'privacy',
  'offline',
  'on-device',
  'no account',
  'PWA',
] as const;

export const DEFAULT_LOCALE = 'en' as const;
export const DEFAULT_PERIOD_LENGTH = 5;
export const DEFAULT_CYCLE_LENGTH = 28;

/** Extension du fichier d'export chiffré. */
export const EXPORT_EXTENSION = '.eclose';

/** Version figée au build (next.config.ts) — permet de vérifier d'un coup
 * d'œil quel build tourne, notamment face au cache du service worker. */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0';
export const APP_COMMIT = process.env.NEXT_PUBLIC_APP_COMMIT ?? 'dev';
export const APP_BUILT_AT = process.env.NEXT_PUBLIC_APP_BUILT_AT ?? '';
