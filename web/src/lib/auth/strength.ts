/**
 * Password-strength scorer. Cheap, deterministic, runs every keystroke.
 *
 * Score is bucketed into four labels: weak / okay / strong / excellent.
 * Buckets are independent of the i18n catalog so the function stays pure;
 * the i18n keys live alongside these labels in messages/{locale}.json.
 *
 * Rules (additive, max 4 points):
 *   +1   length >= 12
 *   +1   length >= 16
 *   +1   contains both letters and numbers
 *   +1   contains a symbol (anything outside [A-Za-z0-9])
 */

export type StrengthLabel = 'weak' | 'okay' | 'strong' | 'excellent';

export interface StrengthResult {
  label: StrengthLabel;
  /** Score 0..4; useful for visual meters. */
  score: 0 | 1 | 2 | 3 | 4;
  /** True only when length + composition pass the policy floor (≥ 12 + letter + number). */
  meetsPolicy: boolean;
}

export function scorePassword(password: string): StrengthResult {
  const length = password.length;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^a-zA-Z0-9]/.test(password);

  let score = 0;
  if (length >= 12) score += 1;
  if (length >= 16) score += 1;
  if (hasLetter && hasNumber) score += 1;
  if (hasSymbol) score += 1;

  const clamped = Math.min(4, score) as 0 | 1 | 2 | 3 | 4;
  let label: StrengthLabel;
  if (clamped <= 1) label = 'weak';
  else if (clamped === 2) label = 'okay';
  else if (clamped === 3) label = 'strong';
  else label = 'excellent';

  const meetsPolicy = length >= 12 && hasLetter && hasNumber;
  return { label, score: clamped, meetsPolicy };
}
