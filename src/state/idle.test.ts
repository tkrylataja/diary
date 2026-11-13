import { describe, expect, it } from 'vitest';
import { IDLE_LOCK_MS, idleAction } from './idle';

describe('idleAction', () => {
  it('до 10 хвилин нічого не робить', () => {
    expect(idleAction(IDLE_LOCK_MS - 1, true)).toBe('none');
  });

  it('після 10 хвилин блокує, а з незбереженими змінами — попереджає', () => {
    expect(idleAction(IDLE_LOCK_MS, false)).toBe('lock');
    expect(idleAction(IDLE_LOCK_MS * 3, true)).toBe('warn');
  });
});
