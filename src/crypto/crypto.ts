// Шифрування бази паролем (SPEC §4). Лише Web Crypto API, без бібліотек.

export const KDF_NAME = 'PBKDF2-SHA256';
export const MIN_ITERATIONS = 600_000;
export const DEFAULT_ITERATIONS = 600_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

export type EncFile = {
  v: 1;
  kdf: typeof KDF_NAME;
  iter: number;
  salt: string;
  iv: string;
  ct: string;
};

export const DECRYPT_ERROR_MESSAGE = 'Неправильний пароль або файл пошкоджено';

/** Неправильний пароль або пошкоджений файл: ці випадки свідомо не розрізняються. */
export class DecryptError extends Error {
  constructor() {
    super(DECRYPT_ERROR_MESSAGE);
    this.name = 'DecryptError';
  }
}

/** Ключ, отриманий із пароля, разом із параметрами KDF, щоб перешифровувати без пароля. */
export type SessionKey = {
  key: CryptoKey;
  salt: Uint8Array<ArrayBuffer>;
  iter: number;
};

export function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(length));
}

export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function deriveKey(
  password: string,
  salt: Uint8Array<ArrayBuffer> = randomBytes(SALT_BYTES),
  iter: number = DEFAULT_ITERATIONS,
): Promise<SessionKey> {
  if (!Number.isInteger(iter) || iter < MIN_ITERATIONS) {
    throw new Error(`Кількість ітерацій PBKDF2 має бути не менше ${MIN_ITERATIONS}`);
  }
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
  return { key, salt, iter };
}

/** Шифрує дані вже отриманим ключем. Кожен виклик бере новий випадковий IV. */
export async function encryptWithKey(session: SessionKey, data: unknown): Promise<EncFile> {
  const iv = randomBytes(IV_BYTES);
  const plain = new TextEncoder().encode(JSON.stringify(data));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, session.key, plain);
  return {
    v: 1,
    kdf: KDF_NAME,
    iter: session.iter,
    salt: toBase64(session.salt),
    iv: toBase64(iv),
    ct: toBase64(new Uint8Array(ct)),
  };
}

export async function encrypt(data: unknown, password: string): Promise<EncFile> {
  return encryptWithKey(await deriveKey(password), data);
}

const B64 = /^[A-Za-z0-9+/]*={0,2}$/;

function isB64(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length % 4 === 0 && B64.test(value);
}

/** Перевіряє структуру файлу. Повертає null, якщо формат не той. */
export function parseEncFile(input: unknown): EncFile | null {
  let obj: unknown = input;
  if (typeof input === 'string') {
    try {
      obj = JSON.parse(input);
    } catch {
      return null;
    }
  }
  if (typeof obj !== 'object' || obj === null) return null;
  const f = obj as Record<string, unknown>;
  if (
    f.v !== 1 ||
    f.kdf !== KDF_NAME ||
    typeof f.iter !== 'number' ||
    !Number.isInteger(f.iter) ||
    f.iter < MIN_ITERATIONS ||
    !isB64(f.salt) ||
    !isB64(f.iv) ||
    !isB64(f.ct)
  ) {
    return null;
  }
  const salt = fromBase64(f.salt);
  const iv = fromBase64(f.iv);
  if (salt.length !== SALT_BYTES || iv.length !== IV_BYTES) return null;
  return { v: 1, kdf: KDF_NAME, iter: f.iter, salt: f.salt, iv: f.iv, ct: f.ct };
}

/**
 * Розшифровує файл. Повертає дані й ключ сесії, щоб потім зберігати зміни
 * без повторного введення пароля. Будь-яка помилка — DecryptError.
 */
export async function decrypt(
  input: unknown,
  password: string,
): Promise<{ data: unknown; session: SessionKey }> {
  const file = parseEncFile(input);
  if (!file) throw new DecryptError();
  try {
    const session = await deriveKey(password, fromBase64(file.salt), file.iter);
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(file.iv) },
      session.key,
      fromBase64(file.ct),
    );
    const data: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(plain));
    return { data, session };
  } catch {
    throw new DecryptError();
  }
}
