import { describe, it, expect } from 'vitest';
import { __testing } from './guard';

describe('aiGuard / monthlyCapUsd', () => {
  it('defaults to 5 USD when env is unset', () => {
    delete process.env.AI_MONTHLY_BUDGET_USD_PER_CHILD;
    expect(__testing.monthlyCapUsd()).toBe(5);
  });

  it('reads positive numeric env values', () => {
    process.env.AI_MONTHLY_BUDGET_USD_PER_CHILD = '12';
    expect(__testing.monthlyCapUsd()).toBe(12);
    delete process.env.AI_MONTHLY_BUDGET_USD_PER_CHILD;
  });

  it('falls back to 5 USD on garbage env', () => {
    process.env.AI_MONTHLY_BUDGET_USD_PER_CHILD = 'banana';
    expect(__testing.monthlyCapUsd()).toBe(5);
    process.env.AI_MONTHLY_BUDGET_USD_PER_CHILD = '-3';
    expect(__testing.monthlyCapUsd()).toBe(5);
    delete process.env.AI_MONTHLY_BUDGET_USD_PER_CHILD;
  });
});

describe('aiGuard / currentYearMonth', () => {
  it('formats as YYYY-MM zero-padded', () => {
    const d = new Date(Date.UTC(2026, 4, 9));
    expect(__testing.currentYearMonth(d)).toBe('2026-05');
  });
  it('formats single-digit months', () => {
    const d = new Date(Date.UTC(2026, 0, 1));
    expect(__testing.currentYearMonth(d)).toBe('2026-01');
  });
});
