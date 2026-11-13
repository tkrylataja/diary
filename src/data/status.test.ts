import { describe, expect, it } from 'vitest';
import { outOfRangeCount, resultStatus, statusArrow } from './status';

const ref = { analyteId: 'x', refLow: 4.79, refHigh: 23.3 };

describe('resultStatus', () => {
  it('у межах референсу — норма, включно з межами', () => {
    expect(resultStatus({ ...ref, value: 15.4 })).toBe('normal');
    expect(resultStatus({ ...ref, value: 23.3 })).toBe('normal');
    expect(resultStatus({ ...ref, value: 4.79 })).toBe('normal');
  });

  it('вище й нижче референсу', () => {
    expect(resultStatus({ ...ref, value: 26.9 })).toBe('high');
    expect(resultStatus({ ...ref, value: 3 })).toBe('low');
  });

  it('односторонній референс', () => {
    expect(resultStatus({ analyteId: 'x', value: 6, refHigh: 5 })).toBe('high');
    expect(resultStatus({ analyteId: 'x', value: 4, refHigh: 5 })).toBe('normal');
    expect(resultStatus({ analyteId: 'x', value: 20, refLow: 30 })).toBe('low');
  });

  it('без числа або без референсу — невідомо', () => {
    expect(resultStatus({ analyteId: 'x', valueText: '<0.5', refHigh: 5 })).toBe('unknown');
    expect(resultStatus({ analyteId: 'x', value: 5 })).toBe('unknown');
    expect(resultStatus({ analyteId: 'x', value: 5, refText: 'негативний' })).toBe('unknown');
  });

  it('стрілки', () => {
    expect(statusArrow('high')).toBe('↑');
    expect(statusArrow('low')).toBe('↓');
    expect(statusArrow('normal')).toBe('');
  });

  it('рахує значення поза нормою в пакеті', () => {
    const panel = {
      id: 'p',
      date: '2024-03-04',
      results: [
        { ...ref, value: 26.9 },
        { ...ref, value: 1 },
        { ...ref, value: 10 },
      ],
    };
    expect(outOfRangeCount(panel)).toBe(2);
  });
});
