import { describe, expect, it } from 'vitest';
import { bandSpans, dateToTime, timeDomain, timeTicks, yTicks } from './chartMath';

describe('yTicks', () => {
  it('починається з нуля й покриває максимум', () => {
    expect(yTicks(31.5)).toEqual([0, 10, 20, 30, 40]);
    expect(yTicks(4.2)).toEqual([0, 2, 4, 6]);
    expect(yTicks(100)).toEqual([0, 25, 50, 75, 100]);
  });

  it('нуль або від’ємний максимум не ламає шкалу', () => {
    expect(yTicks(0)).toEqual([0, 1]);
  });
});

describe('timeTicks', () => {
  it('роки для довгих проміжків', () => {
    const domain = timeDomain([dateToTime('2021-03-12'), dateToTime('2026-10-28')]);
    expect(timeTicks(domain)).toEqual([
      '2021-01-01',
      '2022-01-01',
      '2023-01-01',
      '2024-01-01',
      '2025-01-01',
      '2026-01-01',
      '2027-01-01',
    ]);
  });

  it('місяці для коротких проміжків', () => {
    const domain: [number, number] = [dateToTime('2024-01-15'), dateToTime('2024-07-20')];
    expect(timeTicks(domain)).toEqual([
      '2024-02-01',
      '2024-03-01',
      '2024-04-01',
      '2024-05-01',
      '2024-06-01',
      '2024-07-01',
    ]);
  });

  it('одна точка дає вузький проміжок без помилок', () => {
    const t = dateToTime('2024-03-04');
    const domain = timeDomain([t]);
    expect(domain[0]).toBeLessThan(t);
    expect(domain[1]).toBeGreaterThan(t);
    expect(timeTicks(domain).length).toBeGreaterThan(0);
  });
});

describe('bandSpans', () => {
  it('ділить простір між сусідніми точками навпіл', () => {
    expect(bandSpans([10, 50, 90], 0, 100, 14)).toEqual([
      { x0: 0, x1: 30 },
      { x0: 30, x1: 70 },
      { x0: 70, x1: 100 },
    ]);
  });

  it('одна точка — смуга навколо неї', () => {
    expect(bandSpans([50], 0, 100, 14)).toEqual([{ x0: 36, x1: 64 }]);
  });
});
