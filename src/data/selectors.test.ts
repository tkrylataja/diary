import { describe, expect, it } from 'vitest';
import demoJson from '../../demo/demo-data.json';
import {
  analyteMap,
  analyteSeries,
  groupPanelResults,
  groupPanelsByYear,
  panelMatches,
  periodStart,
  sortPanelsDesc,
  unitSummary,
} from './selectors';
import type { SeriesPoint } from './selectors';
import { parseDb } from './validate';

const db = parseDb(demoJson);
const analytes = analyteMap(db.analytes);

describe('список за датами', () => {
  it('сортує від новіших і групує за роками', () => {
    const groups = groupPanelsByYear(sortPanelsDesc(db.panels));
    expect(groups.map((g) => g.year)).toEqual(['2026', '2025', '2024', '2023', '2022', '2021']);
    expect(groups.find((g) => g.year === '2022')?.panels.map((p) => p.date)).toEqual([
      '2022-09-20',
      '2022-02-08',
    ]);
  });

  it('пошук за показником, синонімом і лабораторією', () => {
    const find = (q: string) =>
      db.panels.filter((p) => panelMatches(p, q, analytes)).map((p) => p.date);
    expect(find('глюкоза')).toEqual(['2024-03-04']);
    expect(find('HGB')).toEqual(['2022-02-08', '2024-03-04']);
    expect(find('beta')).toEqual(['2022-09-20', '2023-05-15']);
    expect(find('')).toHaveLength(db.panels.length);
    expect(find('інсулін')).toEqual([]);
  });
});

describe('пакет за датою', () => {
  it('групує показники за групами в порядку появи', () => {
    const panel = db.panels.find((p) => p.date === '2024-03-04')!;
    const groups = groupPanelResults(panel, analytes);
    expect(groups.map((g) => g.group)).toEqual(['Гормони', 'Вітаміни й залізо', 'Кров і біохімія']);
    expect(groups[0]?.items.map((i) => i.analyte.name)).toEqual(['Пролактин', 'ТТГ', 'Вільний Т4']);
  });

  it('показники без групи потрапляють в «Інше» в кінці', () => {
    const groups = groupPanelResults(
      {
        id: 'p',
        date: '2024-01-01',
        results: [
          { analyteId: 'x', value: 1 },
          { analyteId: 'prolactin', value: 2 },
        ],
      },
      new Map([...analytes, ['x', { id: 'x', name: 'Інсулін', synonyms: [] }]]),
    );
    expect(groups.map((g) => g.group)).toEqual(['Гормони', 'Інше']);
  });
});

describe('динаміка', () => {
  it('ряд показника від старіших до новіших', () => {
    expect(analyteSeries(db, 'prolactin').map((p) => p.panel.date)).toEqual([
      '2021-03-12',
      '2022-02-08',
      '2022-09-20',
      '2023-05-15',
      '2024-03-04',
      '2025-02-17',
      '2026-10-28',
    ]);
  });

  it('однакові одиниці', () => {
    expect(unitSummary(analyteSeries(db, 'prolactin'))).toEqual({
      units: ['ng/mL'],
      main: 'ng/mL',
      consistent: true,
    });
  });

  it('різні одиниці: основна — найчастіша', () => {
    const s = unitSummary(analyteSeries(db, 'vitamin-d'), 'ng/mL');
    expect(s.consistent).toBe(false);
    expect(s.main).toBe('ng/mL');
    expect(s.units).toEqual(['ng/mL', 'nmol/L']);
  });

  it('при рівності — одиниця за замовчуванням, інакше найновіша', () => {
    const pt = (date: string, unit: string): SeriesPoint => ({
      panel: { id: date, date, results: [] },
      result: { analyteId: 'x', value: 1, unit },
    });
    const points = [pt('2020-01-01', 'a'), pt('2021-01-01', 'b')];
    expect(unitSummary(points, 'a').main).toBe('a');
    expect(unitSummary(points).main).toBe('b');
  });

  it('початок періоду', () => {
    expect(periodStart('1y', '2026-11-13')).toBe('2025-11-13');
    expect(periodStart('3y', '2026-11-13')).toBe('2023-11-13');
    expect(periodStart('all', '2026-11-13')).toBeUndefined();
  });
});
