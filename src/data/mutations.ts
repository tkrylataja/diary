// Чисті функції зміни бази. Кожна повертає нову Db, стару не змінює.
import { analyteKey, analyteNames } from './analytes';
import type { Analyte, Db, Panel, Result } from './types';
import { sameUnit } from './units';

export function newId(): string {
  return crypto.randomUUID();
}

export function upsertPanel(db: Db, panel: Panel): Db {
  const exists = db.panels.some((p) => p.id === panel.id);
  return {
    ...db,
    panels: exists ? db.panels.map((p) => (p.id === panel.id ? panel : p)) : [...db.panels, panel],
  };
}

export function deletePanel(db: Db, panelId: string): Db {
  return { ...db, panels: db.panels.filter((p) => p.id !== panelId) };
}

export function upsertAnalyte(db: Db, analyte: Analyte): Db {
  const exists = db.analytes.some((a) => a.id === analyte.id);
  return {
    ...db,
    analytes: exists
      ? db.analytes.map((a) => (a.id === analyte.id ? analyte : a))
      : [...db.analytes, analyte],
  };
}

export function usageCount(db: Db, analyteId: string): number {
  return db.panels.filter((p) => p.results.some((r) => r.analyteId === analyteId)).length;
}

/** Видаляє показник, лише якщо він не використовується в жодному записі. */
export function deleteAnalyte(db: Db, analyteId: string): Db {
  if (usageCount(db, analyteId) > 0) {
    throw new Error('Показник використовується в записах');
  }
  return { ...db, analytes: db.analytes.filter((a) => a.id !== analyteId) };
}

/** Прибирає порожні й повторені (з точністю до analyteKey) синоніми та збіги з назвою. */
export function cleanSynonyms(name: string, synonyms: string[]): string[] {
  const seen = new Set([analyteKey(name)]);
  const result: string[] = [];
  for (const raw of synonyms) {
    const s = raw.trim();
    const key = analyteKey(s);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(s);
  }
  return result;
}

/**
 * Шукає інший показник, у якого вже є така назва чи синонім.
 * Повертає [назва, показник-власник] першого конфлікту.
 */
export function findNameConflict(
  analytes: Analyte[],
  candidate: { id?: string; name: string; synonyms: string[] },
): [string, Analyte] | undefined {
  for (const name of [candidate.name, ...candidate.synonyms]) {
    const key = analyteKey(name);
    if (!key) continue;
    const owner = analytes.find(
      (a) => a.id !== candidate.id && analyteNames(a).some((n) => analyteKey(n) === key),
    );
    if (owner) return [name, owner];
  }
  return undefined;
}

/**
 * Об'єднує дублі (HGB = Гемоглобін): усі результати джерела переходять до цілі,
 * назва й синоніми джерела стають синонімами цілі, джерело видаляється.
 */
export function mergeAnalytes(db: Db, sourceId: string, targetId: string): Db {
  if (sourceId === targetId) return db;
  const source = db.analytes.find((a) => a.id === sourceId);
  const target = db.analytes.find((a) => a.id === targetId);
  if (!source || !target) throw new Error('Показник не знайдено');

  const merged: Analyte = {
    ...target,
    synonyms: cleanSynonyms(target.name, [...target.synonyms, source.name, ...source.synonyms]),
  };
  if (!merged.group && source.group) merged.group = source.group;
  if (!merged.defaultUnit && source.defaultUnit) merged.defaultUnit = source.defaultUnit;
  // Коефіцієнти дубля підходять, лише якщо вони рахуються від тих самих основних одиниць.
  if (
    !merged.conversions &&
    source.conversions &&
    sameUnit(merged.defaultUnit, source.defaultUnit)
  ) {
    merged.conversions = source.conversions;
  }

  return {
    ...db,
    analytes: db.analytes
      .filter((a) => a.id !== sourceId)
      .map((a) => (a.id === targetId ? merged : a)),
    panels: db.panels.map((p) =>
      p.results.some((r) => r.analyteId === sourceId)
        ? {
            ...p,
            results: p.results.map((r) =>
              r.analyteId === sourceId ? { ...r, analyteId: targetId } : r,
            ),
          }
        : p,
    ),
  };
}

/** Найновіший результат показника (для підстановки одиниць і референсу). */
export function lastResultFor(
  db: Db,
  analyteId: string,
  excludePanelId?: string,
): Result | undefined {
  let best: { date: string; result: Result } | undefined;
  for (const panel of db.panels) {
    if (panel.id === excludePanelId) continue;
    for (const result of panel.results) {
      if (result.analyteId === analyteId && (!best || panel.date >= best.date)) {
        best = { date: panel.date, result };
      }
    }
  }
  return best?.result;
}

/** Останні використані лабораторії, від новіших до старіших, без повторів. */
export function recentLabs(db: Db, limit = 4): string[] {
  const labs: string[] = [];
  const sorted = [...db.panels].sort((a, b) => b.date.localeCompare(a.date));
  for (const p of sorted) {
    const lab = p.lab?.trim();
    if (lab && !labs.some((l) => l.toLowerCase() === lab.toLowerCase())) labs.push(lab);
    if (labs.length >= limit) break;
  }
  return labs;
}

/** Найновіший запис, крім поточного (для «Взяти з попереднього запису»). */
export function latestPanel(db: Db, excludePanelId?: string): Panel | undefined {
  return [...db.panels]
    .filter((p) => p.id !== excludePanelId)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
}

/** Усі назви груп, що вже є, за абеткою. */
export function knownGroups(db: Db): string[] {
  const groups = new Set(db.analytes.map((a) => a.group?.trim()).filter((g): g is string => !!g));
  return [...groups].sort((a, b) => a.localeCompare(b, 'uk'));
}

/**
 * Додає назви з бланків (Result.nameOriginal) у синоніми їхніх показників, щоб пошук
 * знаходив і за ними. Назву, що вже належить іншому показнику, не чіпаємо.
 */
export function syncOriginalSynonyms(db: Db): Db {
  const extra = new Map<string, string[]>();
  for (const panel of db.panels) {
    for (const r of panel.results) {
      const name = r.nameOriginal?.trim();
      if (name) extra.set(r.analyteId, [...(extra.get(r.analyteId) ?? []), name]);
    }
  }
  if (extra.size === 0) return db;
  let changed = false;
  const analytes = db.analytes.map((a) => {
    const names = (extra.get(a.id) ?? []).filter(
      (n) => !findNameConflict(db.analytes, { id: a.id, name: n, synonyms: [] }),
    );
    const synonyms = cleanSynonyms(a.name, [...a.synonyms, ...names]);
    if (synonyms.length === a.synonyms.length) return a;
    changed = true;
    return { ...a, synonyms };
  });
  return changed ? { ...db, analytes } : db;
}

/**
 * Прибирає один результат (за індексом) з обстеження. Якщо він був останнім,
 * видаляється й саме обстеження, бо запис без показників не має сенсу.
 */
export function deleteResult(
  db: Db,
  panelId: string,
  index: number,
): { db: Db; panelDeleted: boolean } {
  const panel = db.panels.find((p) => p.id === panelId);
  if (!panel || index < 0 || index >= panel.results.length) return { db, panelDeleted: false };
  if (panel.results.length === 1) return { db: deletePanel(db, panelId), panelDeleted: true };
  const results = panel.results.filter((_, i) => i !== index);
  return { db: upsertPanel(db, { ...panel, results }), panelDeleted: false };
}
