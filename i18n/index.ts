import fr from './fr.json';
import en from './en.json';

export type Locale = 'fr' | 'en';
export type Dict = typeof fr;

const DICTS: Record<Locale, Dict> = { fr, en: en as Dict };

export const getDict = (locale: Locale): Dict => DICTS[locale];

/** Interpolation des {placeholders} d'une chaîne du dictionnaire. */
export const tpl = (s: string, vars: Record<string, string | number>): string =>
  s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));

export const formatDate = (date: Date, locale: Locale): string =>
  date.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long' });

export const formatFullDate = (date: Date, locale: Locale): string =>
  date.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
