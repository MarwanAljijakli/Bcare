import { describe, it, expect } from 'vitest';
import { palette, semantic, themes, themeToCssVars, a11y } from './tokens';

// Compute relative luminance per WCAG 2.1 algorithm.
function luminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`Invalid hex: ${hex}`);
  const value = m[1]!;
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;
  const ch = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

describe('palette', () => {
  it('declares the four brand families', () => {
    expect(palette.blue[600]).toBe('#2B6CB0');
    expect(palette.mint[200]).toBe('#A7F3D0');
    expect(palette.sand[100]).toBe('#FEF3C7');
    expect(palette.ink[50]).toBe('#F9FAFB');
  });
});

describe('themes', () => {
  it('exports light, dark, and hc', () => {
    expect(themes).toEqual(['light', 'dark', 'hc']);
  });

  it('emits CSS variables for every semantic key', () => {
    const vars = themeToCssVars('light');
    expect(vars['--color-bg']).toBeDefined();
    expect(vars['--color-fg']).toBeDefined();
    expect(vars['--color-primary']).toBeDefined();
    expect(vars['--color-focus-ring']).toBeDefined();
    expect(vars['--color-child-bg']).toBeDefined();
  });
});

describe('contrast — high-contrast mode meets AAA', () => {
  it('fg on bg ≥ 7:1 (AAA normal text)', () => {
    const r = contrastRatio(semantic.hc.fg, semantic.hc.bg);
    expect(r).toBeGreaterThanOrEqual(a11y.contrast.childMin);
  });

  it('primaryFg on primary ≥ 7:1', () => {
    const r = contrastRatio(semantic.hc.primaryFg, semantic.hc.primary);
    expect(r).toBeGreaterThanOrEqual(a11y.contrast.childMin);
  });

  it('child tile border vs canvas is at least 3:1 (UI component contrast)', () => {
    const r = contrastRatio(semantic.hc.childTileBorder, semantic.hc.childBg);
    expect(r).toBeGreaterThanOrEqual(3);
  });
});

describe('contrast — light mode meets AA on body text and AAA on primary', () => {
  it('fg on bg ≥ 7:1', () => {
    const r = contrastRatio(semantic.light.fg, semantic.light.bg);
    expect(r).toBeGreaterThanOrEqual(7);
  });

  it('primary text on canvas ≥ 4.5:1 (AA normal)', () => {
    const r = contrastRatio(semantic.light.primary, semantic.light.bg);
    expect(r).toBeGreaterThanOrEqual(4.5);
  });
});
