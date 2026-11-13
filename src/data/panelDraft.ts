// Чернетка форми «Додати / Редагувати запис» (SPEC §6.5): рядки з полями як текст,
// перевірка й перетворення в Panel.
import { analyteKey, findAnalyteByName } from './analytes';
import { isValidDate } from './validate';
import {
  lastResultFor,
  newId,
  syncOriginalSynonyms,
  upsertAnalyte,
  upsertPanel,
} from './mutations';
import type { Analyte, Db, Panel, Result } from './types';
import { formatNumber, parseDecimal } from '../lib/format';

export type ResultDraft = {
  key: string;
  /** Обраний наявний показник. */
  analyteId?: string;
  /** Назва нового показника, якого ще немає в базі. */
  newName?: string;
  newGroup?: string;
  /** Як показник підписаний у бланку (необов'язково). */
  nameOriginal?: string;
  value: string;
  unit: string;
  refLow: string;
  refHigh: string;
  /** Текстовий референс зберігається з оригіналу; у формі не редагується. */
  refText?: string;
};

export type PanelDraft = {
  date: string;
  lab: string;
  fileRef: string;
  note: string;
  results: ResultDraft[];
};

export type RowErrors = { analyte?: string; value?: string; refLow?: string; refHigh?: string };

export type DraftErrors = {
  date?: string;
  results?: string;
  rows: Record<string, RowErrors>;
};

export function emptyRow(): ResultDraft {
  return { key: newId(), value: '', unit: '', refLow: '', refHigh: '' };
}

export function emptyDraft(today: string): PanelDraft {
  return { date: today, lab: '', fileRef: '', note: '', results: [emptyRow()] };
}

const num = (n: number | undefined) => (n === undefined ? '' : formatNumber(n).replace('−', '-'));

export function rowFromResult(result: Result): ResultDraft {
  return {
    key: newId(),
    analyteId: result.analyteId,
    nameOriginal: result.nameOriginal,
    value: result.value !== undefined ? num(result.value) : (result.valueText ?? ''),
    unit: result.unit ?? '',
    refLow: num(result.refLow),
    refHigh: num(result.refHigh),
    refText: result.refText,
  };
}

export function draftFromPanel(panel: Panel): PanelDraft {
  return {
    date: panel.date,
    lab: panel.lab ?? '',
    fileRef: panel.fileRef ?? '',
    note: panel.note ?? '',
    results: panel.results.map(rowFromResult),
  };
}

/** Рядок для показника з підставленими одиницями й референсом останнього запису. */
export function rowForAnalyte(db: Db, analyte: Analyte, excludePanelId?: string): ResultDraft {
  const last = lastResultFor(db, analyte.id, excludePanelId);
  return {
    key: newId(),
    analyteId: analyte.id,
    value: '',
    nameOriginal: last?.nameOriginal,
    unit: last?.unit ?? analyte.defaultUnit ?? '',
    refLow: num(last?.refLow),
    refHigh: num(last?.refHigh),
    refText: last?.refText,
  };
}

export function isRowBlank(row: ResultDraft): boolean {
  return (
    !row.analyteId &&
    !row.newName?.trim() &&
    !row.nameOriginal?.trim() &&
    !row.value.trim() &&
    !row.unit.trim() &&
    !row.refLow.trim() &&
    !row.refHigh.trim()
  );
}

export function rowHasAnalyte(row: ResultDraft): boolean {
  return !!row.analyteId || !!row.newName?.trim();
}

export function validateRow(row: ResultDraft): RowErrors {
  const errors: RowErrors = {};
  if (!rowHasAnalyte(row)) errors.analyte = 'Оберіть показник';
  if (!row.value.trim()) errors.value = 'Вкажіть значення: число або текст';
  const low = row.refLow.trim() ? parseDecimal(row.refLow) : undefined;
  const high = row.refHigh.trim() ? parseDecimal(row.refHigh) : undefined;
  if (row.refLow.trim() && low === undefined) errors.refLow = 'Має бути число';
  if (row.refHigh.trim() && high === undefined) errors.refHigh = 'Має бути число';
  if (low !== undefined && high !== undefined && low > high) {
    errors.refHigh = 'Верхня межа менша за нижню';
  }
  return errors;
}

export function validateDraft(draft: PanelDraft): DraftErrors {
  const errors: DraftErrors = { rows: {} };
  if (!draft.date) errors.date = 'Вкажіть дату';
  else if (!isValidDate(draft.date)) errors.date = 'Неправильна дата';

  const rows = draft.results.filter((r) => !isRowBlank(r));
  if (rows.length === 0) errors.results = 'Додайте хоча б один показник';
  for (const row of rows) {
    const rowErrors = validateRow(row);
    if (Object.keys(rowErrors).length > 0) errors.rows[row.key] = rowErrors;
  }
  return errors;
}

export function hasErrors(errors: DraftErrors): boolean {
  return !!errors.date || !!errors.results || Object.keys(errors.rows).length > 0;
}

function trimmed(s: string): string | undefined {
  const t = s.trim();
  return t || undefined;
}

/**
 * Зберігає чернетку в базу: створює нові показники (або знаходить наявні з тією ж
 * назвою чи синонімом) і додає або замінює запис. Чернетка має бути вже перевірена.
 */
export function applyDraft(
  db: Db,
  draft: PanelDraft,
  existing?: Panel,
): { db: Db; panelId: string } {
  let next = db;
  const created = new Map<string, string>(); // analyteKey нової назви → id

  const results: Result[] = [];
  for (const row of draft.results) {
    if (isRowBlank(row)) continue;

    let analyteId = row.analyteId;
    const newName = row.newName?.trim();
    if (!analyteId && newName) {
      const key = analyteKey(newName);
      analyteId = created.get(key) ?? findAnalyteByName(next.analytes, newName)?.id;
      if (!analyteId) {
        const analyte: Analyte = { id: newId(), name: newName, synonyms: [] };
        const group = trimmed(row.newGroup ?? '');
        const unit = trimmed(row.unit);
        if (group) analyte.group = group;
        if (unit) analyte.defaultUnit = unit;
        next = upsertAnalyte(next, analyte);
        analyteId = analyte.id;
      }
      created.set(key, analyteId);
    }
    if (!analyteId) continue;

    const result: Result = { analyteId };
    const nameOriginal = trimmed(row.nameOriginal ?? '');
    if (nameOriginal) result.nameOriginal = nameOriginal;
    const value = parseDecimal(row.value);
    if (value !== undefined) result.value = value;
    else result.valueText = row.value.trim();
    const unit = trimmed(row.unit);
    const refLow = row.refLow.trim() ? parseDecimal(row.refLow) : undefined;
    const refHigh = row.refHigh.trim() ? parseDecimal(row.refHigh) : undefined;
    if (unit) result.unit = unit;
    if (refLow !== undefined) result.refLow = refLow;
    if (refHigh !== undefined) result.refHigh = refHigh;
    if (refLow === undefined && refHigh === undefined && row.refText) result.refText = row.refText;
    results.push(result);
  }

  const panel: Panel = { id: existing?.id ?? newId(), date: draft.date, results };
  const lab = trimmed(draft.lab);
  const fileRef = trimmed(draft.fileRef);
  const note = trimmed(draft.note);
  if (lab) panel.lab = lab;
  if (fileRef) panel.fileRef = fileRef;
  if (note) panel.note = note;
  if (existing?.tags) panel.tags = existing.tags;

  return { db: syncOriginalSynonyms(upsertPanel(next, panel)), panelId: panel.id };
}
