import { describe, expect, it } from 'vitest';
import { decryptExport, encryptExport, PBKDF2_ITERATIONS } from '@/lib/crypto';

const SAMPLE = {
  cycles: [{ id: 'c1', startDate: '2026-06-01', lengthDays: 28 }],
  logs: [{ date: '2026-06-01', flow: 2 as const, symptoms: ['cramps'] }],
  settings: { locale: 'fr' as const },
};

describe('export / import chiffré', () => {
  it('aller-retour avec la bonne passphrase', async () => {
    const raw = await encryptExport(SAMPLE, 'une phrase très secrète');
    const back = await decryptExport(raw, 'une phrase très secrète');
    expect(back).toEqual(SAMPLE);
  });

  it('≥ 300k itérations PBKDF2, salt et iv aléatoires embarqués', async () => {
    expect(PBKDF2_ITERATIONS).toBeGreaterThanOrEqual(300_000);
    const a = JSON.parse(await encryptExport(SAMPLE, 'x')) as Record<string, string>;
    const b = JSON.parse(await encryptExport(SAMPLE, 'x')) as Record<string, string>;
    expect(a.salt).not.toBe(b.salt);
    expect(a.iv).not.toBe(b.iv);
    expect(a.data).not.toBe(b.data);
    expect(a.kdf).toBe('PBKDF2-SHA256');
  });

  it('le contenu chiffré ne laisse fuiter aucune donnée en clair', async () => {
    const raw = await encryptExport(SAMPLE, 'passphrase');
    expect(raw).not.toContain('2026-06-01');
    expect(raw).not.toContain('cramps');
  });

  it('mauvaise passphrase → erreur, jamais de données partielles', async () => {
    const raw = await encryptExport(SAMPLE, 'bonne phrase');
    await expect(decryptExport(raw, 'mauvaise phrase')).rejects.toThrow();
  });

  it('fichier invalide → erreur claire', async () => {
    await expect(decryptExport('{"app":"autre"}', 'x')).rejects.toThrow();
    await expect(decryptExport('pas du json', 'x')).rejects.toThrow();
  });
});
