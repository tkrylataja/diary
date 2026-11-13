// Імпорт таблиці з CSV або Excel (SPEC §6.6).
// Колонки: date, lab, analyte, value, unit, ref_low, ref_high.
// Рядки з однаковими датою й лабораторією стають одним записом.
import { analyteKey, findAnalyteByName } from './analytes';
import { cleanSynonyms, newId, upsertAnalyte, upsertPanel } from './mutations';
import type { Analyte, Db, Panel, Result } from './types';
import { isValidDate } from './validate';
import { parseDecimal } from '../lib/format';

export type Cell = string | number | boolean | Date | null | undefined;

export const IMPORT_COLUMNS = [
  'date',
  'lab',
  'analyte',
  'value',
  'unit',
  'ref_low',
  'ref_high',
] as const;
type Column = (typeof IMPORT_COLUMNS)[number];
const REQUIRED: Column[] = ['date', 'analyte', 'value'];

export type ImportRow = {
  /** Номер рядка у файлі (з 1, разом із заголовком), для звіту. */
  line: number;
  date: string;
  lab?: string;
  analyte: string;
  value?: number;
  valueText?: string;
  unit?: string;
  refLow?: number;
  refHigh?: number;
};

export type ImportIssue = { line: number; message: string };

export type ParsedTable = {
  rows: ImportRow[];
  issues: ImportIssue[];
  /** Обов'язкові колонки, яких немає в заголовку. Якщо не порожньо — імпорт неможливий. */
  missingColumns: string[];
};

// ---------- CSV ----------

/**
 * Розбирає CSV (RFC 4180: лапки, переноси в лапках, "" всередині).
 * Роздільник визначається за заголовком: «;» (так зберігає Excel з українською чи
 * польською локаллю) або «,».
 */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] ?? '';
  const delimiter =
    (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

// ---------- комірки ----------

function cellText(cell: Cell): string {
  if (cell === null || cell === undefined) return '';
  if (cell instanceof Date) return cell.toISOString();
  return String(cell).trim();
}

/** Дата з комірки: YYYY-MM-DD, DD.MM.YYYY (також / і -) або дата Excel. */
export function parseDateCell(cell: Cell): string | undefined {
  if (cell instanceof Date) {
    // Excel-дати приходять як опівніч UTC.
    const y = cell.getUTCFullYear();
    const m = String(cell.getUTCMonth() + 1).padStart(2, '0');
    const d = String(cell.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = cellText(cell);
  const pad = (n = '') => n.padStart(2, '0');
  let iso: string | undefined;
  const ymd = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const dmy = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (ymd) iso = `${ymd[1]}-${pad(ymd[2])}-${pad(ymd[3])}`;
  else if (dmy) iso = `${dmy[3]}-${pad(dmy[2])}-${pad(dmy[1])}`;
  return iso && isValidDate(iso) ? iso : undefined;
}

function numberCell(cell: Cell): number | undefined {
  if (typeof cell === 'number') return Number.isFinite(cell) ? cell : undefined;
  return parseDecimal(cellText(cell));
}

function normalizeHeader(cell: Cell): string {
  return cellText(cell)
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

// ---------- розбір таблиці ----------

/** Перевіряє таблицю (перший рядок — заголовок) і збирає рядки та помилки. */
export function parseTable(table: Cell[][]): ParsedTable {
  const [header = [], ...body] = table;
  const index = new Map<Column, number>();
  header.forEach((cell, i) => {
    const name = normalizeHeader(cell) as Column;
    if (IMPORT_COLUMNS.includes(name) && !index.has(name)) index.set(name, i);
  });
  const missingColumns = REQUIRED.filter((c) => !index.has(c));
  if (missingColumns.length > 0) return { rows: [], issues: [], missingColumns };

  const get = (row: Cell[], col: Column): Cell => {
    const i = index.get(col);
    return i === undefined ? undefined : row[i];
  };

  const rows: ImportRow[] = [];
  const issues: ImportIssue[] = [];

  body.forEach((cells, i) => {
    const line = i + 2;
    if (cells.every((c) => cellText(c) === '')) return;

    const problems: string[] = [];
    const rawDate = get(cells, 'date');
    const date = parseDateCell(rawDate);
    if (!date) {
      problems.push(cellText(rawDate) ? `неправильна дата «${cellText(rawDate)}»` : 'немає дати');
    }
    const analyte = cellText(get(cells, 'analyte'));
    if (!analyte) problems.push('немає назви показника');

    const rawValue = get(cells, 'value');
    const valueStr = cellText(rawValue);
    if (!valueStr) problems.push('немає значення');

    const refs: Partial<Record<'refLow' | 'refHigh', number>> = {};
    for (const [col, key] of [
      ['ref_low', 'refLow'],
      ['ref_high', 'refHigh'],
    ] as const) {
      const raw = cellText(get(cells, col));
      if (!raw) continue;
      const n = numberCell(get(cells, col));
      if (n === undefined) problems.push(`${col} не число: «${raw}»`);
      else refs[key] = n;
    }
    if (refs.refLow !== undefined && refs.refHigh !== undefined && refs.refLow > refs.refHigh) {
      problems.push('ref_low більший за ref_high');
    }

    if (problems.length > 0 || !date) {
      issues.push({ line, message: problems.join('; ') });
      return;
    }

    const row: ImportRow = { line, date, analyte, ...refs };
    const value = numberCell(rawValue);
    if (value !== undefined) row.value = value;
    else row.valueText = valueStr;
    const lab = cellText(get(cells, 'lab'));
    const unit = cellText(get(cells, 'unit'));
    if (lab) row.lab = lab;
    if (unit) row.unit = unit;
    rows.push(row);
  });

  return { rows, issues, missingColumns: [] };
}

// ---------- зіставлення назв ----------

/** Назви з файлу, яких немає серед показників і синонімів (по одній на ключ). */
export function unknownAnalyteNames(analytes: Analyte[], rows: ImportRow[]): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const { analyte } of rows) {
    const key = analyteKey(analyte);
    if (seen.has(key)) continue;
    seen.add(key);
    if (!findAnalyteByName(analytes, analyte)) names.push(analyte);
  }
  return names;
}

/**
 * Рішення для невідомої назви: створити новий показник або вважати її
 * синонімом наявного (тоді назва додається до його синонімів).
 */
export type NameMapping = Record<string, { kind: 'new' } | { kind: 'existing'; analyteId: string }>;

export type ImportStats = {
  newPanels: number;
  updatedPanels: number;
  results: number;
  duplicates: number;
  newAnalytes: number;
};

function panelKey(date: string, lab: string | undefined): string {
  return `${date}|${(lab ?? '').trim().toLowerCase()}`;
}

function sameResult(a: Result, b: Result): boolean {
  return a.analyteId === b.analyteId && a.value === b.value && a.valueText === b.valueText;
}

/**
 * Застосовує імпорт. Рядки йдуть у наявний запис із тими самими датою й
 * лабораторією або в новий; точні повтори (той самий показник і значення) пропускаються.
 * mapping ключується за analyteKey(назви).
 */
export function applyImport(
  db: Db,
  rows: ImportRow[],
  mapping: NameMapping,
): { db: Db; stats: ImportStats } {
  let next = db;
  const stats: ImportStats = {
    newPanels: 0,
    updatedPanels: 0,
    results: 0,
    duplicates: 0,
    newAnalytes: 0,
  };

  // 1. Показники: кожна назва з файлу → id.
  const idByKey = new Map<string, string>();
  for (const row of rows) {
    const key = analyteKey(row.analyte);
    if (idByKey.has(key)) continue;
    const known = findAnalyteByName(next.analytes, row.analyte);
    if (known) {
      idByKey.set(key, known.id);
      continue;
    }
    const decision = mapping[key] ?? { kind: 'new' };
    if (decision.kind === 'existing') {
      const target = next.analytes.find((a) => a.id === decision.analyteId);
      if (target) {
        next = upsertAnalyte(next, {
          ...target,
          synonyms: cleanSynonyms(target.name, [...target.synonyms, row.analyte]),
        });
        idByKey.set(key, target.id);
        continue;
      }
    }
    const created: Analyte = { id: newId(), name: row.analyte, synonyms: [] };
    if (row.unit) created.defaultUnit = row.unit;
    next = upsertAnalyte(next, created);
    idByKey.set(key, created.id);
    stats.newAnalytes++;
  }

  // 2. Записи: групуємо за датою й лабораторією.
  const panels = new Map<string, Panel>();
  for (const p of next.panels) panels.set(panelKey(p.date, p.lab), p);
  const touched = new Map<string, 'new' | 'updated'>();

  for (const row of rows) {
    const analyteId = idByKey.get(analyteKey(row.analyte));
    if (!analyteId) continue;
    const result: Result = { analyteId };
    if (row.value !== undefined) result.value = row.value;
    if (row.valueText !== undefined) result.valueText = row.valueText;
    if (row.unit) result.unit = row.unit;
    if (row.refLow !== undefined) result.refLow = row.refLow;
    if (row.refHigh !== undefined) result.refHigh = row.refHigh;

    const key = panelKey(row.date, row.lab);
    let panel = panels.get(key);
    if (!panel) {
      panel = { id: newId(), date: row.date, results: [] };
      if (row.lab) panel.lab = row.lab;
      touched.set(key, 'new');
    }
    if (panel.results.some((r) => sameResult(r, result))) {
      stats.duplicates++;
      continue;
    }
    panel = { ...panel, results: [...panel.results, result] };
    panels.set(key, panel);
    if (!touched.has(key)) touched.set(key, 'updated');
    stats.results++;
  }

  for (const [key, kind] of touched) {
    const panel = panels.get(key);
    if (!panel || panel.results.length === 0) continue;
    next = upsertPanel(next, panel);
    if (kind === 'new') stats.newPanels++;
    else stats.updatedPanels++;
  }
  return { db: next, stats };
}
