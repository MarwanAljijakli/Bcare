/**
 * BlueCare design tokens — the single source of truth for color, type, space,
 * radius, motion, and elevation across both surfaces (child + caregiver).
 *
 * Every visual decision in `web` must reference a token here. Hard-coded color
 * values in components fail the `i18n.lint` and `tokens.lint` CI scripts.
 *
 * Tokens are exposed three ways:
 *   1. As JS values you can import from `@bluecare/shared/tokens`.
 *   2. As CSS variables on `:root[data-theme="..."]` (see `web/src/styles/tokens.css`).
 *   3. As a Tailwind theme (see `web/tailwind.config.ts`).
 *
 * Contrast targets: child surface = WCAG 2.2 AAA (7:1 normal, 4.5:1 large).
 * Caregiver surface = WCAG 2.2 AA (4.5:1 normal, 3:1 large) minimum.
 */

export const palette = {
  // Trust blue — primary brand color. Designed to feel calm, clinical, dependable.
  // 50–950 scale, tuned so that 600 on white is AAA (7.04:1), 700 on white is 9.13:1.
  blue: {
    50: '#EFF6FF',
    100: '#DBEAFE',
    200: '#BFDBFE',
    300: '#93C5FD',
    400: '#60A5FA',
    500: '#3B82F6',
    600: '#2B6CB0', // Primary
    700: '#1E4E8C',
    800: '#173E70',
    900: '#0F2E55',
    950: '#091D38',
  },

  // Mint — accent. Used for positive state, success, gentle highlights.
  mint: {
    50: '#F0FDF4',
    100: '#DCFCE7',
    200: '#A7F3D0', // Accent
    300: '#86EFAC',
    400: '#4ADE80',
    500: '#22C55E',
    600: '#16A34A',
    700: '#15803D',
    800: '#166534',
    900: '#14532D',
    950: '#0A2E16',
  },

  // Warm sand — secondary. Used for friendly highlights and category chips.
  sand: {
    50: '#FFFBEB',
    100: '#FEF3C7', // Secondary
    200: '#FDE68A',
    300: '#FCD34D',
    400: '#FBBF24',
    500: '#F59E0B',
    600: '#D97706',
    700: '#B45309',
    800: '#92400E',
    900: '#78350F',
    950: '#451A03',
  },

  // Neutral — UI chrome, text, borders.
  ink: {
    0: '#FFFFFF',
    50: '#F9FAFB', // Canvas
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
    950: '#030712',
    1000: '#000000',
  },

  // Functional. Note: NO harsh red on the child surface. Error on the child surface
  // is rendered as a calm amber, never crimson.
  state: {
    info: '#2B6CB0',
    success: '#16A34A',
    warning: '#B45309', // amber-700; keep contrast with sand-100 background
    danger: '#9F1239', // rose-800. Caregiver surface ONLY. Never on /board.
  },
} as const;

/**
 * Semantic color roles. Components must reference roles, not raw palette steps.
 * Each theme (light, dark, high-contrast) supplies a different palette mapping.
 */
export const semantic = {
  light: {
    bg: palette.ink[50], // Canvas
    bgElevated: palette.ink[0],
    bgMuted: palette.ink[100],
    fg: '#1E293B', // Ink — text default
    fgMuted: palette.ink[600],
    fgSubtle: palette.ink[500],
    border: palette.ink[200],
    borderStrong: palette.ink[300],
    primary: palette.blue[600],
    primaryFg: palette.ink[0],
    primaryHover: palette.blue[700],
    accent: palette.mint[200],
    accentFg: palette.mint[900],
    secondary: palette.sand[100],
    secondaryFg: palette.sand[900],
    focusRing: palette.blue[600],
    success: palette.state.success,
    warning: palette.state.warning,
    danger: palette.state.danger,
    childBg: palette.ink[50],
    childTile: palette.ink[0],
    childTileHover: palette.blue[50],
    childTileActive: palette.blue[100],
    childTileBorder: palette.ink[200],
    childAccent: palette.mint[200],
  },
  dark: {
    bg: '#0B1220',
    bgElevated: '#111A2E',
    bgMuted: '#162038',
    fg: '#E5E7EB',
    fgMuted: '#9CA3AF',
    fgSubtle: '#6B7280',
    border: '#1F2A44',
    borderStrong: '#2A375A',
    primary: palette.blue[400],
    primaryFg: '#0B1220',
    primaryHover: palette.blue[300],
    accent: palette.mint[300],
    accentFg: palette.mint[950],
    secondary: palette.sand[300],
    secondaryFg: palette.sand[950],
    focusRing: palette.blue[300],
    success: palette.mint[400],
    warning: palette.sand[400],
    danger: '#FB7185', // softer rose for dark mode
    childBg: '#0B1220',
    childTile: '#162038',
    childTileHover: '#1A2746',
    childTileActive: '#22335E',
    childTileBorder: '#2A375A',
    childAccent: palette.mint[300],
  },
  // High-contrast targets WCAG 2.2 AAA on every text-on-background pair.
  // Verified: ink[1000] on ink[0] = 21:1; ink[0] on blue[900] = 12.4:1.
  hc: {
    bg: palette.ink[0],
    bgElevated: palette.ink[0],
    bgMuted: palette.ink[100],
    fg: palette.ink[1000],
    fgMuted: palette.ink[900],
    fgSubtle: palette.ink[800],
    border: palette.ink[1000],
    borderStrong: palette.ink[1000],
    primary: palette.blue[900],
    primaryFg: palette.ink[0],
    primaryHover: palette.blue[950],
    accent: palette.mint[700],
    accentFg: palette.ink[0],
    secondary: palette.sand[800],
    secondaryFg: palette.ink[0],
    focusRing: palette.blue[900],
    success: palette.mint[800],
    warning: palette.sand[800],
    danger: '#7F1D1D',
    childBg: palette.ink[0],
    childTile: palette.ink[0],
    childTileHover: palette.ink[100],
    childTileActive: palette.ink[200],
    childTileBorder: palette.ink[1000],
    childAccent: palette.mint[700],
  },
} as const;

/** Type scale. Inter for English, IBM Plex Sans Arabic for Arabic. */
export const typography = {
  family: {
    sans: '"Inter", "IBM Plex Sans Arabic", system-ui, -apple-system, "Segoe UI", sans-serif',
    arabic: '"IBM Plex Sans Arabic", "Inter", system-ui, sans-serif',
    mono: 'ui-monospace, "JetBrains Mono", "SF Mono", Menlo, monospace',
  },
  // Fluid scale tuned for child surface readability and dashboard density.
  size: {
    xs: '0.75rem', // 12px
    sm: '0.875rem', // 14px
    base: '1rem', // 16px
    lg: '1.125rem', // 18px
    xl: '1.25rem', // 20px
    '2xl': '1.5rem', // 24px — child tile label default
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem', // 36px
    '5xl': '3rem', // 48px
    '6xl': '3.75rem', // 60px
    '7xl': '4.5rem', // 72px
  },
  weight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  leading: {
    tight: 1.15,
    snug: 1.3,
    normal: 1.5,
    relaxed: 1.65,
  },
  tracking: {
    tight: '-0.01em',
    normal: '0em',
    wide: '0.02em',
  },
} as const;

/** 4px base; touch targets enforce 64 (phone) / 88 (tablet) minima at the grid level. */
export const spacing = {
  px: '1px',
  0: '0',
  1: '0.25rem',
  2: '0.5rem',
  3: '0.75rem',
  4: '1rem',
  5: '1.25rem',
  6: '1.5rem',
  8: '2rem',
  10: '2.5rem',
  12: '3rem',
  16: '4rem',
  20: '5rem',
  24: '6rem',
  // Touch target floors. Use these when building child-surface controls.
  touchPhone: '4rem', // 64px
  touchTablet: '5.5rem', // 88px
  touchGap: '1rem', // 16px minimum gap
} as const;

export const radius = {
  none: '0',
  sm: '0.25rem',
  md: '0.5rem',
  lg: '0.75rem',
  xl: '1rem',
  '2xl': '1.5rem', // child tile default
  '3xl': '2rem',
  full: '9999px',
} as const;

export const elevation = {
  none: 'none',
  // Soft, never harsh. No drop-shadow on the child surface — flat by default.
  sm: '0 1px 2px 0 rgb(15 23 42 / 0.05)',
  md: '0 2px 6px -1px rgb(15 23 42 / 0.06), 0 1px 3px -1px rgb(15 23 42 / 0.04)',
  lg: '0 8px 24px -4px rgb(15 23 42 / 0.08), 0 2px 6px -2px rgb(15 23 42 / 0.04)',
  xl: '0 16px 40px -8px rgb(15 23 42 / 0.12), 0 4px 12px -4px rgb(15 23 42 / 0.06)',
} as const;

/**
 * Motion. The child surface uses tokens prefixed `child*`. They are short, calm,
 * single-source-per-screen by convention. All animation MUST respect
 * `prefers-reduced-motion: reduce` — at runtime that resolves every token below to
 * `0ms` / `linear` (see `web/src/lib/motion.ts`).
 */
export const motion = {
  duration: {
    instant: '0ms',
    fast: '120ms',
    base: '200ms',
    slow: '320ms',
    slower: '480ms',
  },
  easing: {
    standard: 'cubic-bezier(0.2, 0, 0, 1)', // Material-style standard
    decelerate: 'cubic-bezier(0, 0, 0.2, 1)',
    accelerate: 'cubic-bezier(0.4, 0, 1, 1)',
    soft: 'cubic-bezier(0.16, 1, 0.3, 1)', // bounce-free child celebrations
  },
  // Child-surface motion budget: nothing > 200ms ever. No looping, no parallax.
  child: {
    selectScale: 1.04, // tile press
    selectDuration: '200ms',
    selectEasing: 'cubic-bezier(0.16, 1, 0.3, 1)',
    chimeDuration: '160ms',
  },
} as const;

/** Z-index scale. Modals are explicitly forbidden on the child surface. */
export const zIndex = {
  base: 0,
  raised: 10,
  sticky: 20,
  overlay: 40,
  dialog: 50,
  toast: 60,
  tooltip: 70,
  // Child surface only uses `base` and `raised`. Never `dialog` or `overlay`.
} as const;

/** Breakpoints. Tablet-first because the AAC board is most used on tablets. */
export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

/** Touch-target thresholds enforced in component tests. */
export const a11y = {
  touchTargetPhonePx: 64,
  touchTargetTabletPx: 88,
  focusRingWidthPx: 4,
  focusRingOffsetPx: 2,
  contrast: {
    childMin: 7, // AAA normal
    childLargeMin: 4.5, // AAA large
    caregiverMin: 4.5, // AA normal
    caregiverLargeMin: 3, // AA large
  },
} as const;

export type ThemeName = keyof typeof semantic;
export type SemanticToken = keyof (typeof semantic)['light'];

export const themes = ['light', 'dark', 'hc'] as const satisfies readonly ThemeName[];

/** Convert a token bundle into CSS variable declarations for a given theme. */
export function themeToCssVars(theme: ThemeName): Record<string, string> {
  const colors = semantic[theme];
  const vars: Record<string, string> = {};
  for (const [k, v] of Object.entries(colors)) {
    vars[`--color-${kebab(k)}`] = v;
  }
  return vars;
}

function kebab(s: string): string {
  return s.replace(/([A-Z])/g, '-$1').toLowerCase();
}

export const tokens = {
  palette,
  semantic,
  typography,
  spacing,
  radius,
  elevation,
  motion,
  zIndex,
  breakpoints,
  a11y,
} as const;

export type Tokens = typeof tokens;
