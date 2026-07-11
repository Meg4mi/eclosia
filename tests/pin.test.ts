import { describe, expect, it } from 'vitest';
import { createPinRecord, isValidPin, verifyPin } from '@/lib/pin';

describe('verrou local', () => {
  it('aller-retour : le bon code passe, le mauvais non', async () => {
    const record = await createPinRecord('4321');
    expect(await verifyPin('4321', record)).toBe(true);
    expect(await verifyPin('1234', record)).toBe(false);
    expect(await verifyPin('43210', record)).toBe(false);
  });

  it('le code n’est jamais stocké en clair, salt aléatoire', async () => {
    const a = await createPinRecord('123456');
    const b = await createPinRecord('123456');
    expect(a.pinHash).not.toContain('123456');
    expect(a.pinSalt).not.toBe(b.pinSalt);
    expect(a.pinHash).not.toBe(b.pinHash);
  });

  it('format : 4 à 8 chiffres', () => {
    expect(isValidPin('1234')).toBe(true);
    expect(isValidPin('12345678')).toBe(true);
    expect(isValidPin('123')).toBe(false);
    expect(isValidPin('123456789')).toBe(false);
    expect(isValidPin('12a4')).toBe(false);
  });
});
