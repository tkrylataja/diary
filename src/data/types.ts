// Модель даних (SPEC §5).

/** Версія схеми даних усередині data.enc. 1 — без nameOriginal; читається й досі. */
export const SCHEMA_VERSION = 2;

export type Db = { version: typeof SCHEMA_VERSION; panels: Panel[]; analytes: Analyte[] };

/** Один «пакет» аналізів за дату. */
export type Panel = {
  id: string;
  date: string; // YYYY-MM-DD
  lab?: string;
  note?: string;
  tags?: string[];
  fileRef?: string; // назва або посилання на оригінал PDF (сам файл не зберігаємо)
  results: Result[];
};

export type Result = {
  analyteId: string;
  /** Як показник підписаний у бланку (MCV, HGB, АТ-ТПО); основна назва — Analyte.name. */
  nameOriginal?: string;
  value?: number;
  valueText?: string; // якщо не число: «<0.5», «негативний»
  unit?: string;
  refLow?: number;
  refHigh?: number;
  refText?: string;
};

export type Analyte = {
  id: string;
  name: string;
  synonyms: string[];
  group?: string;
  defaultUnit?: string;
  /** Інші одиниці: 1 defaultUnit = factor unit (напр. 1 ng/mL = 21,2 mIU/L). */
  conversions?: UnitConversion[];
};

export type UnitConversion = { unit: string; factor: number };

export function emptyDb(): Db {
  return { version: SCHEMA_VERSION, panels: [], analytes: [] };
}
