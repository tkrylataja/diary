import { describe, expect, it } from 'vitest';
import { DbFormatError, isValidDate, parseDb } from './validate';

const valid = {
  version: 1,
  analytes: [{ id: 'prl', name: 'Пролактин', synonyms: ['PRL'], group: 'Гормони' }],
  panels: [
    {
      id: 'p1',
      date: '2024-03-04',
      lab: 'Альфа',
      results: [
        { analyteId: 'prl', value: 26.9, unit: 'ng/mL', refLow: 4.79, refHigh: 23.3 },
        { analyteId: 'prl', valueText: '<0.5' },
      ],
    },
  ],
};

describe('parseDb', () => {
  it('приймає коректні дані', () => {
    expect(parseDb(valid)).toEqual(valid);
  });

  it('відкидає зайві поля', () => {
    const db = parseDb({ ...valid, extra: 1, analytes: [{ ...valid.analytes[0], foo: 2 }] });
    expect(db).not.toHaveProperty('extra');
    expect(db.analytes[0]).not.toHaveProperty('foo');
  });

  it('синоніми необов’язкові', () => {
    const db = parseDb({ ...valid, analytes: [{ id: 'prl', name: 'Пролактин' }] });
    expect(db.analytes[0]?.synonyms).toEqual([]);
  });

  const broken: [string, unknown][] = [
    ['не об’єкт', 'text'],
    ['інша версія', { ...valid, version: 2 }],
    ['немає panels', { version: 1, analytes: [] }],
    ['погана дата', { ...valid, panels: [{ ...valid.panels[0], date: '2024-02-30' }] }],
    [
      'невідомий показник',
      { ...valid, panels: [{ ...valid.panels[0], results: [{ analyteId: 'x', value: 1 }] }] },
    ],
    [
      'результат без значення',
      { ...valid, panels: [{ ...valid.panels[0], results: [{ analyteId: 'prl' }] }] },
    ],
    [
      'значення не число',
      { ...valid, panels: [{ ...valid.panels[0], results: [{ analyteId: 'prl', value: '5' }] }] },
    ],
    ['повтор id показника', { ...valid, analytes: [valid.analytes[0], valid.analytes[0]] }],
    ['повтор id запису', { ...valid, panels: [valid.panels[0], valid.panels[0]] }],
  ];
  it.each(broken)('відкидає: %s', (_, input) => {
    expect(() => parseDb(input)).toThrow(DbFormatError);
  });
});

describe('isValidDate', () => {
  it('перевіряє календарну дату', () => {
    expect(isValidDate('2024-02-29')).toBe(true);
    expect(isValidDate('2023-02-29')).toBe(false);
    expect(isValidDate('2024-3-4')).toBe(false);
  });
});

describe('резервна копія JSON', () => {
  it('копія, збережена як JSON, відновлюється без втрат', async () => {
    const { default: demo } = await import('../../demo/demo-data.json');
    const db = parseDb(demo);
    const backup = JSON.stringify(db, null, 2) + '\n';
    expect(parseDb(JSON.parse(backup))).toEqual(db);
  });
});
