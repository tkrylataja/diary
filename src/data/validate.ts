import { SCHEMA_VERSION, type Analyte, type Db, type Panel, type Result } from './types';

/** Розшифровані дані не відповідають моделі SPEC §5. */
export class DbFormatError extends Error {
  constructor(detail: string) {
    super(`Невідомий формат даних: ${detail}`);
    this.name = 'DbFormatError';
  }
}

type Obj = Record<string, unknown>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function optString(o: Obj, key: string, where: string): string | undefined {
  const v = o[key];
  if (v === undefined) return undefined;
  if (typeof v !== 'string') throw new DbFormatError(`${where}.${key} має бути рядком`);
  return v;
}

function optNumber(o: Obj, key: string, where: string): number | undefined {
  const v = o[key];
  if (v === undefined) return undefined;
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new DbFormatError(`${where}.${key} має бути числом`);
  }
  return v;
}

function stringArray(v: unknown, where: string): string[] {
  if (!Array.isArray(v) || !v.every((s) => typeof s === 'string')) {
    throw new DbFormatError(`${where} має бути списком рядків`);
  }
  return v as string[];
}

export function isValidDate(date: string): boolean {
  if (!DATE_RE.test(date)) return false;
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function parseAnalyte(v: unknown, i: number): Analyte {
  const where = `analytes[${i}]`;
  if (!isObj(v)) throw new DbFormatError(`${where} має бути об'єктом`);
  if (typeof v.id !== 'string' || !v.id) throw new DbFormatError(`${where}.id порожній`);
  if (typeof v.name !== 'string' || !v.name.trim()) {
    throw new DbFormatError(`${where}.name порожній`);
  }
  const analyte: Analyte = {
    id: v.id,
    name: v.name,
    synonyms: v.synonyms === undefined ? [] : stringArray(v.synonyms, `${where}.synonyms`),
  };
  const group = optString(v, 'group', where);
  const defaultUnit = optString(v, 'defaultUnit', where);
  if (group !== undefined) analyte.group = group;
  if (defaultUnit !== undefined) analyte.defaultUnit = defaultUnit;
  if (v.conversions !== undefined) {
    if (!Array.isArray(v.conversions)) {
      throw new DbFormatError(`${where}.conversions має бути списком`);
    }
    analyte.conversions = v.conversions.map((c, j) => {
      const at = `${where}.conversions[${j}]`;
      if (!isObj(c) || typeof c.unit !== 'string' || !c.unit.trim()) {
        throw new DbFormatError(`${at}.unit порожній`);
      }
      if (typeof c.factor !== 'number' || !Number.isFinite(c.factor) || c.factor <= 0) {
        throw new DbFormatError(`${at}.factor має бути додатним числом`);
      }
      return { unit: c.unit, factor: c.factor };
    });
  }
  return analyte;
}

function parseResult(v: unknown, where: string, analyteIds: Set<string>): Result {
  if (!isObj(v)) throw new DbFormatError(`${where} має бути об'єктом`);
  if (typeof v.analyteId !== 'string' || !analyteIds.has(v.analyteId)) {
    throw new DbFormatError(`${where}.analyteId посилається на невідомий показник`);
  }
  const result: Result = { analyteId: v.analyteId };
  const value = optNumber(v, 'value', where);
  const valueText = optString(v, 'valueText', where);
  if (value === undefined && !valueText?.trim()) {
    throw new DbFormatError(`${where}: немає значення`);
  }
  const fields = {
    value,
    valueText,
    nameOriginal: optString(v, 'nameOriginal', where)?.trim() || undefined,
    unit: optString(v, 'unit', where),
    refLow: optNumber(v, 'refLow', where),
    refHigh: optNumber(v, 'refHigh', where),
    refText: optString(v, 'refText', where),
  };
  for (const [k, val] of Object.entries(fields)) {
    if (val !== undefined) (result as Record<string, unknown>)[k] = val;
  }
  return result;
}

function parsePanel(v: unknown, i: number, analyteIds: Set<string>): Panel {
  const where = `panels[${i}]`;
  if (!isObj(v)) throw new DbFormatError(`${where} має бути об'єктом`);
  if (typeof v.id !== 'string' || !v.id) throw new DbFormatError(`${where}.id порожній`);
  if (typeof v.date !== 'string' || !isValidDate(v.date)) {
    throw new DbFormatError(`${where}.date має бути датою YYYY-MM-DD`);
  }
  if (!Array.isArray(v.results)) throw new DbFormatError(`${where}.results має бути списком`);
  const panel: Panel = {
    id: v.id,
    date: v.date,
    results: v.results.map((r, j) => parseResult(r, `${where}.results[${j}]`, analyteIds)),
  };
  const lab = optString(v, 'lab', where);
  const note = optString(v, 'note', where);
  const fileRef = optString(v, 'fileRef', where);
  if (lab !== undefined) panel.lab = lab;
  if (note !== undefined) panel.note = note;
  if (fileRef !== undefined) panel.fileRef = fileRef;
  if (v.tags !== undefined) panel.tags = stringArray(v.tags, `${where}.tags`);
  return panel;
}

function assertUniqueIds(items: { id: string }[], what: string) {
  const seen = new Set<string>();
  for (const { id } of items) {
    if (seen.has(id)) throw new DbFormatError(`повторюється ${what} id «${id}»`);
    seen.add(id);
  }
}

/**
 * Перевіряє розшифровані дані й повертає чисту копію без зайвих полів.
 * Будь-яка невідповідність моделі — DbFormatError.
 */
export function parseDb(input: unknown): Db {
  if (!isObj(input)) throw new DbFormatError("очікувався об'єкт");
  // Версія 1 (до nameOriginal) читається без змін: нове поле просто відсутнє.
  if (input.version !== 1 && input.version !== SCHEMA_VERSION) {
    throw new DbFormatError('непідтримувана версія');
  }
  if (!Array.isArray(input.analytes) || !Array.isArray(input.panels)) {
    throw new DbFormatError('немає списків panels або analytes');
  }
  const analytes = input.analytes.map(parseAnalyte);
  assertUniqueIds(analytes, 'показника');
  const ids = new Set(analytes.map((a) => a.id));
  const panels = input.panels.map((p, i) => parsePanel(p, i, ids));
  assertUniqueIds(panels, 'запису');
  return { version: SCHEMA_VERSION, panels, analytes };
}
