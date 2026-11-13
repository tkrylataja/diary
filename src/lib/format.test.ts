import { describe, expect, it } from 'vitest';
import { formatDateLong, formatNumber, formatRef, formatValue, parseDecimal } from './format';

describe('formatDateLong', () => {
  it('форматує рядок YYYY-MM-DD', () => {
    expect(formatDateLong('2024-03-04')).toBe('4 березня 2024');
    expect(formatDateLong('2026-10-28')).toBe('28 жовтня 2026');
  });

  it('форматує Date за місцевим часом', () => {
    expect(formatDateLong(new Date(2021, 0, 12))).toBe('12 січня 2021');
  });
});

describe('formatNumber', () => {
  it('показує десяткові з комою', () => {
    expect(formatNumber(26.9)).toBe('26,9');
    expect(formatNumber(4.79)).toBe('4,79');
    expect(formatNumber(71)).toBe('71');
  });
});

describe('parseDecimal', () => {
  it('приймає кому й крапку', () => {
    expect(parseDecimal('26,9')).toBe(26.9);
    expect(parseDecimal('26.9')).toBe(26.9);
    expect(parseDecimal(' 1 234,5 ')).toBe(1234.5);
    expect(parseDecimal(',5')).toBe(0.5);
    expect(parseDecimal('−2,1')).toBe(-2.1);
  });

  it('не число — undefined', () => {
    expect(parseDecimal('')).toBeUndefined();
    expect(parseDecimal('<0.5')).toBeUndefined();
    expect(parseDecimal('негативний')).toBeUndefined();
    expect(parseDecimal('1,2,3')).toBeUndefined();
    expect(parseDecimal('1e5')).toBeUndefined();
  });
});

describe('formatRef', () => {
  it('діапазон, односторонні межі й текст', () => {
    expect(formatRef({ refLow: 4.79, refHigh: 23.3 })).toBe('4,79–23,3');
    expect(formatRef({ refLow: 30 })).toBe('≥ 30');
    expect(formatRef({ refHigh: 5 })).toBe('≤ 5');
    expect(formatRef({ refText: 'негативний' })).toBe('негативний');
    expect(formatRef({})).toBe('');
  });
});

describe('formatValue', () => {
  it('число з комою або текст', () => {
    expect(formatValue({ value: 15.4 })).toBe('15,4');
    expect(formatValue({ valueText: '<0.5' })).toBe('<0.5');
  });
});

describe('plural', () => {
  it('українські форми множини', async () => {
    const { countLabel, RECORD_FORMS } = await import('./format');
    expect(countLabel(1, RECORD_FORMS)).toBe('1 запис');
    expect(countLabel(3, RECORD_FORMS)).toBe('3 записи');
    expect(countLabel(5, RECORD_FORMS)).toBe('5 записів');
    expect(countLabel(11, RECORD_FORMS)).toBe('11 записів');
    expect(countLabel(12, RECORD_FORMS)).toBe('12 записів');
    expect(countLabel(21, RECORD_FORMS)).toBe('21 запис');
    expect(countLabel(22, RECORD_FORMS)).toBe('22 записи');
  });

  it('короткі частини дати', async () => {
    const { dayOfMonth, monthShort, todayIso } = await import('./format');
    expect(dayOfMonth('2024-03-04')).toBe('4');
    expect(monthShort('2024-03-04')).toBe('бер');
    expect(todayIso(new Date(2026, 10, 3))).toBe('2026-11-03');
  });
});
