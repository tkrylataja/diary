import type { Panel, Result } from './types';

/**
 * Статус результату рахується на льоту (SPEC §5).
 * unknown — немає числового значення або числового референсу.
 */
export type Status = 'normal' | 'high' | 'low' | 'unknown';

export function resultStatus(r: Result): Status {
  if (r.value === undefined) return 'unknown';
  if (r.refLow === undefined && r.refHigh === undefined) return 'unknown';
  if (r.refHigh !== undefined && r.value > r.refHigh) return 'high';
  if (r.refLow !== undefined && r.value < r.refLow) return 'low';
  return 'normal';
}

export function isOutOfRange(r: Result): boolean {
  const s = resultStatus(r);
  return s === 'high' || s === 'low';
}

export function outOfRangeCount(panel: Panel): number {
  return panel.results.filter(isOutOfRange).length;
}

/** Стрілка для значення поза нормою (колір не єдина ознака, SPEC §7). */
export function statusArrow(status: Status): '↑' | '↓' | '' {
  if (status === 'high') return '↑';
  if (status === 'low') return '↓';
  return '';
}
