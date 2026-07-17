/** Types du domaine, partagés entre le moteur pur et la persistance. */

export interface Cycle {
  id: string; // ulid
  startDate: string; // ISO date (jour 1 des règles)
  endDate?: string; // dernier jour de règles (optionnel)
  lengthDays?: number; // calculé à la clôture (start suivant - start)
}

export type Flow = 0 | 1 | 2 | 3; // aucune / légère / moyenne / abondante

export interface DailyLog {
  date: string; // ISO date, clé primaire
  flow: Flow;
  symptoms: string[]; // ids de symptômes (catalogue lib/symptoms.ts)
  note?: string; // champ libre optionnel (v1.1)
}

export interface Settings {
  id: 'singleton';
  appName: string;
  locale: 'fr' | 'en';
  reducedMotion: 'system' | 'on' | 'off';
  onboardedAt?: string;
  avgPeriodLength: number; // défaut 5, recalculé
}

export type PhaseKey = 'menst' | 'foll' | 'ovul' | 'lute';

export interface PhaseRange {
  key: PhaseKey;
  from: number; // jour de cycle inclus (1-based)
  to: number; // jour de cycle inclus
}

export type Confidence = 'faible' | 'moyenne' | 'élevée';

export interface Prediction {
  meanLength: number;
  sd: number;
  windowStart: string; // ISO date
  windowEnd: string; // ISO date
  confidence: Confidence;
  basedOn: number; // nombre de cycles clos utilisés
  lastStart: string | null; // ISO date du cycle courant, null en mode découverte
}

export type PhaseTimingStatus = 'current' | 'upcoming' | 'next';

export interface PhaseTiming {
  status: PhaseTimingStatus;
  start: string; // ISO — début de la phase (cycle courant, ou projeté sur le suivant)
  end: string; // ISO — fin de la phase, même ancrage
}

export interface Pattern {
  symptomId: string;
  mode: 'fromStart' | 'beforePeriod';
  day: number; // Jn depuis le début, ou n pour J-n avant les règles
  count: number; // cycles où le pattern est présent
  total: number; // cycles clos considérés
  phase: PhaseKey;
}
