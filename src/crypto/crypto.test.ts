import { describe, expect, it } from 'vitest';
import {
  DECRYPT_ERROR_MESSAGE,
  DecryptError,
  MIN_ITERATIONS,
  decrypt,
  deriveKey,
  encrypt,
  encryptWithKey,
  fromBase64,
  parseEncFile,
  toBase64,
} from './crypto';

const PASSWORD = 'синій кит читає ранкову газету';
const SAMPLE = {
  version: 1,
  panels: [{ id: 'p1', date: '2024-03-04', results: [{ analyteId: 'prl', value: 26.9 }] }],
  analytes: [{ id: 'prl', name: 'Пролактин', synonyms: ['PRL'] }],
};

describe('crypto', () => {
  it('шифрує й розшифровує назад ті самі дані', async () => {
    const file = await encrypt(SAMPLE, PASSWORD);
    const { data } = await decrypt(file, PASSWORD);
    expect(data).toEqual(SAMPLE);
  });

  it('має формат із SPEC §4', async () => {
    const file = await encrypt(SAMPLE, PASSWORD);
    expect(file.v).toBe(1);
    expect(file.kdf).toBe('PBKDF2-SHA256');
    expect(file.iter).toBeGreaterThanOrEqual(600_000);
    expect(fromBase64(file.salt)).toHaveLength(16);
    expect(fromBase64(file.iv)).toHaveLength(12);
    expect(JSON.stringify(file)).not.toContain('Пролактин');
  });

  it('розшифровує файл, переданий як текст JSON', async () => {
    const file = await encrypt(SAMPLE, PASSWORD);
    const { data } = await decrypt(JSON.stringify(file), PASSWORD);
    expect(data).toEqual(SAMPLE);
  });

  it('неправильний пароль дає DecryptError із зрозумілим повідомленням', async () => {
    const file = await encrypt(SAMPLE, PASSWORD);
    const attempt = decrypt(file, 'інший пароль');
    await expect(attempt).rejects.toBeInstanceOf(DecryptError);
    await expect(attempt).rejects.toThrow(DECRYPT_ERROR_MESSAGE);
  });

  it('пошкоджений шифротекст дає DecryptError', async () => {
    const file = await encrypt(SAMPLE, PASSWORD);
    const ct = fromBase64(file.ct);
    ct[0] = (ct[0] ?? 0) ^ 0xff;
    await expect(decrypt({ ...file, ct: toBase64(ct) }, PASSWORD)).rejects.toBeInstanceOf(
      DecryptError,
    );
  });

  it('обрізаний або не-JSON файл дає DecryptError', async () => {
    const text = JSON.stringify(await encrypt(SAMPLE, PASSWORD));
    await expect(decrypt(text.slice(0, text.length / 2), PASSWORD)).rejects.toBeInstanceOf(
      DecryptError,
    );
    await expect(decrypt('<!doctype html>', PASSWORD)).rejects.toBeInstanceOf(DecryptError);
    await expect(decrypt('', PASSWORD)).rejects.toBeInstanceOf(DecryptError);
  });

  it('файл із неправильною структурою дає DecryptError', async () => {
    const file = await encrypt(SAMPLE, PASSWORD);
    const broken = [
      { ...file, v: 2 },
      { ...file, kdf: 'scrypt' },
      { ...file, iter: 1000 },
      { ...file, iv: toBase64(new Uint8Array(8)) },
      { ...file, salt: 'не base64!' },
      null,
      [],
    ];
    for (const b of broken) {
      await expect(decrypt(b, PASSWORD)).rejects.toBeInstanceOf(DecryptError);
    }
  });

  it('кожне шифрування бере новий IV (і нову сіль для нового пароля)', async () => {
    const a = await encrypt(SAMPLE, PASSWORD);
    const b = await encrypt(SAMPLE, PASSWORD);
    expect(a.iv).not.toBe(b.iv);
    expect(a.salt).not.toBe(b.salt);
    expect(a.ct).not.toBe(b.ct);
  });

  it('повторне збереження тим самим ключем сесії має нові IV й ту саму сіль', async () => {
    const session = await deriveKey(PASSWORD);
    const a = await encryptWithKey(session, SAMPLE);
    const b = await encryptWithKey(session, SAMPLE);
    expect(a.iv).not.toBe(b.iv);
    expect(a.salt).toBe(b.salt);
    const { data } = await decrypt(b, PASSWORD);
    expect(data).toEqual(SAMPLE);
  });

  it('ключ сесії з розшифрування дозволяє зберегти зміни без пароля', async () => {
    const { session } = await decrypt(await encrypt(SAMPLE, PASSWORD), PASSWORD);
    const updated = { ...SAMPLE, panels: [] };
    const { data } = await decrypt(await encryptWithKey(session, updated), PASSWORD);
    expect(data).toEqual(updated);
  });

  it('не дозволяє менше ітерацій, ніж мінімум', async () => {
    await expect(deriveKey(PASSWORD, undefined, MIN_ITERATIONS - 1)).rejects.toThrow();
  });

  it('parseEncFile повертає null для чужого JSON', () => {
    expect(parseEncFile('{"hello":"world"}')).toBeNull();
    expect(parseEncFile(42)).toBeNull();
  });
});
