// Web-specific overrides on top of the root flat config.
import root from '../eslint.config.mjs';

export default [
  ...root,
  {
    files: ['app/**/*.{ts,tsx}', 'src/**/*.{ts,tsx}'],
    rules: {
      // Web tightens jsx-a11y to 'error' across the board (matches the AAA
      // ambition of the child surface).
      'jsx-a11y/no-noninteractive-element-interactions': 'error',
      'jsx-a11y/no-redundant-roles': 'error',
      'jsx-a11y/aria-proptypes': 'error',
    },
  },
];
