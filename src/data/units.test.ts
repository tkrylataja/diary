import { describe, expect, it } from 'vitest';
import type { SeriesPoint } from './selectors';
import type { Analyte, Result } from './types';
import {
  availableUnits,
  conversionRatio,
  normSummary,
  parseConversions,
  roundConverted,
  sameUnit,
  showIn,
} from './units';

const prl: Analyte = {
  id: 'prl',
  name: 'Пролактин',
  synonyms: [],
  defaultUnit: 'ng/mL',
  conversions: [{ unit: 'mIU/L', factor: 21.2 }],
};

const point = (date: string, result: Partial<Result>): SeriesPoint => ({
  panel: { id: date, date, results: [] },
  result: { analyteId: 'prl', ...result },
});

describe('одиниці', () => {
  it('порівнює одиниці без регістру, пробілів і з різними «мікро»', () => {
    expect(sameUnit('mIU/L', ' miu/l ')).toBe(true);
    expect(sameUnit('μIU/mL', 'µIU/mL')).toBe(true);
    expect(sameUnit('ng/mL', 'mIU/L')).toBe(false);
  });

  it('коефіцієнт в обидва боки й відсутній коефіцієнт', () => {
    expect(conversionRatio(prl, 'ng/mL', 'mIU/L')).toBe(21.2);
    expect(conversionRatio(prl, 'mIU/L', 'ng/mL')).toBeCloseTo(1 / 21.2);
    expect(conversionRatio(prl, 'mIU/L', 'mIU/L')).toBe(1);
    expect(conversionRatio(prl, 'pmol/L', 'ng/mL')).toBeUndefined();
  });

  it('округлює залежно від величини', () => {
    expect(roundConverted(30.962264)).toBe(30.96);
    expect(roundConverted(227.4567)).toBe(227.5);
    expect(roundConverted(1610.988)).toBe(1611);
  });

  it('пропонує основну, додаткові й наявні в записах одиниці без повторів', () => {
    const pts = [
      point('2024-01-01', { value: 1, unit: 'MIU/L' }),
      point('2024-02-01', { value: 1, unit: 'pmol/L' }),
    ];
    expect(availableUnits(prl, pts)).toEqual(['ng/mL', 'mIU/L', 'pmol/L']);
    expect(availableUnits({ ...prl, defaultUnit: undefined, conversions: undefined }, pts)).toEqual(
      ['MIU/L', 'pmol/L'],
    );
  });
});

describe('showIn', () => {
  it('перераховує значення й референс, зберігає оригінал', () => {
    const shown = showIn(
      { analyteId: 'prl', value: 656.4, unit: 'mIU/L', refLow: 102, refHigh: 496 },
      prl,
      'ng/mL',
    );
    expect(shown).toMatchObject({
      value: 30.96,
      refLow: 4.81,
      refHigh: 23.4,
      unit: 'ng/mL',
      converted: true,
      convertible: true,
      original: { value: '656,4', unit: 'mIU/L', ref: '102–496' },
    });
  });

  it('у тих самих одиницях нічого не змінює', () => {
    const r = { analyteId: 'prl', value: 9.77, unit: 'ng/mL', refLow: 5.18, refHigh: 26.53 };
    expect(showIn(r, prl, 'ng/mL')).toMatchObject({
      value: 9.77,
      converted: false,
      convertible: true,
    });
  });

  it('без коефіцієнта — лишає як є й позначає неперерахованим', () => {
    const shown = showIn({ analyteId: 'prl', value: 5, unit: 'pmol/L' }, prl, 'ng/mL');
    expect(shown).toMatchObject({ value: 5, unit: 'pmol/L', convertible: false, converted: false });
  });

  it('запис без одиниць вважається в основних', () => {
    expect(showIn({ analyteId: 'prl', value: 10 }, prl, 'mIU/L')).toMatchObject({
      value: 212,
      converted: true,
    });
  });

  it('текстове значення не перераховується, а референс — так', () => {
    const shown = showIn(
      { analyteId: 'prl', valueText: '<1', unit: 'ng/mL', refHigh: 20 },
      prl,
      'mIU/L',
    );
    expect(shown).toMatchObject({ valueText: '<1', refHigh: 424, converted: true });
  });
});

describe('normSummary', () => {
  it('норма з останнього аналізу й інші діапазони без повторів', () => {
    const pts = [
      point('2021-05-29', { value: 75.99, unit: 'ng/mL', refLow: 4.79, refHigh: 23.3 }),
      point('2023-07-10', { value: 227, unit: 'mIU/L', refLow: 127, refHigh: 637 }),
      point('2025-07-07', { value: 9.77, unit: 'ng/mL', refLow: 5.18, refHigh: 26.53 }),
      point('2026-11-10', { value: 656.4, unit: 'mIU/L', refLow: 102, refHigh: 496 }),
      point('2026-11-11', { value: 1, unit: 'pmol/L', refLow: 1, refHigh: 2 }),
    ];
    expect(normSummary(pts, prl, 'ng/mL')).toEqual({
      latest: { ref: '4,81–23,4', date: '2026-11-10' },
      others: ['5,18–26,53', '5,99–30,05', '4,79–23,3'],
    });
  });
});

describe('parseConversions', () => {
  const row = (unit: string, factor: string) => ({ key: unit + factor, unit, factor });

  it('розбирає коефіцієнти з комою й пропускає порожні рядки', () => {
    expect(parseConversions('ng/mL', [row('mIU/L', '21,2'), row('', '')])).toEqual({
      conversions: [{ unit: 'mIU/L', factor: 21.2 }],
    });
  });

  it('помилки: немає основних одиниць, не число, повтор', () => {
    expect(parseConversions('', [row('mIU/L', '21,2')]).error).toBeDefined();
    expect(parseConversions('ng/mL', [row('mIU/L', 'abc')]).error).toBeDefined();
    expect(parseConversions('ng/mL', [row('mIU/L', '0')]).error).toBeDefined();
    expect(parseConversions('ng/mL', [row('NG/ML', '2')]).error).toBeDefined();
    expect(parseConversions('ng/mL', [row('mIU/L', '2'), row('miu/l', '3')]).error).toBeDefined();
  });
});
