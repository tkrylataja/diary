// Чиста математика графіка динаміки (SPEC §6.4): шкали, поділки й референсна смуга.

const DAY = 24 * 60 * 60 * 1000;

export function dateToTime(date: string): number {
  return Date.UTC(
    Number(date.slice(0, 4)),
    Number(date.slice(5, 7)) - 1,
    Number(date.slice(8, 10)),
  );
}

/** «Гарний» крок шкали: 1, 2, 2.5 або 5 × 10^n. */
function niceStep(raw: number): number {
  const power = 10 ** Math.floor(Math.log10(raw));
  const fraction = raw / power;
  const nice =
    fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
  return nice * power;
}

/** Поділки осі Y від нуля до значення не менше max (SPEC: нуль на початку). */
export function yTicks(max: number, target = 4): number[] {
  if (!(max > 0)) return [0, 1];
  const step = niceStep(max / target);
  const ticks: number[] = [];
  for (let v = 0; v < max + step * 0.999; v += step) {
    ticks.push(Number(v.toFixed(10)));
  }
  return ticks;
}

/** Межі осі часу з невеликим запасом, щоб крайні точки не лежали на краю. */
export function timeDomain(times: number[]): [number, number] {
  const min = Math.min(...times);
  const max = Math.max(...times);
  if (min === max) return [min - 30 * DAY, max + 30 * DAY];
  const pad = (max - min) * 0.04;
  return [min - pad, max + pad];
}

/** Чи підписувати вісь часу роками (інакше — місяцями). */
export function isYearScale([t0, t1]: [number, number]): boolean {
  return (t1 - t0) / (365.25 * DAY) >= 1.5;
}

/** Поділки осі X: роки, а для коротких проміжків — місяці. Повертає дати YYYY-MM-01. */
export function timeTicks([t0, t1]: [number, number], maxTicks = 8): string[] {
  const start = new Date(t0);
  const end = new Date(t1);
  if (isYearScale([t0, t1])) {
    const firstYear =
      start.getUTCFullYear() + (start.getUTCMonth() === 0 && start.getUTCDate() === 1 ? 0 : 1);
    const lastYear = end.getUTCFullYear();
    const step = Math.max(1, Math.ceil((lastYear - firstYear + 1) / maxTicks));
    const ticks: string[] = [];
    for (let y = firstYear; y <= lastYear; y += step) ticks.push(`${y}-01-01`);
    return ticks;
  }

  const months = Math.max(1, Math.round(((t1 - t0) / (365.25 * DAY)) * 12));
  const step = [1, 2, 3, 6].find((s) => months / s <= maxTicks) ?? 6;
  const ticks: string[] = [];
  // Лічимо місяці як y * 12 + m, щоб не переносити рік вручну.
  const first = start.getUTCFullYear() * 12 + start.getUTCMonth();
  const last = end.getUTCFullYear() * 12 + end.getUTCMonth();
  for (let k = first; k <= last; k++) {
    const y = Math.floor(k / 12);
    const m = k % 12;
    if (m % step !== 0 || Date.UTC(y, m, 1) < t0) continue;
    ticks.push(`${y}-${String(m + 1).padStart(2, '0')}-01`);
  }
  return ticks;
}

/**
 * Горизонтальні межі смуги референсу для кожної точки: від середини до попередньої
 * точки до середини до наступної. Крайні — на halfWidth від точки в межах [left, right].
 */
export function bandSpans(
  xs: number[],
  left: number,
  right: number,
  halfWidth = 14,
): { x0: number; x1: number }[] {
  return xs.map((x, i) => {
    const prev = xs[i - 1];
    const next = xs[i + 1];
    const x0 = prev === undefined ? Math.max(left, x - halfWidth) : (prev + x) / 2;
    const x1 = next === undefined ? Math.min(right, x + halfWidth) : (x + next) / 2;
    return { x0, x1 };
  });
}

/** Початки місяців у межах осі (для дрібних поділок); крок 1, 3 або 6 місяців, щоб не злипалися. */
export function monthTicks([t0, t1]: [number, number], plotWidth: number, minGap = 8): string[] {
  const start = new Date(t0);
  const end = new Date(t1);
  const first = start.getUTCFullYear() * 12 + start.getUTCMonth();
  const last = end.getUTCFullYear() * 12 + end.getUTCMonth();
  const pxPerMonth = plotWidth / Math.max(1, (t1 - t0) / (30.44 * DAY));
  const step = [1, 3, 6].find((s) => s * pxPerMonth >= minGap) ?? 12;
  const ticks: string[] = [];
  for (let k = first; k <= last; k++) {
    const y = Math.floor(k / 12);
    const m = k % 12;
    if (m % step !== 0 || Date.UTC(y, m, 1) < t0) continue;
    ticks.push(`${y}-${String(m + 1).padStart(2, '0')}-01`);
  }
  return ticks;
}

/**
 * Де ставити підпис значення: над точкою, а якщо він налазить на підпис сусідньої
 * точки (по горизонталі близько й по висоті поруч) — під точкою.
 */
export function labelPlacements(
  points: { x: number; y: number; width: number }[],
  lineHeight = 16,
): ('above' | 'below')[] {
  const placed: { left: number; right: number; y: number }[] = [];
  return points.map((p) => {
    const box = (dy: number) => ({
      left: p.x - p.width / 2,
      right: p.x + p.width / 2,
      y: p.y + dy,
    });
    const clashes = (b: { left: number; right: number; y: number }) =>
      placed.some(
        (q) => b.left < q.right + 2 && q.left < b.right + 2 && Math.abs(b.y - q.y) < lineHeight,
      );
    const above = box(-12);
    if (!clashes(above)) {
      placed.push(above);
      return 'above';
    }
    const below = box(20);
    placed.push(below);
    return 'below';
  });
}
