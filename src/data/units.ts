// Перерахунок одиниць для «Динаміки» (напр. пролактин: 1 ng/mL = 21,2 mIU/L).
// Значення в базі завжди лишаються такими, як у бланку; перерахунок лише для показу.
import { formatRef, formatValue, parseDecimal } from '../lib/format';
import type { SeriesPoint } from './selectors';
import type { Analyte, Result, UnitConversion } from './types';

/** Ключ одиниці для порівняння: без регістру й пробілів, грецька μ = знак мікро µ. */
export function unitKey(unit: string | undefined): string {
  return (unit ?? '').trim().toLowerCase().replace(/\s+/g, '').replace(/μ/g, 'µ');
}

export function sameUnit(a: string | undefined, b: string | undefined): boolean {
  return unitKey(a) === unitKey(b);
}

/** Скільки одиниць `unit` в 1 основній одиниці показника; undefined — невідомо. */
function factorFor(analyte: Analyte, unit: string | undefined): number | undefined {
  if (!analyte.defaultUnit || !unit) return undefined;
  if (sameUnit(unit, analyte.defaultUnit)) return 1;
  return analyte.conversions?.find((c) => sameUnit(c.unit, unit))?.factor;
}

/** Множник для переходу з `from` у `to`; undefined — коефіцієнта немає. */
export function conversionRatio(
  analyte: Analyte,
  from: string | undefined,
  to: string | undefined,
): number | undefined {
  if (sameUnit(from, to)) return 1;
  const a = factorFor(analyte, from);
  const b = factorFor(analyte, to);
  return a && b ? b / a : undefined;
}

/** Округлення перерахованих значень: чим більше число, тим менше знаків після коми. */
export function roundConverted(n: number): number {
  const digits = Math.abs(n) >= 1000 ? 0 : Math.abs(n) >= 100 ? 1 : 2;
  return Number(n.toFixed(digits));
}

/** Одиниці, в яких можна показати показник: основна, потім додаткові з коефіцієнтами. */
export function availableUnits(analyte: Analyte, points: SeriesPoint[]): string[] {
  const units: string[] = [];
  const add = (u: string | undefined) => {
    const t = u?.trim();
    if (t && !units.some((x) => sameUnit(x, t))) units.push(t);
  };
  if (analyte.defaultUnit) {
    add(analyte.defaultUnit);
    analyte.conversions?.forEach((c) => add(c.unit));
  }
  points.forEach((p) => add(p.result.unit));
  return units;
}

export type ShownResult = {
  value?: number;
  valueText?: string;
  refLow?: number;
  refHigh?: number;
  refText?: string;
  unit?: string;
  /** Значення перераховане з інших одиниць. */
  converted: boolean;
  /** Чи вдалося показати в потрібних одиницях. */
  convertible: boolean;
  /** Оригінал із бланка, якщо значення перераховане. */
  original?: { value: string; unit?: string; ref: string };
};

/** Результат у потрібних одиницях. Записи без одиниць вважаються в основних. */
export function showIn(result: Result, analyte: Analyte, unit: string | undefined): ShownResult {
  const from = result.unit?.trim() || analyte.defaultUnit;
  const base: ShownResult = {
    value: result.value,
    valueText: result.valueText,
    refLow: result.refLow,
    refHigh: result.refHigh,
    refText: result.refText,
    unit: from,
    converted: false,
    convertible: true,
  };
  if (!unit || sameUnit(from, unit)) return base;

  const k = conversionRatio(analyte, from, unit);
  if (k === undefined) return { ...base, convertible: false };

  const scale = (n: number | undefined) => (n === undefined ? undefined : roundConverted(n * k));
  return {
    ...base,
    value: scale(result.value),
    refLow: scale(result.refLow),
    refHigh: scale(result.refHigh),
    unit,
    converted: true,
    original: {
      value: formatValue(result),
      unit: from,
      ref: formatRef(result),
    },
  };
}

/** Норма над списком: з останнього аналізу та інші діапазони (у потрібних одиницях). */
export function normSummary(
  points: SeriesPoint[],
  analyte: Analyte,
  unit: string | undefined,
): { latest?: { ref: string; date: string }; others: string[] } {
  const refs = [...points]
    .reverse()
    .map((p) => ({ date: p.panel.date, shown: showIn(p.result, analyte, unit) }))
    .filter(({ shown }) => shown.convertible)
    .map(({ date, shown }) => ({ date, ref: formatRef(shown) }))
    .filter((r) => r.ref);
  const [latest, ...rest] = refs;
  const others = [...new Set(rest.map((r) => r.ref))].filter((r) => r !== latest?.ref);
  return { latest, others };
}

export type ConversionRow = { key: string; unit: string; factor: string };

/**
 * Перевіряє рядки «1 основна = factor unit» з редактора показника.
 * Порожні рядки ігноруються.
 */
export function parseConversions(
  defaultUnit: string,
  rows: ConversionRow[],
): { conversions: UnitConversion[]; error?: string } {
  const filled = rows.filter((r) => r.unit.trim() || r.factor.trim());
  if (filled.length === 0) return { conversions: [] };
  if (!defaultUnit.trim()) {
    return { conversions: [], error: 'Спершу вкажіть основні одиниці, від яких рахувати.' };
  }
  const conversions: UnitConversion[] = [];
  for (const row of filled) {
    const unit = row.unit.trim();
    const factor = parseDecimal(row.factor);
    if (!unit) return { conversions: [], error: 'Вкажіть назву одиниці для кожного коефіцієнта.' };
    if (factor === undefined || factor <= 0) {
      return { conversions: [], error: `Коефіцієнт для «${unit}» має бути додатним числом.` };
    }
    if (sameUnit(unit, defaultUnit) || conversions.some((c) => sameUnit(c.unit, unit))) {
      return { conversions: [], error: `Одиниця «${unit}» повторюється.` };
    }
    conversions.push({ unit, factor });
  }
  return { conversions };
}
