import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, DEFAULT_SETTINGS } from '@/lib/db';
import {
  eraseAll,
  mergeImport,
  setFlow,
  setNote,
  startFirstCycle,
  toggleSymptom,
} from '@/lib/logbook';
import { addDays } from '@/lib/dates';

beforeEach(async () => {
  await db.cycles.clear();
  await db.logs.clear();
  await db.settings.clear();
  await db.settings.put(DEFAULT_SETTINGS);
});

describe('setFlow — ouverture et extension de cycles', () => {
  it('premier flow > 0 sans cycle existant : ouvre un cycle', async () => {
    await setFlow('2026-06-01', 2);
    const cycles = await db.cycles.toArray();
    expect(cycles).toHaveLength(1);
    expect(cycles[0]?.startDate).toBe('2026-06-01');
    expect(cycles[0]?.endDate).toBe('2026-06-01');
  });

  it('flow ≤ 10 j après le dernier start : étend les règles courantes', async () => {
    await setFlow('2026-06-01', 2);
    await setFlow('2026-06-03', 1);
    const cycles = await db.cycles.toArray();
    expect(cycles).toHaveLength(1);
    expect(cycles[0]?.endDate).toBe('2026-06-03');
  });

  it('signale le rebase de cadran : nouveau cycle alors qu’un cycle courait', async () => {
    expect((await setFlow('2026-06-01', 2)).newCycleStarted).toBe(false); // premier cycle : J1 attendu
    expect((await setFlow('2026-06-03', 1)).newCycleStarted).toBe(false); // extension des règles
    expect((await setFlow('2026-06-29', 2)).newCycleStarted).toBe(true); // rebase → l'UI propose d'annuler
    expect((await setFlow('2026-06-29', 3)).newCycleStarted).toBe(false); // simple changement d'intensité
  });

  it('flow > 10 j après le dernier start : nouveau cycle + clôture du précédent', async () => {
    await setFlow('2026-06-01', 2);
    await setFlow('2026-06-29', 3);
    const cycles = (await db.cycles.toArray()).sort((a, b) =>
      a.startDate.localeCompare(b.startDate),
    );
    expect(cycles).toHaveLength(2);
    expect(cycles[0]?.lengthDays).toBe(28); // start suivant − start
    expect(cycles[1]?.startDate).toBe('2026-06-29');
    expect(cycles[1]?.lengthDays).toBeUndefined();
  });

  it('flow rétroactif ≤ 10 j avant un start connu : avance le start du cycle', async () => {
    await startFirstCycle('2026-06-03');
    await setFlow('2026-06-01', 1);
    const cycles = await db.cycles.toArray();
    expect(cycles).toHaveLength(1);
    expect(cycles[0]?.startDate).toBe('2026-06-01');
  });

  it('repasser le seul jour de règles à 0 retire le cycle (saisie erronée)', async () => {
    await setFlow('2026-06-01', 1);
    await setFlow('2026-06-01', 0);
    expect(await db.cycles.count()).toBe(0);
    const log = await db.logs.get('2026-06-01');
    expect(log?.flow).toBe(0);
  });

  it('recalcule avgPeriodLength depuis les règles observées', async () => {
    for (let i = 0; i < 4; i++) await setFlow(addDays('2026-06-01', i), 2);
    const settings = await db.settings.get('singleton');
    expect(settings?.avgPeriodLength).toBe(4);
  });
});

describe('toggleSymptom', () => {
  it('ajoute puis retire, sans toucher au flow', async () => {
    await setFlow('2026-06-01', 2);
    await toggleSymptom('2026-06-01', 'cramps');
    expect((await db.logs.get('2026-06-01'))?.symptoms).toEqual(['cramps']);
    await toggleSymptom('2026-06-01', 'fatigue');
    await toggleSymptom('2026-06-01', 'cramps');
    const log = await db.logs.get('2026-06-01');
    expect(log?.symptoms).toEqual(['fatigue']);
    expect(log?.flow).toBe(2);
  });

  it('crée le log du jour à la volée', async () => {
    await toggleSymptom('2026-06-10', 'calm');
    const log = await db.logs.get('2026-06-10');
    expect(log?.flow).toBe(0);
    expect(log?.symptoms).toEqual(['calm']);
  });

  it('écritures concurrentes symptôme + note : rien ne se perd (lost update)', async () => {
    // la course qui a fait tomber la CI : toggle et note lancés sans attente,
    // leurs get/put doivent être atomiques sinon l'un écrase l'autre
    await Promise.all([
      toggleSymptom('2026-06-11', 'headache'),
      setNote('2026-06-11', 'note du soir'),
      toggleSymptom('2026-06-11', 'fatigue'),
    ]);
    const log = await db.logs.get('2026-06-11');
    expect(log?.symptoms).toContain('headache');
    expect(log?.symptoms).toContain('fatigue');
    expect(log?.note).toBe('note du soir');
  });
});

describe('startFirstCycle / eraseAll', () => {
  it('ne crée le premier cycle qu’une fois', async () => {
    await startFirstCycle('2026-06-01');
    await startFirstCycle('2026-06-05');
    expect(await db.cycles.count()).toBe(1);
  });

  it('eraseAll vide tout', async () => {
    await setFlow('2026-06-01', 2);
    await toggleSymptom('2026-06-01', 'cramps');
    await eraseAll();
    expect(await db.cycles.count()).toBe(0);
    expect(await db.logs.count()).toBe(0);
    expect(await db.settings.count()).toBe(0);
  });
});

describe('mergeImport — fusion sans écrasement', () => {
  it('un log local existant gagne toujours sur l’import', async () => {
    await setFlow('2026-06-01', 2);
    await mergeImport({
      cycles: [],
      logs: [{ date: '2026-06-01', flow: 3, symptoms: ['headache'] }],
    });
    const log = await db.logs.get('2026-06-01');
    expect(log?.flow).toBe(2);
    expect(log?.symptoms).toEqual([]);
  });

  it('appareil vierge : les réglages importés s’appliquent ; sinon le local gagne', async () => {
    await mergeImport({
      cycles: [{ id: 'i1', startDate: '2026-05-01' }],
      logs: [],
      settings: { locale: 'en', avgPeriodLength: 6 },
    });
    let settings = await db.settings.get('singleton');
    expect(settings?.locale).toBe('en');
    expect(settings?.avgPeriodLength).toBe(6);

    // second import sur données existantes : les réglages locaux sont conservés
    await mergeImport({
      cycles: [{ id: 'i2', startDate: '2026-06-01' }],
      logs: [],
      settings: { locale: 'fr', avgPeriodLength: 3 },
    });
    settings = await db.settings.get('singleton');
    expect(settings?.locale).toBe('en');
  });

  it('ajoute cycles et logs absents, déduplique par startDate, re-chaîne les longueurs', async () => {
    await startFirstCycle('2026-06-01');
    await mergeImport({
      cycles: [
        { id: 'imp1', startDate: '2026-05-04', lengthDays: 99 },
        { id: 'imp2', startDate: '2026-06-01' }, // doublon → ignoré
      ],
      logs: [{ date: '2026-05-05', flow: 1, symptoms: [] }],
    });
    const cycles = (await db.cycles.toArray()).sort((a, b) =>
      a.startDate.localeCompare(b.startDate),
    );
    expect(cycles).toHaveLength(2);
    expect(cycles[0]?.lengthDays).toBe(28); // re-chaîné, le 99 importé est corrigé
    expect((await db.logs.get('2026-05-05'))?.flow).toBe(1);
  });
});
