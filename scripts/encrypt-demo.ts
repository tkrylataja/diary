// Створює demo/data.enc із вигаданих демо-даних (SPEC §11). Пароль: demo-demo-demo.
// Запуск: npm run demo:encrypt
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { encrypt } from '../src/crypto/crypto.ts';
import { parseDb } from '../src/data/validate.ts';

const DEMO_PASSWORD = 'demo-demo-demo';

const root = new URL('../demo/', import.meta.url);
const db = parseDb(JSON.parse(readFileSync(new URL('demo-data.json', root), 'utf8')));
const file = await encrypt(db, DEMO_PASSWORD);
const out = fileURLToPath(new URL('data.enc', root));
writeFileSync(out, JSON.stringify(file) + '\n');
console.log(`Записано ${out}: ${db.panels.length} записів, ${db.analytes.length} показників.`);
