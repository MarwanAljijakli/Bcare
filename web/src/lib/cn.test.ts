import { describe, it, expect } from 'vitest';
import { cn } from './cn';

describe('cn', () => {
  it('joins class names', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('drops falsy values', () => {
    expect(cn('a', false, undefined, null, 'b')).toBe('a b');
  });

  it('resolves Tailwind conflicts (later wins)', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
    expect(cn('text-fg', 'text-fg-muted')).toBe('text-fg-muted');
  });

  it('preserves directional-equivalent classes (start/end are flow-relative)', () => {
    expect(cn('ms-2', 'me-2')).toBe('ms-2 me-2');
  });
});
