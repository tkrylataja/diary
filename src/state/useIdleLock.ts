import { useCallback, useEffect, useRef, useState } from 'react';
import { IDLE_WARNING_MS, idleAction } from './idle';

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;

/**
 * Стежить за бездіяльністю. Повертає секунди до блокування, поки показується
 * попередження (або null), і функцію «продовжити роботу».
 * Час рахується за годинником, тож працює й після сну телефона.
 */
export function useIdleLock({
  active,
  dirty,
  onLock,
}: {
  active: boolean;
  dirty: boolean;
  onLock: () => void;
}) {
  const lastActivity = useRef(0); // задається при активації
  const warnUntil = useRef<number | null>(null);
  const dirtyRef = useRef(dirty);
  const onLockRef = useRef(onLock);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    dirtyRef.current = dirty;
    onLockRef.current = onLock;
  });

  const keepWorking = useCallback(() => {
    lastActivity.current = Date.now();
    warnUntil.current = null;
    setSecondsLeft(null);
  }, []);

  useEffect(() => {
    if (!active) return;
    lastActivity.current = Date.now();
    warnUntil.current = null;

    const mark = () => {
      // Під час попередження активність не скасовує його: треба натиснути кнопку.
      if (warnUntil.current === null) lastActivity.current = Date.now();
    };

    const tick = () => {
      const now = Date.now();
      if (warnUntil.current !== null) {
        if (now >= warnUntil.current) {
          warnUntil.current = null;
          setSecondsLeft(null);
          onLockRef.current();
        } else {
          setSecondsLeft(Math.ceil((warnUntil.current - now) / 1000));
        }
        return;
      }
      const action = idleAction(now - lastActivity.current, dirtyRef.current);
      if (action === 'lock') onLockRef.current();
      else if (action === 'warn') {
        warnUntil.current = now + IDLE_WARNING_MS;
        setSecondsLeft(Math.ceil(IDLE_WARNING_MS / 1000));
      }
    };

    for (const e of ACTIVITY_EVENTS) window.addEventListener(e, mark, { passive: true });
    document.addEventListener('visibilitychange', tick);
    const timer = window.setInterval(tick, 1000);
    return () => {
      for (const e of ACTIVITY_EVENTS) window.removeEventListener(e, mark);
      document.removeEventListener('visibilitychange', tick);
      window.clearInterval(timer);
      setSecondsLeft(null);
    };
  }, [active]);

  return { secondsLeft, keepWorking };
}
