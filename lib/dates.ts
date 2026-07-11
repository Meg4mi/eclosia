/** Utilitaires de dates ISO (YYYY-MM-DD), purs, sans fuseau surprise : tout passe par UTC midi. */

const MS_DAY = 86_400_000;

/** Date locale du jour en ISO. */
export const todayISO = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Parse une date ISO en Date UTC midi (stable quel que soit le fuseau). */
export const parseISO = (iso: string): Date => new Date(`${iso}T12:00:00Z`);

export const toISO = (d: Date): string => {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
};

export const addDays = (iso: string, days: number): string =>
  toISO(new Date(parseISO(iso).getTime() + days * MS_DAY));

/** b − a en jours entiers. */
export const diffDays = (a: string, b: string): number =>
  Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / MS_DAY);
