import { describe, expect, it } from 'vitest';
import { analyteKey, analyteMatches, findAnalyteByName, searchAnalytes } from './analytes';
import type { Analyte } from './types';

const analytes: Analyte[] = [
  { id: 'prl', name: 'Пролактин', synonyms: ['PRL', 'Prolactin', 'Prolaktyna'] },
  { id: 'ft4', name: 'Вільний Т4', synonyms: ['FT4', 'Free T4'] },
  { id: 'vitd', name: 'Вітамін D (25-OH)', synonyms: ['Vitamin D', 'Witamina D'] },
  { id: 'hgb', name: 'Гемоглобін', synonyms: ['HGB', 'Hb'] },
  { id: 'crp', name: 'С-реактивний білок', synonyms: ['CRP', 'Białko C-reaktywne'] },
];

describe('analyteKey', () => {
  it('ігнорує регістр, пробіли й розділові знаки', () => {
    expect(analyteKey('Вітамін D (25-OH)')).toBe(analyteKey('вітамін d 25 oh'));
    expect(analyteKey('  HGB ')).toBe(analyteKey('hgb'));
  });

  it('зводить кириличні двійники до латиниці', () => {
    expect(analyteKey('Т4')).toBe(analyteKey('T4')); // кирилична «Т» і латинська «T»
    expect(analyteKey('СРБ')).not.toBe(analyteKey('CRP'));
  });

  it('прибирає діакритику', () => {
    expect(analyteKey('Białko')).toBe(analyteKey('bialko'));
  });
});

describe('findAnalyteByName', () => {
  it('знаходить за основною назвою й синонімами', () => {
    expect(findAnalyteByName(analytes, 'пролактин')?.id).toBe('prl');
    expect(findAnalyteByName(analytes, 'Prolaktyna')?.id).toBe('prl');
    expect(findAnalyteByName(analytes, 'hb')?.id).toBe('hgb');
    expect(findAnalyteByName(analytes, 'Вільний T4')?.id).toBe('ft4');
  });

  it('не знаходить за частиною назви', () => {
    expect(findAnalyteByName(analytes, 'прол')).toBeUndefined();
    expect(findAnalyteByName(analytes, '')).toBeUndefined();
  });
});

describe('searchAnalytes', () => {
  it('шукає за початком і входженням, у назві й синонімах', () => {
    expect(searchAnalytes(analytes, 'прол').map((a) => a.id)).toEqual(['prl']);
    expect(searchAnalytes(analytes, 'prl').map((a) => a.id)).toEqual(['prl']);
    expect(searchAnalytes(analytes, 'вітамін').map((a) => a.id)).toEqual(['vitd']);
    expect(searchAnalytes(analytes, 'reaktyw').map((a) => a.id)).toEqual(['crp']);
  });

  it('точний збіг вище за входження', () => {
    const list: Analyte[] = [
      { id: 'a', name: 'Free T4 index', synonyms: [] },
      { id: 'b', name: 'T4', synonyms: [] },
    ];
    expect(searchAnalytes(list, 't4').map((a) => a.id)).toEqual(['b', 'a']);
  });

  it('порожній запит повертає всі за абеткою', () => {
    expect(searchAnalytes(analytes, ' ')).toHaveLength(analytes.length);
    expect(searchAnalytes(analytes, '')[0]?.name).toBe('Вільний Т4');
  });
});

describe('analyteMatches', () => {
  it('перевіряє входження в будь-яку з назв', () => {
    const prl = analytes[0]!;
    expect(analyteMatches(prl, 'lact')).toBe(true);
    expect(analyteMatches(prl, 'глюк')).toBe(false);
  });
});
