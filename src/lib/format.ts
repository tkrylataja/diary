const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * «22.01.2026» — числовий формат день.місяць.рік, зрозумілий лікарям в Україні й Європі.
 * Рядок YYYY-MM-DD читається як календарна дата, без часових поясів.
 */
export function formatDate(date: Date | string): string {
  if (typeof date === 'string') {
    const [y, m, d] = date.split('-').map(Number);
    return `${pad2(d ?? 1)}.${pad2(m ?? 1)}.${y}`;
  }
  return `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}.${date.getFullYear()}`;
}

/** 26.9 → «26,9». Десятковий роздільник — кома (SPEC §5). */
export function formatNumber(n: number): string {
  return String(n).replace('.', ',').replace('-', '−');
}

/**
 * Розбирає число з поля вводу: приймає і кому, і крапку, пробіли між розрядами.
 * Повертає undefined, якщо це не число (тоді значення йде як текст).
 */
export function parseDecimal(input: string): number | undefined {
  const s = input.trim().replace(/\s/g, '').replace(/^[−–]/, '-').replace(',', '.');
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(s)) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

/** «4,79–23,3», «≥ 4,79», «≤ 23,3», або текстовий референс. */
export function formatRef(r: { refLow?: number; refHigh?: number; refText?: string }): string {
  const { refLow, refHigh, refText } = r;
  if (refLow !== undefined && refHigh !== undefined) {
    return `${formatNumber(refLow)}–${formatNumber(refHigh)}`;
  }
  if (refLow !== undefined) return `≥ ${formatNumber(refLow)}`;
  if (refHigh !== undefined) return `≤ ${formatNumber(refHigh)}`;
  return refText?.trim() ?? '';
}

/** Числове значення з комою або текстове («<0.5», «негативний»). */
export function formatValue(r: { value?: number; valueText?: string }): string {
  if (r.value !== undefined) return formatNumber(r.value);
  return r.valueText?.trim() ?? '';
}

/** «22.01» для плитки дати в списку (рік — у заголовку групи). */
export function formatDayMonth(date: string): string {
  return `${date.slice(8, 10)}.${date.slice(5, 7)}`;
}

/** «01.2026» для підписів осі часу. */
export function formatMonthYear(date: string): string {
  return `${date.slice(5, 7)}.${date.slice(0, 4)}`;
}

/**
 * Українська множина: plural(1, ['запис', 'записи', 'записів']) → «запис»,
 * 3 → «записи», 5 → «записів», 21 → «запис».
 */
export function plural(n: number, [one, few, many]: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

/** «7 записів». */
export function countLabel(n: number, forms: [string, string, string]): string {
  return `${n} ${plural(n, forms)}`;
}

export const RECORD_FORMS: [string, string, string] = ['запис', 'записи', 'записів'];
export const ANALYTE_FORMS: [string, string, string] = ['показник', 'показники', 'показників'];

/** Сьогоднішня дата за місцевим часом у форматі YYYY-MM-DD. */
export function todayIso(now: Date = new Date()): string {
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${m}-${d}`;
}

/** «13.11.2026, 12:57». */
export function formatDateTime(d: Date): string {
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${formatDate(d)}, ${time}`;
}
