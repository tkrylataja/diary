import { describe, expect, it } from 'vitest';
import demoJson from '../../demo/demo-data.json';
import {
  applyDraft,
  draftFromPanel,
  emptyDraft,
  emptyRow,
  hasErrors,
  rowForAnalyte,
  validateDraft,
  type PanelDraft,
} from './panelDraft';
import { parseDb } from './validate';

const db = parseDb(demoJson);
const prl = db.analytes.find((a) => a.id === 'prolactin')!;

function draft(partial: Partial<PanelDraft>): PanelDraft {
  return { ...emptyDraft('2026-11-13'), ...partial };
}

describe('перевірка чернетки', () => {
  it('дата обов’язкова й має бути справжньою', () => {
    expect(validateDraft(draft({ date: '' })).date).toBeDefined();
    expect(validateDraft(draft({ date: '2026-02-30' })).date).toBeDefined();
  });

  it('потрібен хоча б один показник; порожні рядки ігноруються', () => {
    const errors = validateDraft(draft({ results: [emptyRow(), emptyRow()] }));
    expect(errors.results).toBe('Додайте хоча б один показник');
  });

  it('рядок без показника або без значення — помилка', () => {
    const noValue = { ...rowForAnalyte(db, prl) };
    const noAnalyte = { ...emptyRow(), value: '5' };
    const errors = validateDraft(draft({ results: [noValue, noAnalyte] }));
    expect(errors.rows[noValue.key]?.value).toBeDefined();
    expect(errors.rows[noAnalyte.key]?.analyte).toBeDefined();
  });

  it('референс має бути числом, нижня межа не більша за верхню', () => {
    const row = { ...rowForAnalyte(db, prl), value: '10', refLow: 'abc', refHigh: '1' };
    expect(validateDraft(draft({ results: [row] })).rows[row.key]).toEqual({
      refLow: 'Має бути число',
    });
    const swapped = { ...row, refLow: '5', refHigh: '1' };
    expect(validateDraft(draft({ results: [swapped] })).rows[swapped.key]?.refHigh).toBeDefined();
  });

  it('коректна чернетка без помилок', () => {
    const row = { ...rowForAnalyte(db, prl), value: '15,4' };
    expect(hasErrors(validateDraft(draft({ results: [row, emptyRow()] })))).toBe(false);
  });
});

describe('підстановка з останнього запису', () => {
  it('одиниці й референс беруться з останнього результату показника', () => {
    const row = rowForAnalyte(db, prl);
    expect(row).toMatchObject({ unit: 'ng/mL', refLow: '4,79', refHigh: '23,3', value: '' });
  });
});

describe('збереження чернетки', () => {
  it('додає новий запис: кома, текстове значення, порожні поля відкидаються', () => {
    const rows = [
      { ...rowForAnalyte(db, prl), value: '15,4' },
      {
        ...rowForAnalyte(
          db,
          db.analytes.find((a) => a.id === 'crp')!,
        ),
        value: '<0.5',
      },
      emptyRow(),
    ];
    const { db: next, panelId } = applyDraft(
      db,
      draft({ lab: '  Альфа ', note: '', results: rows }),
    );
    const panel = next.panels.find((p) => p.id === panelId)!;
    expect(panel).toEqual({
      id: panelId,
      date: '2026-11-13',
      lab: 'Альфа',
      results: [
        { analyteId: 'prolactin', value: 15.4, unit: 'ng/mL', refLow: 4.79, refHigh: 23.3 },
        // Назва з бланка підставляється з останнього запису CRP.
        { analyteId: 'crp', nameOriginal: 'CRP', valueText: '<0.5', unit: 'mg/L', refHigh: 5 },
      ],
    });
    expect(next.panels).toHaveLength(db.panels.length + 1);
  });

  it('створює новий показник один раз і перевикористовує наявний за синонімом', () => {
    const rows = [
      { ...emptyRow(), newName: 'Інсулін', newGroup: 'Гормони', value: '7', unit: 'µIU/mL' },
      { ...emptyRow(), newName: 'інсулін', value: '8' },
      { ...emptyRow(), newName: 'PRL', value: '12' },
    ];
    const { db: next, panelId } = applyDraft(db, draft({ results: rows }));
    const insulin = next.analytes.filter((a) => a.name === 'Інсулін');
    expect(insulin).toHaveLength(1);
    expect(insulin[0]).toMatchObject({ group: 'Гормони', defaultUnit: 'µIU/mL', synonyms: [] });
    const ids = next.panels.find((p) => p.id === panelId)!.results.map((r) => r.analyteId);
    expect(ids).toEqual([insulin[0]!.id, insulin[0]!.id, 'prolactin']);
  });

  it('редагування замінює запис і зберігає теги', () => {
    const original = db.panels.find((p) => p.id === 'demo-2026-10-28')!;
    const d = draftFromPanel(original);
    d.results[0] = { ...d.results[0]!, value: '16.1' };
    const { db: next, panelId } = applyDraft(db, d, original);
    expect(panelId).toBe(original.id);
    expect(next.panels).toHaveLength(db.panels.length);
    const edited = next.panels.find((p) => p.id === original.id)!;
    expect(edited.results[0]?.value).toBe(16.1);
    expect(edited.tags).toEqual(['планове']);
  });

  it('чернетка з запису й назад дає той самий запис', () => {
    for (const panel of db.panels) {
      const { db: next } = applyDraft(db, draftFromPanel(panel), panel);
      expect(next.panels.find((p) => p.id === panel.id)).toEqual(panel);
    }
  });
});
