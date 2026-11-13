// Модель даних (SPEC §5).

export type Db = { version: 1; panels: Panel[]; analytes: Analyte[] };

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
};

export function emptyDb(): Db {
  return { version: 1, panels: [], analytes: [] };
}
