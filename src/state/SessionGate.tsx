import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { encryptWithKey, type SessionKey } from '../crypto/crypto';
import { fetchDataFile } from '../data/dataFile';
import type { Db } from '../data/types';
import { FirstRunScreen } from '../screens/FirstRunScreen';
import { LoadErrorScreen, LoadingScreen } from '../screens/StatusScreen';
import { UnlockScreen } from '../screens/UnlockScreen';
import { IdleWarning } from '../components/IdleWarning';
import { DbContext, type DbContextValue } from './dbContext';
import { useIdleLock } from './useIdleLock';

type Unlocked = {
  name: 'unlocked';
  db: Db;
  session: SessionKey;
  /** Записи, що вже є у збереженому data.enc (щоб рахувати нові). */
  savedPanelIds: ReadonlySet<string>;
  /** Коли з'явилася перша незбережена зміна; null — змін немає. */
  dirtySince: Date | null;
};

type Phase =
  | { name: 'loading' }
  | { name: 'error' }
  | { name: 'first-run' }
  | { name: 'locked'; fileText: string; updatedAt: Date | null }
  | Unlocked;

/**
 * Завантажує data.enc і показує розблокування або перший запуск.
 * Діти рендеряться лише після розблокування й отримують дані через DbContext.
 */
export function SessionGate({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>({ name: 'loading' });

  const load = useCallback(async () => {
    setPhase({ name: 'loading' });
    const result = await fetchDataFile();
    if (result.status === 'missing') setPhase({ name: 'first-run' });
    else if (result.status === 'error') setPhase({ name: 'error' });
    else setPhase({ name: 'locked', fileText: result.text, updatedAt: result.updatedAt });
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- початкове завантаження файлу
    void load();
  }, [load]);

  const updateDb = useCallback((change: (db: Db) => Db) => {
    setPhase((p) =>
      p.name === 'unlocked'
        ? { ...p, db: change(p.db), dirtySince: p.dirtySince ?? new Date() }
        : p,
    );
  }, []);

  const lock = useCallback(() => void load(), [load]);

  const unlocked = phase.name === 'unlocked' ? phase : null;
  const db = unlocked?.db ?? null;
  const session = unlocked?.session ?? null;
  const savedPanelIds = unlocked?.savedPanelIds ?? null;
  const dirtySince = unlocked?.dirtySince ?? null;
  const dirty = dirtySince !== null;

  const exportEncrypted = useCallback(async () => {
    if (!db || !session) throw new Error('Дані заблоковано');
    const snapshot = db;
    const file = await encryptWithKey(session, snapshot);
    return {
      text: JSON.stringify(file) + '\n',
      markSaved: () =>
        setPhase((p) =>
          // Якщо після шифрування дані встигли змінитися, вони лишаються незбереженими.
          p.name === 'unlocked' && p.db === snapshot
            ? { ...p, dirtySince: null, savedPanelIds: new Set(snapshot.panels.map((x) => x.id)) }
            : p,
        ),
    };
  }, [db, session]);

  const value = useMemo<DbContextValue | null>(() => {
    if (!db || !savedPanelIds) return null;
    return {
      db,
      dirty,
      dirtySince,
      newRecords: db.panels.filter((p) => !savedPanelIds.has(p.id)).length,
      updateDb,
      exportEncrypted,
      lock,
    };
  }, [db, savedPanelIds, dirty, dirtySince, updateDb, exportEncrypted, lock]);

  const { secondsLeft, keepWorking } = useIdleLock({
    active: phase.name === 'unlocked',
    dirty,
    onLock: lock,
  });

  // Попередження браузера при закритті вкладки з незбереженими змінами (SPEC §6.7).
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  switch (phase.name) {
    case 'loading':
      return <LoadingScreen />;
    case 'error':
      return <LoadErrorScreen onRetry={() => void load()} />;
    case 'first-run':
      return (
        <FirstRunScreen
          onCreated={(created, key) =>
            setPhase({
              name: 'unlocked',
              db: created,
              session: key,
              savedPanelIds: new Set(),
              dirtySince: new Date(),
            })
          }
        />
      );
    case 'locked':
      return (
        <UnlockScreen
          fileText={phase.fileText}
          updatedAt={phase.updatedAt}
          onUnlocked={(opened, key) =>
            setPhase({
              name: 'unlocked',
              db: opened,
              session: key,
              savedPanelIds: new Set(opened.panels.map((p) => p.id)),
              dirtySince: null,
            })
          }
        />
      );
    case 'unlocked':
      return (
        <DbContext.Provider value={value}>
          {children}
          {secondsLeft !== null && (
            <IdleWarning secondsLeft={secondsLeft} onContinue={keepWorking} />
          )}
        </DbContext.Provider>
      );
  }
}
