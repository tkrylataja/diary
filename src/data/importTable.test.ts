import { describe, expect, it } from 'vitest';
import demoJson from '../../demo/demo-data.json';
import { analyteKey } from './analytes';
import {
  applyImport,
  parseCsv,
  parseDateCell,
  parseTable,
  unknownAnalyteNames,
} from './importTable';
import { parseDb } from './validate';

const db = parseDb(demoJson);

describe('parseCsv', () => {
  it('кома як роздільник, лапки й "" усередині', () => {
    expect(parseCsv('a,b\n"x, y","say ""hi"""\n')).toEqual([
      ['a', 'b'],
      ['x, y', 'say "hi"'],
    ]);
  });

  it('крапка з комою (Excel), BOM, CRLF і порожні рядки', () => {
    expect(parseCsv('\uFEFFdate;value\r\n2024-03-04;26,9\r\n\r\n')).toEqual([
      ['date', 'value'],
      ['2024-03-04', '26,9'],
    ]);
  });

  it('перенос рядка в лапках', () => {
    expect(parseCsv('a\n"line1\nline2"')).toEqual([['a'], ['line1\nline2']]);
  });
});

describe('parseDateCell', () => {
  it('ISO, європейський формат і дата Excel', () => {
    expect(parseDateCell('2024-03-04')).toBe('2024-03-04');
    expect(parseDateCell('4.3.2024')).toBe('2024-03-04');
    expect(parseDateCell('04/03/2024')).toBe('2024-03-04');
    expect(parseDateCell(new Date(Date.UTC(2024, 2, 4)))).toBe('2024-03-04');
  });

  it('неіснуюча або незрозуміла дата', () => {
    expect(parseDateCell('31.02.2024')).toBeUndefined();
    expect(parseDateCell('березень')).toBeUndefined();
    expect(parseDateCell(null)).toBeUndefined();
  });
});

describe('parseTable', () => {
  const header = ['Date', 'Lab', 'Analyte', 'Value', 'Unit', 'ref low', 'REF_HIGH'];

  it('розбирає рядки, числа з комою й текстові значення', () => {
    const { rows, issues, missingColumns } = parseTable([
      header,
      ['04.03.2024', 'Альфа', 'PRL', '26,9', 'ng/mL', '4,79', 23.3],
      ['2024-03-04', 'Альфа', 'CRP', '<0.5', 'mg/L', '', '5'],
    ]);
    expect(missingColumns).toEqual([]);
    expect(issues).toEqual([]);
    expect(rows).toEqual([
      {
        line: 2,
        date: '2024-03-04',
        lab: 'Альфа',
        analyte: 'PRL',
        value: 26.9,
        unit: 'ng/mL',
        refLow: 4.79,
        refHigh: 23.3,
      },
      {
        line: 3,
        date: '2024-03-04',
        lab: 'Альфа',
        analyte: 'CRP',
        valueText: '<0.5',
        unit: 'mg/L',
        refHigh: 5,
      },
    ]);
  });

  it('звітує про помилки з номером рядка й пропускає порожні рядки', () => {
    const { rows, issues } = parseTable([
      header,
      ['31.02.2024', '', 'PRL', '5', '', '', ''],
      ['', '', '', '', '', '', ''],
      ['2024-01-01', '', '', '', '', 'abc', ''],
      ['2024-01-01', '', 'TSH', '2', '', '5', '1'],
    ]);
    expect(rows).toEqual([]);
    expect(issues).toEqual([
      { line: 2, message: 'неправильна дата «31.02.2024»' },
      { line: 4, message: 'немає назви показника; немає значення; ref_low не число: «abc»' },
      { line: 5, message: 'ref_low більший за ref_high' },
    ]);
  });

  it('повідомляє про відсутні обов’язкові колонки', () => {
    expect(parseTable([['date', 'name', 'result']]).missingColumns).toEqual(['analyte', 'value']);
  });
});

describe('імпорт у базу', () => {
  const header = ['date', 'lab', 'analyte', 'value', 'unit', 'ref_low', 'ref_high'];

  it('знаходить невідомі назви з урахуванням синонімів', () => {
    const { rows } = parseTable([
      header,
      ['2026-11-01', '', 'Prolaktyna', '12', '', '', ''],
      ['2026-11-01', '', 'Insulin', '7', '', '', ''],
      ['2026-11-01', '', 'insulin', '8', '', '', ''],
    ]);
    expect(unknownAnalyteNames(db.analytes, rows)).toEqual(['Insulin']);
  });

  it('групує рядки в записи, доповнює наявні й пропускає дублі', () => {
    const { rows } = parseTable([
      header,
      // новий запис
      ['2026-11-01', 'Альфа', 'PRL', '12,5', 'ng/mL', '4,79', '23,3'],
      ['2026-11-01', 'Альфа', 'Insulin', '7', 'µIU/mL', '', ''],
      // наявний запис 2024-03-04 «Лабораторія «Альфа»»: дубль і новий показник
      ['2024-03-04', 'Лабораторія «Альфа»', 'Пролактин', '26.9', 'ng/mL', '', ''],
      ['2024-03-04', 'Лабораторія «Альфа»', 'HbA1c', '5,2', '%', '', ''],
    ]);
    const mapping = {
      [analyteKey('Insulin')]: { kind: 'new' as const },
      [analyteKey('HbA1c')]: { kind: 'existing' as const, analyteId: 'glucose' },
    };
    const { db: next, stats } = applyImport(db, rows, mapping);
    expect(stats).toEqual({
      newPanels: 1,
      updatedPanels: 1,
      results: 3,
      duplicates: 1,
      newAnalytes: 1,
    });
    expect(next.panels).toHaveLength(db.panels.length + 1);
    const created = next.panels.find((p) => p.date === '2026-11-01')!;
    expect(created.lab).toBe('Альфа');
    expect(created.results[0]).toEqual({
      analyteId: 'prolactin',
      value: 12.5,
      unit: 'ng/mL',
      refLow: 4.79,
      refHigh: 23.3,
    });
    const updated = next.panels.find((p) => p.id === 'demo-2024-03-04')!;
    expect(updated.results).toHaveLength(9);
    expect(updated.results.at(-1)?.analyteId).toBe('glucose');
    expect(next.analytes.find((a) => a.id === 'glucose')?.synonyms).toContain('HbA1c');
    expect(next.analytes.find((a) => a.name === 'Insulin')?.defaultUnit).toBe('µIU/mL');
  });

  it('повторний імпорт того самого файлу нічого не додає', () => {
    const { rows } = parseTable([header, ['2026-11-01', 'Альфа', 'PRL', '12,5', '', '', '']]);
    const once = applyImport(db, rows, {}).db;
    const twice = applyImport(once, rows, {});
    expect(twice.stats).toMatchObject({ newPanels: 0, results: 0, duplicates: 1 });
    expect(twice.db.panels).toHaveLength(once.panels.length);
  });
});

describe('імпорт: нові вимоги', () => {
  const header = ['date', 'lab', 'analyte', 'value', 'unit', 'ref_low', 'ref_high'];

  it('CSV з крапкою з комою, десятковою комою й analyte_original', () => {
    const csv =
      '\uFEFFdate;lab;analyte;analyte_original;value;unit;ref_low;ref_high\n' +
      '04.03.2026;Synevo;Середній об’єм еритроцита;MCV;88,5;fL;80;100\n' +
      '04.03.2026;Synevo;Гемоглобін;HGB;13,2;g/dL;12;15,5\n';
    const { rows, issues } = parseTable(parseCsv(csv));
    expect(issues).toEqual([]);
    expect(rows[0]).toMatchObject({
      analyte: 'Середній об’єм еритроцита',
      analyteOriginal: 'MCV',
      value: 88.5,
    });

    const { db: next, stats } = applyImport(db, rows, {});
    expect(stats).toMatchObject({ newPanels: 1, results: 2, newAnalytes: 1, duplicates: 0 });
    const panel = next.panels.find((p) => p.date === '2026-03-04')!;
    expect(panel.results.map((r) => r.nameOriginal)).toEqual(['MCV', 'HGB']);
    expect(panel.results[1]?.analyteId).toBe('hemoglobin');
    // Назва з бланка стає синонімом нового показника — пошук знайде «MCV».
    expect(next.analytes.find((a) => a.name === 'Середній об’єм еритроцита')?.synonyms).toEqual([
      'MCV',
    ]);
  });

  it('знаходить наявний показник за analyte_original, якщо основна назва незнайома', () => {
    const { rows } = parseTable([
      ['date', 'analyte', 'analyte_original', 'value'],
      ['2026-03-04', 'Пролактин сироватки', 'PRL', '12'],
    ]);
    expect(unknownAnalyteNames(db.analytes, rows)).toEqual([]);
    const { db: next } = applyImport(db, rows, {});
    expect(next.panels.find((p) => p.date === '2026-03-04')?.results[0]?.analyteId).toBe(
      'prolactin',
    );
  });

  it('текстові значення зберігаються як valueText і не мають статусу', async () => {
    const { resultStatus } = await import('./status');
    const { rows } = parseTable([
      ['date', 'analyte', 'value', 'unit', 'ref_high'],
      ['2026-03-04', 'Білок у сечі', 'негативний', '', ''],
      ['2026-03-04', 'CRP', '<10.0', 'mg/L', '5'],
      ['2026-03-04', 'Кетони', 'сліди', '', ''],
    ]);
    expect(rows.map((r) => [r.value, r.valueText])).toEqual([
      [undefined, 'негативний'],
      [undefined, '<10.0'],
      [undefined, 'сліди'],
    ]);
    const { db: next } = applyImport(db, rows, {});
    const results = next.panels.find((p) => p.date === '2026-03-04')!.results;
    expect(results.map(resultStatus)).toEqual(['unknown', 'unknown', 'unknown']);
  });

  it('дубль: та сама дата, показник, значення й одиниця — навіть в іншій лабораторії', () => {
    const { rows } = parseTable([
      header,
      ['2024-03-04', 'Інша лабораторія', 'PRL', '26,9', 'NG/ML', '', ''],
      ['2024-03-04', 'Інша лабораторія', 'PRL', '26,9', 'mIU/L', '', ''],
    ]);
    const { stats } = applyImport(db, rows, {});
    expect(stats).toMatchObject({ duplicates: 1, results: 1 });
  });

  it('рядки без лабораторії групуються за датою', () => {
    const { rows } = parseTable([
      header,
      ['2026-05-01', '', 'TSH', '2', '', '', ''],
      ['2026-05-01', '', 'FT4', '15', '', '', ''],
    ]);
    const { db: next, stats } = applyImport(db, rows, {});
    expect(stats.newPanels).toBe(1);
    const panel = next.panels.find((p) => p.date === '2026-05-01')!;
    expect(panel.lab).toBeUndefined();
    expect(panel.results).toHaveLength(2);
  });
});
