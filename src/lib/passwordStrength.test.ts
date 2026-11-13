import { describe, expect, it } from 'vitest';
import { estimateStrength } from './passwordStrength';

describe('estimateStrength', () => {
  it('короткий пароль неприйнятний', () => {
    const s = estimateStrength('коротко');
    expect(s.level).toBe(0);
    expect(s.acceptable).toBe(false);
  });

  it('повтори й поширені шаблони — слабкий', () => {
    expect(estimateStrength('aaaaaaaaaaaaaaaa').level).toBe(1);
    expect(estimateStrength('abcabcabcabc').level).toBe(1);
    expect(estimateStrength('password1234').level).toBe(1);
  });

  it('12 випадкових малих літер — середній', () => {
    expect(estimateStrength('kdjfhgqpwmzx').level).toBe(2);
  });

  it('фраза з 4–5 слів — надійний', () => {
    expect(estimateStrength('кіт сонце ранок вікно').level).toBe(3);
    expect(estimateStrength('purple river eats quiet lamps').level).toBe(3);
  });
});
