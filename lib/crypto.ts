/**
 * Export / import chiffré (§9) : AES-GCM via Web Crypto, clé dérivée d'une
 * passphrase (PBKDF2, 300 000 itérations, salt aléatoire embarqué).
 * Aucune donnée ni passphrase ne quitte l'appareil.
 */

import type { Cycle, DailyLog, Settings } from './types';

export const PBKDF2_ITERATIONS = 300_000;
const FORMAT_VERSION = 1;

export interface ExportData {
  cycles: Cycle[];
  logs: DailyLog[];
  settings?: Partial<Settings>;
}

interface Envelope {
  app: 'eclose';
  v: number;
  kdf: 'PBKDF2-SHA256';
  iter: number;
  salt: string; // base64
  iv: string; // base64
  data: string; // base64 (AES-GCM)
}

const toB64 = (buf: ArrayBuffer | Uint8Array): string => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
};

const fromB64 = (s: string): Uint8Array => {
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
};

const deriveKey = async (
  passphrase: string,
  salt: Uint8Array,
  iterations: number,
): Promise<CryptoKey> => {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
};

export const encryptExport = async (data: ExportData, passphrase: string): Promise<string> => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, PBKDF2_ITERATIONS);
  const plaintext = new TextEncoder().encode(JSON.stringify(data));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    plaintext as BufferSource,
  );
  const envelope: Envelope = {
    app: 'eclose',
    v: FORMAT_VERSION,
    kdf: 'PBKDF2-SHA256',
    iter: PBKDF2_ITERATIONS,
    salt: toB64(salt),
    iv: toB64(iv),
    data: toB64(ciphertext),
  };
  return JSON.stringify(envelope);
};

/** Lève une erreur si la passphrase est fausse ou le fichier invalide. */
export const decryptExport = async (raw: string, passphrase: string): Promise<ExportData> => {
  const envelope = JSON.parse(raw) as Envelope;
  if (envelope.app !== 'eclose' || envelope.kdf !== 'PBKDF2-SHA256') {
    throw new Error('invalid file');
  }
  const key = await deriveKey(passphrase, fromB64(envelope.salt), envelope.iter);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(envelope.iv) as BufferSource },
    key,
    fromB64(envelope.data) as BufferSource,
  );
  const data = JSON.parse(new TextDecoder().decode(plaintext)) as ExportData;
  if (!Array.isArray(data.cycles) || !Array.isArray(data.logs)) throw new Error('invalid file');
  return data;
};
