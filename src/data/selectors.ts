import { analyteKey, analyteMatches, originalName } from './analytes';
import type { Analyte, Db, Panel, Result } from './types';

export function analyteMap(analytes: Analyte[]): Map<string, Analyte> {
  return new Map(analytes.map((a) => [a.id, a]));
}

/** Від новіших до старіших. */
export function sortPanelsDesc(panels: Panel[]): Panel[] {
  return [...panels].sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}

/** Групує вже відсортовані записи за роком, зберігаючи порядок. */
export function groupPanelsByYear(panels: Panel[]): { year: string; panels: Panel[] }[] {
  const groups: { year: string; panels: Panel[] }[] = [];
  for (const panel of panels) {
    const year = panel.date.slice(0, 4);
    const last = groups[groups.length - 1];
    if (last?.year === year) last.panels.push(panel);
    else groups.push({ year, panels: [panel] });
  }
  return groups;
}

/** Пошук на головній: назва показника (з синонімами) або лабораторія. */
export function panelMatches(panel: Panel, query: string, analytes: Map<string, Analyte>): boolean {
  const q = analyteKey(query);
  if (!q) return true;
  if (panel.lab && analyteKey(panel.lab).includes(q)) return true;
  return panel.results.some((r) => {
    if (r.nameOriginal && analyteKey(r.nameOriginal).includes(q)) return true;
    const a = analytes.get(r.analyteId);
    return a !== undefined && analyteMatches(a, query);
  });
}

export const OTHER_GROUP = 'Інше';

/** Результати пакета, згруповані за групою показника; порядок груп — як у бланку. */
export function groupPanelResults(
  panel: Panel,
  analytes: Map<string, Analyte>,
): { group: string; items: { result: Result; analyte: Analyte }[] }[] {
  const groups = new Map<string, { result: Result; analyte: Analyte }[]>();
  for (const result of panel.results) {
    const analyte = analytes.get(result.analyteId);
    if (!analyte) continue;
    const group = analyte.group?.trim() || OTHER_GROUP;
    const list = groups.get(group) ?? [];
    list.push({ result, analyte });
    groups.set(group, list);
  }
  const entries = [...groups].map(([group, items]) => ({ group, items }));
  // «Інше» завжди в кінці.
  return [
    ...entries.filter((g) => g.group !== OTHER_GROUP),
    ...entries.filter((g) => g.group === OTHER_GROUP),
  ];
}

export type SeriesPoint = { panel: Panel; result: Result };

/** Усі результати показника від старіших до новіших. */
export function analyteSeries(db: Db, analyteId: string): SeriesPoint[] {
  return db.panels
    .flatMap((panel) =>
      panel.results.filter((r) => r.analyteId === analyteId).map((result) => ({ panel, result })),
    )
    .sort((a, b) => a.panel.date.localeCompare(b.panel.date));
}

export function recordCount(db: Db, analyteId: string): number {
  return db.panels.filter((p) => p.results.some((r) => r.analyteId === analyteId)).length;
}

export type UnitSummary = {
  /** Усі різні одиниці в записах. */
  units: string[];
  /** Основна одиниця: найчастіша; при рівності — одиниця за замовчуванням або найновіша. */
  main: string | undefined;
  consistent: boolean;
};

export function unitSummary(points: SeriesPoint[], defaultUnit?: string): UnitSummary {
  const counts = new Map<string, number>();
  for (const { result } of points) {
    const unit = result.unit?.trim();
    if (unit) counts.set(unit, (counts.get(unit) ?? 0) + 1);
  }
  const units = [...counts.keys()];
  const top = Math.max(0, ...counts.values());
  const leaders = units.filter((u) => counts.get(u) === top);
  let main: string | undefined;
  if (leaders.length === 1) main = leaders[0];
  else if (defaultUnit && leaders.includes(defaultUnit)) main = defaultUnit;
  else {
    main = [...points]
      .reverse()
      .map((p) => p.result.unit?.trim())
      .find((u) => u !== undefined && leaders.includes(u));
  }
  return { units, main, consistent: units.length <= 1 };
}

export type Period = '1y' | '3y' | 'all';

export const PERIODS: { id: Period; label: string }[] = [
  { id: '1y', label: '1 рік' },
  { id: '3y', label: '3 роки' },
  { id: 'all', label: 'Усе' },
];

export function parsePeriod(value: string | null): Period {
  return value === '1y' || value === '3y' ? value : 'all';
}

/** Перша дата періоду (включно) відносно сьогодні; для «Усе» — undefined. */
export function periodStart(period: Period, today: string): string | undefined {
  if (period === 'all') return undefined;
  const years = period === '1y' ? 1 : 3;
  return `${Number(today.slice(0, 4)) - years}${today.slice(4)}`;
}

/** Різні назви з бланків для показника (лише ті, що відрізняються від основної). */
export function originalNamesOf(db: Db, analyte: Analyte): string[] {
  const seen = new Map<string, string>();
  for (const p of db.panels) {
    for (const r of p.results) {
      if (r.analyteId !== analyte.id) continue;
      const name = originalName(r, analyte);
      if (name && !seen.has(analyteKey(name))) seen.set(analyteKey(name), name);
    }
  }
  return [...seen.values()];
}
