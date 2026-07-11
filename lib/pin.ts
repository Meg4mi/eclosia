/**
 * Verrou local : le code n'est jamais stocké, seul un hash PBKDF2 (SHA-256,
 * salt aléatoire) l'est. Menace couverte : quelqu'un qui a le téléphone
 * déverrouillé en main — pas une attaque hors-ligne sur l'appareil.
 */

const PIN_ITERATIONS = 100_000;

const toB64 = (buf: ArrayBuffer): string => {
  let s = '';
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s);
};

const fromB64 = (s: string): Uint8Array => {
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
};

const derive = async (pin: string, salt: Uint8Array): Promise<string> => {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: PIN_ITERATIONS, hash: 'SHA-256' },
    material,
    256,
  );
  return toB64(bits);
};

export interface PinRecord {
  pinHash: string;
  pinSalt: string;
}

export const createPinRecord = async (pin: string): Promise<PinRecord> => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { pinHash: await derive(pin, salt), pinSalt: toB64(salt.buffer as ArrayBuffer) };
};

export const verifyPin = async (pin: string, record: PinRecord): Promise<boolean> =>
  (await derive(pin, fromB64(record.pinSalt))) === record.pinHash;

export const isValidPin = (pin: string): boolean => /^\d{4,8}$/.test(pin);
