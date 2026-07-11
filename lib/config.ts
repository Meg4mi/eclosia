/**
 * Seul endroit du code où le nom de l'app est écrit.
 * L'accent apparaît dans l'UI et la marque, jamais dans les identifiants techniques.
 */
export const APP_NAME = 'Éclose';
export const APP_DOMAIN = 'eclose.app';
export const APP_DESCRIPTION = 'Ton cycle, sur ton appareil.';
export const THEME_COLOR = '#120d14';

export const DEFAULT_LOCALE = 'fr' as const;
export const DEFAULT_PERIOD_LENGTH = 5;
export const DEFAULT_CYCLE_LENGTH = 28;

/** Extension du fichier d'export chiffré. */
export const EXPORT_EXTENSION = '.eclose';

/** Version figée au build (next.config.ts) — permet de vérifier d'un coup
 * d'œil quel build tourne, notamment face au cache du service worker. */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0';
export const APP_COMMIT = process.env.NEXT_PUBLIC_APP_COMMIT ?? 'dev';
export const APP_BUILT_AT = process.env.NEXT_PUBLIC_APP_BUILT_AT ?? '';
