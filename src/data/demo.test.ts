import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decrypt } from '../crypto/crypto';
import demoJson from '../../demo/demo-data.json';
import { findAnalyteByName } from './analytes';
import { outOfRangeCount, resultStatus } from './status';
import { parseDb } from './validate';

const db = parseDb(demoJson);

describe('демо-дані (SPEC §11)', () => {
  it('пролактин збігається з таблицею й має правильні статуси', () => {
    const prl = findAnalyteByName(db.analytes, 'PRL');
    expect(prl?.name).toBe('Пролактин');
    const series = db.panels
      .flatMap((p) => p.results.filter((r) => r.analyteId === prl?.id).map((r) => ({ p, r })))
      .map(({ p, r }) => [p.date, r.value, r.unit, r.refLow, r.refHigh, resultStatus(r)]);
    expect(series).toEqual([
      ['2021-03-12', 24.1, 'ng/mL', 4.79, 23.3, 'high'],
      ['2022-02-08', 31.5, 'ng/mL', 4.79, 23.3, 'high'],
      ['2022-09-20', 22.0, 'ng/mL', 6.0, 29.9, 'normal'],
      ['2023-05-15', 18.6, 'ng/mL', 6.0, 29.9, 'normal'],
      ['2024-03-04', 26.9, 'ng/mL', 4.79, 23.3, 'high'],
      ['2025-02-17', 17.2, 'ng/mL', 4.79, 23.3, 'normal'],
      ['2026-10-28', 15.4, 'ng/mL', 4.79, 23.3, 'normal'],
    ]);
  });

  it('пакет за 2024-03-04: усе, крім пролактину, у нормі', () => {
    const panel = db.panels.find((p) => p.date === '2024-03-04')!;
    const names = panel.results.map((r) => db.analytes.find((a) => a.id === r.analyteId)?.name);
    expect(names).toEqual([
      'Пролактин',
      'ТТГ',
      'Вільний Т4',
      'Вітамін D (25-OH)',
      'Феритин',
      'Гемоглобін',
      'Глюкоза',
      'Креатинін',
    ]);
    expect(outOfRangeCount(panel)).toBe(1);
  });

  it('demo/data.enc розшифровується паролем demo-demo-demo і збігається з JSON', async () => {
    const text = readFileSync(new URL('../../demo/data.enc', import.meta.url), 'utf8');
    const { data } = await decrypt(text, 'demo-demo-demo');
    expect(parseDb(data)).toEqual(db);
  });
});

describe('старі файли', () => {
  it('data.enc зі схемою версії 1 (без nameOriginal) відкривається без помилок', async () => {
    const { encrypt } = await import('../crypto/crypto');
    const oldDb = {
      version: 1,
      analytes: [{ id: 'prl', name: 'Пролактин', synonyms: ['PRL'] }],
      panels: [
        {
          id: 'p1',
          date: '2021-03-12',
          results: [{ analyteId: 'prl', value: 24.1, unit: 'ng/mL', refLow: 4.79, refHigh: 23.3 }],
        },
      ],
    };
    const file = JSON.stringify(await encrypt(oldDb, 'старий пароль для тесту'));
    const { data } = await decrypt(file, 'старий пароль для тесту');
    const opened = parseDb(data);
    expect(opened.version).toBe(2);
    expect(opened.panels[0]?.results[0]).toEqual(oldDb.panels[0]?.results[0]);
  });
});
