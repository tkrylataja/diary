// Автоблокування після бездіяльності (SPEC §6.7).

export const IDLE_LOCK_MS = 10 * 60 * 1000;
/** Скільки триває попередження перед блокуванням, якщо є незбережені зміни. */
export const IDLE_WARNING_MS = 60 * 1000;

export type IdleAction = 'none' | 'warn' | 'lock';

/** Без незбережених змін блокуємо одразу; з ними — спершу попереджаємо. */
export function idleAction(idleMs: number, dirty: boolean): IdleAction {
  if (idleMs < IDLE_LOCK_MS) return 'none';
  return dirty ? 'warn' : 'lock';
}
