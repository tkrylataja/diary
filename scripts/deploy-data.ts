// Копіює найновіший data*.enc із папки «Завантаження» в public/data.enc (SPEC §9).
// Шлях до папки задається в .env.local: DOWNLOADS_DIR=/Users/ім'я/Downloads
// Запуск: npm run deploy-data
import { copyFileSync, existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEncFile } from '../src/crypto/crypto.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const target = join(root, 'public', 'data.enc');

function readEnvLocal(): Record<string, string> {
  const file = join(root, '.env.local');
  if (!existsSync(file)) return {};
  const env: Record<string, string> = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m?.[1]) env[m[1]] = (m[2] ?? '').replace(/^["']|["']$/g, '');
  }
  return env;
}

function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

const env = readEnvLocal();
let dir = env.DOWNLOADS_DIR?.replace(/^~(?=$|\/)/, homedir());
if (!dir) {
  dir = join(homedir(), 'Downloads');
  console.log(`DOWNLOADS_DIR не задано в .env.local, шукаю в ${dir}`);
}
if (!existsSync(dir)) fail(`Папки ${dir} не існує. Перевірте DOWNLOADS_DIR у .env.local.`);

// «data.enc», «data (1).enc», «data-2.enc» тощо.
const candidates = readdirSync(dir)
  .filter((name) => /^data.*\.enc$/i.test(name))
  .map((name) => ({ name, path: join(dir, name), mtime: statSync(join(dir, name)).mtime }))
  .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

const newest = candidates[0];
if (!newest) fail(`У ${dir} немає файлів data*.enc. Спершу натисніть «Завантажити data.enc».`);

const text = readFileSync(newest.path, 'utf8');
if (!parseEncFile(text))
  fail(`${newest.name} не схожий на зашифрований data.enc. Нічого не змінено.`);

if (existsSync(target) && readFileSync(target, 'utf8') === text) {
  console.log(`public/data.enc вже такий самий, як ${newest.name}. Нічого не змінено.`);
  process.exit(0);
}

copyFileSync(newest.path, target);
console.log(`✓ ${newest.name} (${newest.mtime.toLocaleString('uk-UA')}) → public/data.enc`);
console.log('\nДалі:');
console.log('  git status            # має бути змінено лише public/data.enc');
console.log('  git add public/data.enc');
console.log('  git commit -m "Аналізи <дата>"');
console.log('  git push');
