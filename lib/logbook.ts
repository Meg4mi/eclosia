/**
 * Règles métier d'écriture (§4) :
 * - un flow > 0 sur un jour non couvert ouvre un nouveau cycle si le dernier
 *   start date de plus de 10 jours ; sinon il étend les règles courantes ;
 * - la clôture d'un cycle (nouveau start) calcule lengthDays du précédent ;
 * - toute écriture est optimiste : l'UI n'attend jamais IndexedDB.
 */

import { ulid } from 'ulid';
import { db, DEFAULT_SETTINGS } from './db';
import { addDays, diffDays } from './dates';
import { observedPeriodLength } from './period';
import type { Cycle, DailyLog, Flow } from './types';

const EXTEND_MAX_DAYS = 10;

let persistRequested = false;
/** Demandé au premier log — jamais bloquant. */
export const requestPersistence = (): void => {
  if (persistRequested || typeof navigator === 'undefined' || !navigator.storage?.persist) return;
  persistRequested = true;
  void navigator.storage.persist().catch(() => undefined);
};

const sortedCycles = async (): Promise<Cycle[]> => {
  const all = await db.cycles.toArray();
  return all.sort((a, b) => a.startDate.localeCompare(b.startDate));
};

/** Recalcule lengthDays de proche en proche (chaque cycle : start suivant − start). */
const rechainLengths = async (): Promise<void> => {
  const cycles = await sortedCycles();
  for (let i = 0; i < cycles.length; i++) {
    const c = cycles[i] as Cycle;
    const next = cycles[i + 1];
    const lengthDays = next ? diffDays(c.startDate, next.startDate) : undefined;
    if (lengthDays !== c.lengthDays) {
      await db.cycles.update(c.id, { lengthDays });
    }
  }
};

/** Durée de règles observée — médiane des durées confirmées (lib/period.ts) :
 * une durée ne compte que si un log ultérieur du même cycle prouve que la
 * saisie a continué après le flow (une saisie abandonnée à J2 ne doit pas
 * faire passer des règles écourtées pour la vérité). */
const recomputeAvgPeriod = async (): Promise<void> => {
  const cycles = await sortedCycles();
  const logs = await db.logs.toArray();
  const observed = observedPeriodLength(cycles, logs);
  // aucune durée confirmée : on ne touche pas au réglage (défaut ou importé)
  if (observed === null) return;
  const settings = await db.settings.get('singleton');
  if (settings && settings.avgPeriodLength !== observed) {
    await db.settings.update('singleton', { avgPeriodLength: observed });
  }
};

/** Dernier jour de règles connu d'un cycle, d'après les logs. */
const lastFlowDay = async (cycle: Cycle): Promise<string | undefined> => {
  const horizon = addDays(cycle.startDate, EXTEND_MAX_DAYS);
  const logs = await db.logs
    .where('date')
    .between(cycle.startDate, horizon, true, true)
    .toArray();
  const flowDays = logs
    .filter((l) => l.flow > 0)
    .map((l) => l.date)
    .sort();
  return flowDays[flowDays.length - 1];
};

/** @returns true si un nouveau cycle a été ouvert alors qu'un cycle courait déjà
 * (le cadran rebase alors sur J1 — l'UI doit le dire et proposer d'annuler). */
const applyFlowToCycles = async (date: string): Promise<boolean> => {
  const cycles = await sortedCycles();
  const prev = [...cycles].reverse().find((c) => c.startDate <= date);
  const next = cycles.find((c) => c.startDate > date);
  let rebased = false;

  if (prev && diffDays(prev.startDate, date) <= EXTEND_MAX_DAYS) {
    // règles courantes : on étend
    if (!prev.endDate || prev.endDate < date) {
      await db.cycles.update(prev.id, { endDate: date });
    }
  } else if (next && diffDays(date, next.startDate) <= EXTEND_MAX_DAYS) {
    // correction rétroactive : ces règles ont en fait commencé plus tôt
    await db.cycles.update(next.id, { startDate: date });
  } else {
    await db.cycles.add({ id: ulid(), startDate: date, endDate: date });
    rebased = prev !== undefined && next === undefined;
  }
  await rechainLengths();
  await recomputeAvgPeriod();
  return rebased;
};

const retractFlowFromCycles = async (date: string): Promise<void> => {
  const cycles = await sortedCycles();
  const cycle = [...cycles].reverse().find((c) => c.startDate <= date);
  if (!cycle) return;

  const remaining = await lastFlowDay(cycle);
  if (cycle.startDate === date && !remaining) {
    // seul jour de règles du cycle : la saisie était une erreur, on retire le cycle
    await db.cycles.delete(cycle.id);
  } else if (cycle.endDate === date) {
    await db.cycles.update(cycle.id, { endDate: remaining ?? cycle.startDate });
  }
  await rechainLengths();
  await recomputeAvgPeriod();
};

export interface SetFlowResult {
  /** Un nouveau cycle vient de s'ouvrir à cette date (le cadran rebase sur J1). */
  newCycleStarted: boolean;
}

/** Écrit le flow d'un jour et met les cycles en cohérence. */
export const setFlow = async (date: string, flow: Flow): Promise<SetFlowResult> => {
  requestPersistence();
  return db.transaction('rw', db.cycles, db.logs, db.settings, async () => {
    const existing = await db.logs.get(date);
    const hadFlow = (existing?.flow ?? 0) > 0;
    await db.logs.put({ date, flow, symptoms: existing?.symptoms ?? [], note: existing?.note });
    let newCycleStarted = false;
    if (flow > 0 && !hadFlow) newCycleStarted = await applyFlowToCycles(date);
    if (flow === 0 && hadFlow) await retractFlowFromCycles(date);
    if (flow > 0 && hadFlow) {
      // intensité modifiée : l'étendue des règles peut changer (ex. endDate)
      await applyFlowToCycles(date);
    }
    return { newCycleStarted };
  });
};

/** Note libre du jour — vide = retirée.
 * Lecture + écriture dans UNE transaction : deux écritures rapprochées
 * (ex. note tapée juste après un symptôme coché) ne s'écrasent jamais. */
export const setNote = async (date: string, note: string): Promise<void> => {
  requestPersistence();
  await db.transaction('rw', db.logs, async () => {
    const existing = await db.logs.get(date);
    await db.logs.put({
      date,
      flow: existing?.flow ?? 0,
      symptoms: existing?.symptoms ?? [],
      note: note.trim() === '' ? undefined : note,
    });
  });
};

export const toggleSymptom = async (date: string, symptomId: string): Promise<void> => {
  requestPersistence();
  await db.transaction('rw', db.logs, async () => {
    const existing = await db.logs.get(date);
    const symptoms = existing?.symptoms ?? [];
    const nextSymptoms = symptoms.includes(symptomId)
      ? symptoms.filter((s) => s !== symptomId)
      : [...symptoms, symptomId];
    await db.logs.put({
      date,
      flow: existing?.flow ?? 0,
      symptoms: nextSymptoms,
      note: existing?.note,
    });
  });
};

/** Onboarding : premier cycle connu. */
export const startFirstCycle = async (startDate: string): Promise<void> => {
  await db.transaction('rw', db.cycles, db.logs, db.settings, async () => {
    const count = await db.cycles.count();
    if (count > 0) return;
    await db.cycles.add({ id: ulid(), startDate });
  });
};

export const eraseAll = async (): Promise<void> => {
  await db.transaction('rw', db.cycles, db.logs, db.settings, async () => {
    await db.cycles.clear();
    await db.logs.clear();
    await db.settings.clear();
  });
};

export type ImportPayload = {
  cycles: Cycle[];
  logs: DailyLog[];
  settings?: Partial<import('./types').Settings>;
};

/**
 * Fusion d'un import (§9) : jamais d'écrasement — les logs importés ne
 * remplacent pas un log local sur la même date ; les cycles sont dédupliqués
 * par startDate puis les longueurs re-chaînées.
 */
export const mergeImport = async (payload: ImportPayload): Promise<void> => {
  await db.transaction('rw', db.cycles, db.logs, db.settings, async () => {
    // import juste après un effacement : recréer le singleton de réglages
    if (!(await db.settings.get('singleton'))) await db.settings.put(DEFAULT_SETTINGS);
    const localStarts = new Set((await db.cycles.toArray()).map((c) => c.startDate));
    // restauration sur appareil vierge : les réglages importés s'appliquent ;
    // sinon les réglages locaux gagnent, comme les logs
    if (localStarts.size === 0 && payload.settings) {
      const current = (await db.settings.get('singleton')) ?? null;
      if (current) {
        const { locale, avgPeriodLength, reducedMotion } = payload.settings;
        await db.settings.put({
          ...current,
          ...(locale ? { locale } : null),
          ...(avgPeriodLength ? { avgPeriodLength } : null),
          ...(reducedMotion ? { reducedMotion } : null),
        });
      }
    }
    for (const cycle of payload.cycles) {
      if (!localStarts.has(cycle.startDate)) {
        await db.cycles.add({ ...cycle, id: cycle.id || ulid() });
        localStarts.add(cycle.startDate);
      }
    }
    for (const log of payload.logs) {
      const local = await db.logs.get(log.date);
      if (!local) await db.logs.put(log);
    }
    await rechainLengths();
    await recomputeAvgPeriod();
    // restaurer des données implique d'avoir déjà été onboardée :
    // ne pas reposer la question initiale après un import
    if (payload.cycles.length > 0 || payload.logs.length > 0) {
      const settings = await db.settings.get('singleton');
      if (settings && !settings.onboardedAt) {
        await db.settings.update('singleton', { onboardedAt: new Date().toISOString() });
      }
    }
  });
};
