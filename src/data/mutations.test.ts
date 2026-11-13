import { describe, expect, it } from 'vitest';
import demoJson from '../../demo/demo-data.json';
import {
  cleanSynonyms,
  deleteAnalyte,
  deletePanel,
  findNameConflict,
  knownGroups,
  lastResultFor,
  latestPanel,
  mergeAnalytes,
  recentLabs,
  upsertAnalyte,
  usageCount,
} from './mutations';
import { parseDb } from './validate';

const db = parseDb(demoJson);

describe('мутації', () => {
  it('не змінюють вихідну базу', () => {
    const before = JSON.stringify(db);
    deletePanel(db, 'demo-2024-03-04');
    mergeAnalytes(db, 'hemoglobin', 'ferritin');
    expect(JSON.stringify(db)).toBe(before);
  });

  it('видаляє запис', () => {
    const next = deletePanel(db, 'demo-2024-03-04');
    expect(next.panels).toHaveLength(db.panels.length - 1);
  });

  it('видаляє лише невикористаний показник', () => {
    expect(() => deleteAnalyte(db, 'prolactin')).toThrow();
    const withNew = upsertAnalyte(db, { id: 'x', name: 'Інсулін', synonyms: [] });
    expect(deleteAnalyte(withNew, 'x').analytes).toHaveLength(db.analytes.length);
  });
});

describe('об’єднання дублів', () => {
  it('переносить результати й назви джерела в ціль', () => {
    const withDup = upsertAnalyte(db, { id: 'hgb2', name: 'HB (крові)', synonyms: ['Hgb total'] });
    const dupPanel = {
      ...withDup,
      panels: [
        ...withDup.panels,
        { id: 'p-x', date: '2020-01-01', results: [{ analyteId: 'hgb2', value: 13 }] },
      ],
    };
    const merged = mergeAnalytes(dupPanel, 'hgb2', 'hemoglobin');
    expect(merged.analytes.find((a) => a.id === 'hgb2')).toBeUndefined();
    const hgb = merged.analytes.find((a) => a.id === 'hemoglobin');
    expect(hgb?.synonyms).toEqual(['HGB', 'Hb', 'Hemoglobina', 'HB (крові)', 'Hgb total']);
    expect(merged.panels.find((p) => p.id === 'p-x')?.results[0]?.analyteId).toBe('hemoglobin');
    expect(usageCount(merged, 'hemoglobin')).toBe(3);
  });
});

describe('синоніми й конфлікти назв', () => {
  it('прибирає порожні, повторені й рівні назві синоніми', () => {
    expect(cleanSynonyms('Гемоглобін', [' HGB ', 'hgb', '', 'гемоглобін', 'Hb'])).toEqual([
      'HGB',
      'Hb',
    ]);
  });

  it('знаходить конфлікт з іншим показником', () => {
    const conflict = findNameConflict(db.analytes, { name: 'Інсулін', synonyms: ['hgb'] });
    expect(conflict?.[1].id).toBe('hemoglobin');
    expect(
      findNameConflict(db.analytes, { id: 'hemoglobin', name: 'Гемоглобін', synonyms: ['HGB'] }),
    ).toBeUndefined();
  });
});

describe('підказки для форми', () => {
  it('останній результат показника', () => {
    expect(lastResultFor(db, 'prolactin')?.value).toBe(15.4);
    expect(lastResultFor(db, 'prolactin', 'demo-2026-10-28')?.value).toBe(17.2);
  });

  it('останні лабораторії без повторів', () => {
    expect(recentLabs(db)).toEqual(['Лабораторія «Альфа»', 'Laboratorium Beta']);
  });

  it('найновіший запис і групи', () => {
    expect(latestPanel(db)?.date).toBe('2026-10-28');
    expect(latestPanel(db, 'demo-2026-10-28')?.date).toBe('2025-02-17');
    expect(knownGroups(db)).toEqual(['Вітаміни й залізо', 'Гормони', 'Кров і біохімія']);
  });
});
