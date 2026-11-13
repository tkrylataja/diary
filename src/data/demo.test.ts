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
