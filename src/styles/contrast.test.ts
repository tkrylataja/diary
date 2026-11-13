// Перевірка контрасту токенів (SPEC §7): текст ≥ 4.5:1, великий текст і рамки ≥ 3:1.
// Кольори читаються прямо з tokens.css, тож тест стежить за єдиним джерелом.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
const tokens = Object.fromEntries(
  [...css.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})\s*;/gi)].map((m) => [m[1], m[2]]),
);

function color(name: string): string {
  const value = tokens[name];
  if (!value) throw new Error(`Немає токена --${name}`);
  return value;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (l1 + 0.05) / (l2 + 0.05);
}

// [передній план, фон] — пари, що реально трапляються в інтерфейсі.
const TEXT_PAIRS: [string, string][] = [
  ['color-text', 'color-bg'],
  ['color-text', 'color-surface'],
  ['color-text', 'color-lavender'],
  ['color-text', 'color-high-bg'],
  ['color-text', 'color-low-bg'],
  ['color-text-muted', 'color-surface'],
  ['color-text-muted', 'color-bg'],
  ['color-text-muted', 'color-lavender'],
  ['color-text-muted', 'color-high-bg'],
  ['color-text-muted', 'color-low-bg'],
  ['color-high', 'color-surface'],
  ['color-high', 'color-high-bg'],
  ['color-low', 'color-surface'],
  ['color-low', 'color-low-bg'],
  ['color-lavender-ink', 'color-surface'],
  ['color-lavender-ink', 'color-lavender'],
  ['color-on-accent', 'color-accent'],
];

const UI_PAIRS: [string, string][] = [
  ['color-border', 'color-surface'],
  ['color-border', 'color-bg'],
  ['color-focus', 'color-surface'],
  ['color-focus', 'color-bg'],
  // Лінія й точки графіка на білому та на смузі референсу.
  ['color-lavender-ink', 'color-lavender'],
  ['color-high', 'color-lavender'],
  ['color-low', 'color-lavender'],
];

describe('контраст токенів', () => {
  it.each(TEXT_PAIRS)('текст --%s на --%s ≥ 4.5:1', (fg, bg) => {
    expect(contrast(color(fg), color(bg))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(UI_PAIRS)('елемент --%s на --%s ≥ 3:1', (fg, bg) => {
    expect(contrast(color(fg), color(bg))).toBeGreaterThanOrEqual(3);
  });
});
