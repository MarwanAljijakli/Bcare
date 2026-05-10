/**
 * Parental PIN — 6-digit numeric code that gates settings, vocabulary
 * curation, consent revocation, and account deletion.
 *
 * Hashed with bcryptjs cost 12. Three wrong attempts within 5 minutes
 * triggers a 5-minute lockout (per-user, per-IP). Lockout state lives in
 * a small in-memory map per warm Vercel instance — Module 9 hardening
 * promotes this to a persistent store.
 *
 * The PIN is never sent to the server in plaintext form during normal
 * verification — the client hashes... actually no, the client CAN'T
 * bcrypt-verify against the stored hash without the salt. So the
 * verification endpoint accepts the plaintext PIN over the (TLS) wire,
 * bcrypt-compares server-side, and never logs the value.
 */

import bcrypt from 'bcryptjs';

const COST = 12;
const PIN_PATTERN = /^[0-9]{6}$/;

const LOCKOUT_WINDOW_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 3;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000;

interface AttemptState {
  failures: number[];
  lockoutUntil?: number;
}
const attempts = new Map<string, AttemptState>();

export function isValidPinFormat(pin: string): boolean {
  return PIN_PATTERN.test(pin);
}

export async function hashPin(pin: string): Promise<string> {
  if (!isValidPinFormat(pin)) {
    throw new PinError('invalid_format');
  }
  return bcrypt.hash(pin, COST);
}

export async function verifyPinHash(pin: string, hash: string): Promise<boolean> {
  if (!isValidPinFormat(pin)) return false;
  return bcrypt.compare(pin, hash);
}

/** Per-user lockout state. `key` is typically `${userId}:${ipHash}`. */
export function recordPinFailure(key: string): { lockedUntil: number | null; remaining: number } {
  const now = Date.now();
  const state = attempts.get(key) ?? { failures: [] };
  state.failures = state.failures.filter((t) => now - t < LOCKOUT_WINDOW_MS);
  state.failures.push(now);

  if (state.failures.length >= MAX_ATTEMPTS) {
    state.lockoutUntil = now + LOCKOUT_DURATION_MS;
    state.failures = [];
    attempts.set(key, state);
    return { lockedUntil: state.lockoutUntil, remaining: 0 };
  }

  attempts.set(key, state);
  return { lockedUntil: null, remaining: MAX_ATTEMPTS - state.failures.length };
}

export function clearPinFailures(key: string): void {
  attempts.delete(key);
}

/** Throws if the key is currently locked out. */
export function assertNotLocked(key: string): void {
  const state = attempts.get(key);
  if (!state?.lockoutUntil) return;
  if (Date.now() < state.lockoutUntil) {
    throw new PinError('locked_out', { until: state.lockoutUntil });
  }
  // Lockout expired — clear it.
  delete state.lockoutUntil;
  state.failures = [];
  attempts.set(key, state);
}

export class PinError extends Error {
  constructor(
    public code: 'invalid_format' | 'wrong' | 'locked_out' | 'not_set',
    public detail?: { until?: number; remaining?: number },
  ) {
    super(code);
    this.name = 'PinError';
  }
}
