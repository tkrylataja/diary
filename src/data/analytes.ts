import type { Analyte } from './types';

// Кириличні літери, що виглядають як латинські. Назви з бланків часто змішують
// абетки («Т4», «TSH», «Вітамін D»), тому для порівняння зводимо їх до латиниці.
const LOOKALIKES: Record<string, string> = {
  а: 'a',
  в: 'b',
  е: 'e',
  і: 'i',
  к: 'k',
  м: 'm',
  н: 'h',
  о: 'o',
  р: 'p',
  с: 'c',
  т: 't',
  у: 'y',
  х: 'x',
  // Польська «ł» не розкладається через NFKD.
  ł: 'l',
};

/**
 * Ключ для порівняння назв показників: без регістру, діакритики, розділових знаків
 * і пробілів, з кирилицею-двійниками, зведеною до латиниці.
 * «Вітамін D (25-OH)» і «вітамін d 25 oh» дають однаковий ключ.
 */
export function analyteKey(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/\p{M}/gu, '') // діакритика: «й» → «и», «ї» → «і», «ó» → «o»
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .replace(/./g, (ch) => LOOKALIKES[ch] ?? ch);
}

/** Усі назви показника: основна + синоніми. */
export function analyteNames(a: Analyte): string[] {
  return [a.name, ...a.synonyms];
}

/** Точний збіг назви з основною назвою або синонімом (для імпорту й об'єднання). */
export function findAnalyteByName(analytes: Analyte[], name: string): Analyte | undefined {
  const key = analyteKey(name);
  if (!key) return undefined;
  return analytes.find((a) => analyteNames(a).some((n) => analyteKey(n) === key));
}

/**
 * Пошук для автодоповнення: точний збіг, потім початок назви, потім входження.
 * Збіг з основною назвою вищий за збіг із синонімом.
 */
export function searchAnalytes(analytes: Analyte[], query: string): Analyte[] {
  const q = analyteKey(query);
  if (!q) return [...analytes].sort((a, b) => a.name.localeCompare(b.name, 'uk'));

  const scored: { a: Analyte; score: number }[] = [];
  for (const a of analytes) {
    let best = Infinity;
    analyteNames(a).forEach((n, i) => {
      const key = analyteKey(n);
      const rank = key === q ? 0 : key.startsWith(q) ? 1 : key.includes(q) ? 2 : Infinity;
      best = Math.min(best, rank * 2 + (i === 0 ? 0 : 1));
    });
    if (best < Infinity) scored.push({ a, score: best });
  }
  return scored
    .sort((x, y) => x.score - y.score || x.a.name.localeCompare(y.a.name, 'uk'))
    .map((s) => s.a);
}

/** Чи відповідає показник рядку пошуку (назва або синонім містить запит). */
export function analyteMatches(a: Analyte, query: string): boolean {
  const q = analyteKey(query);
  return !q || analyteNames(a).some((n) => analyteKey(n).includes(q));
}

/**
 * Назва з бланка, якщо вона відрізняється від основної (інакше undefined):
 * «як в аналізі: MCV» показується лише тоді, коли це щось додає.
 */
export function originalName(
  result: { nameOriginal?: string },
  analyte: Analyte | undefined,
): string | undefined {
  const original = result.nameOriginal?.trim();
  if (!original || (analyte && analyteKey(original) === analyteKey(analyte.name))) return undefined;
  return original;
}
