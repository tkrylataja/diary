import { createContext, useContext } from 'react';
import type { Db } from '../data/types';

export type DbContextValue = {
  /** Розшифровані дані. Живуть лише в пам'яті сторінки (SPEC §2). */
  db: Db;
  /** Є зміни, яких ще немає у завантаженому data.enc. */
  dirty: boolean;
  /** Коли з'явилася перша незбережена зміна. */
  dirtySince: Date | null;
  /** Скільки записів додано з моменту останнього збереження файлу. */
  newRecords: number;
  /** Змінює дані й позначає їх незбереженими. */
  updateDb: (change: (db: Db) => Db) => void;
  /**
   * Шифрує поточні дані ключем сесії. Повертає вміст data.enc і функцію,
   * що позначає саме цей знімок збереженим (викликати після завантаження файлу).
   */
  exportEncrypted: () => Promise<{ text: string; markSaved: () => void }>;
  /** Стирає розшифровані дані з пам'яті й повертає на екран розблокування. */
  lock: () => void;
};

export const DbContext = createContext<DbContextValue | null>(null);

/** Доступ до даних. Працює лише всередині розблокованого застосунку. */
export function useDb(): DbContextValue {
  const value = useContext(DbContext);
  if (!value) throw new Error('useDb викликано поза розблокованим застосунком');
  return value;
}
