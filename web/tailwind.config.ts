import animatePlugin from 'tailwindcss-animate';
import { breakpoints, motion, radius, spacing, typography } from '../shared/tokens';
import type { Config } from 'tailwindcss';

// Tailwind theme is built from the shared design tokens — never edit colors here.
// Add a new token in `shared/tokens.ts` and reference it via CSS variable.

const config: Config = {
  darkMode: ['variant', ['[data-theme="dark"] &', '[data-theme="hc"] &']],
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  theme: {
    screens: {
      sm: String(breakpoints.sm),
      md: String(breakpoints.md),
      lg: String(breakpoints.lg),
      xl: String(breakpoints.xl),
      '2xl': String(breakpoints['2xl']),
    },
    container: {
      center: true,
      padding: '1rem',
      screens: {
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1180px',
      },
    },
    extend: {
      colors: {
        // Each color is a CSS variable. The variable's value comes from
        // `web/src/styles/tokens.css`, which is generated from semantic tokens.
        bg: 'var(--color-bg)',
        'bg-elevated': 'var(--color-bg-elevated)',
        'bg-muted': 'var(--color-bg-muted)',
        fg: 'var(--color-fg)',
        'fg-muted': 'var(--color-fg-muted)',
        'fg-subtle': 'var(--color-fg-subtle)',
        border: 'var(--color-border)',
        'border-strong': 'var(--color-border-strong)',
        primary: {
          DEFAULT: 'var(--color-primary)',
          fg: 'var(--color-primary-fg)',
          hover: 'var(--color-primary-hover)',
        },
        accent: {
          DEFAULT: 'var(--color-accent)',
          fg: 'var(--color-accent-fg)',
        },
        secondary: {
          DEFAULT: 'var(--color-secondary)',
          fg: 'var(--color-secondary-fg)',
        },
        ring: 'var(--color-focus-ring)',
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        danger: 'var(--color-danger)',
        // Child-surface specific tokens
        'child-bg': 'var(--color-child-bg)',
        'child-tile': 'var(--color-child-tile)',
        'child-tile-hover': 'var(--color-child-tile-hover)',
        'child-tile-active': 'var(--color-child-tile-active)',
        'child-tile-border': 'var(--color-child-tile-border)',
        'child-accent': 'var(--color-child-accent)',
      },
      fontFamily: {
        sans: typography.family.sans.split(',').map((s) => s.trim().replace(/^"|"$/g, '')),
        arabic: typography.family.arabic.split(',').map((s) => s.trim().replace(/^"|"$/g, '')),
        mono: typography.family.mono.split(',').map((s) => s.trim().replace(/^"|"$/g, '')),
      },
      fontSize: {
        ...typography.size,
      },
      fontWeight: {
        regular: String(typography.weight.regular),
        medium: String(typography.weight.medium),
        semibold: String(typography.weight.semibold),
        bold: String(typography.weight.bold),
      },
      lineHeight: Object.fromEntries(
        Object.entries(typography.leading).map(([k, v]) => [k, String(v)]),
      ),
      letterSpacing: { ...typography.tracking },
      spacing: {
        ...spacing,
      },
      borderRadius: {
        ...radius,
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgb(15 23 42 / 0.05)',
        DEFAULT: '0 2px 6px -1px rgb(15 23 42 / 0.06), 0 1px 3px -1px rgb(15 23 42 / 0.04)',
        lg: '0 8px 24px -4px rgb(15 23 42 / 0.08), 0 2px 6px -2px rgb(15 23 42 / 0.04)',
        xl: '0 16px 40px -8px rgb(15 23 42 / 0.12), 0 4px 12px -4px rgb(15 23 42 / 0.06)',
      },
      transitionDuration: {
        fast: motion.duration.fast,
        base: motion.duration.base,
        slow: motion.duration.slow,
        slower: motion.duration.slower,
      },
      transitionTimingFunction: {
        standard: motion.easing.standard,
        decelerate: motion.easing.decelerate,
        accelerate: motion.easing.accelerate,
        soft: motion.easing.soft,
      },
      keyframes: {
        // Used by ChildTile press feedback. Always wrapped by useReducedMotion gate.
        'tile-pop': {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.04)' },
          '100%': { transform: 'scale(1)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        'tile-pop': 'tile-pop 200ms cubic-bezier(0.16, 1, 0.3, 1)',
        'fade-in': 'fade-in 200ms cubic-bezier(0.2, 0, 0, 1)',
        'slide-up': 'slide-up 200ms cubic-bezier(0.2, 0, 0, 1)',
      },
    },
  },
  plugins: [animatePlugin],
};

export default config;
