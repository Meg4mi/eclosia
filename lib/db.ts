import Dexie, { type Table } from 'dexie';
import { APP_NAME, DEFAULT_LOCALE, DEFAULT_PERIOD_LENGTH } from './config';
import type { Cycle, DailyLog, Settings } from './types';

export type { Cycle, DailyLog, Settings } from './types';

type EcloseDB = Dexie & {
  cycles: Table<Cycle, string>;
  logs: Table<DailyLog, string>;
  settings: Table<Settings, string>;
};

// Identifiant technique sans accent ; le nom affiché vient de config.
export const db = new Dexie('eclose') as EcloseDB;

db.version(1).stores({
  cycles: 'id, startDate',
  logs: 'date',
  settings: 'id',
});

export const DEFAULT_SETTINGS: Settings = {
  id: 'singleton',
  appName: APP_NAME,
  locale: DEFAULT_LOCALE,
  reducedMotion: 'system',
  avgPeriodLength: DEFAULT_PERIOD_LENGTH,
};

export const getSettings = async (): Promise<Settings> =>
  (await db.settings.get('singleton')) ?? DEFAULT_SETTINGS;

export const saveSettings = async (patch: Partial<Settings>): Promise<void> => {
  const current = await getSettings();
  await db.settings.put({ ...current, ...patch, id: 'singleton' });
};
