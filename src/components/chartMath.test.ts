import { describe, expect, it } from 'vitest';
import {
  bandSpans,
  dateToTime,
  labelPlacements,
  monthTicks,
  timeDomain,
  timeTicks,
  yTicks,
} from './chartMath';

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

describe('monthTicks', () => {
  const domain: [number, number] = [dateToTime('2024-01-15'), dateToTime('2024-07-20')];

  it('щомісяця, коли місця досить', () => {
    expect(monthTicks(domain, 600)).toEqual([
      '2024-02-01',
      '2024-03-01',
      '2024-04-01',
      '2024-05-01',
      '2024-06-01',
      '2024-07-01',
    ]);
  });

  it('рідше на вузькому графіку', () => {
    const long: [number, number] = [dateToTime('2021-05-01'), dateToTime('2026-11-30')];
    const ticks = monthTicks(long, 300);
    expect(ticks.every((t) => ['01', '04', '07', '10'].includes(t.slice(5, 7)))).toBe(true);
    expect(ticks.length).toBeLessThan(30);
  });
});

describe('labelPlacements', () => {
  it('підписи над точками, а при накладанні — під точкою', () => {
    expect(
      labelPlacements([
        { x: 50, y: 100, width: 30 },
        { x: 150, y: 100, width: 30 },
        { x: 160, y: 104, width: 30 },
      ]),
    ).toEqual(['above', 'above', 'below']);
  });

  it('близькі по горизонталі, але різні по висоті — обидва над точками', () => {
    expect(
      labelPlacements([
        { x: 100, y: 50, width: 30 },
        { x: 105, y: 150, width: 30 },
      ]),
    ).toEqual(['above', 'above']);
  });
});
