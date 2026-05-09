/**
 * Consent text + version + hash helpers.
 *
 * The exact consent label shown on /signup is hashed (sha256 of the canonical
 * EN+AR text + version) and stored in user metadata at signup time. Module
 * 2.B writes a row to public.consent_records keyed off this hash so we can
 * later prove which version of the consent text a caregiver attested to.
 *
 * If the consent label changes, bump CONSENT_VERSION; old grants remain valid
 * for their version.
 */

export const CONSENT_VERSION = '2026-05-09.1' as const;

export const CONSENT_TEXT_EN = 'I agree to the Terms and Privacy Policy.';

export const CONSENT_TEXT_AR = 'أوافق على الشروط وسياسة الخصوصية.';

/**
 * Cheap server-side hex sha256 (Node + Edge runtime). Edge runtime exposes
 * `crypto.subtle` only — we use it via a dedicated async helper.
 */
export async function hashConsent(): Promise<string> {
  const canonical = `${CONSENT_VERSION}::${CONSENT_TEXT_EN}::${CONSENT_TEXT_AR}`;
  const bytes = new TextEncoder().encode(canonical);

  // Prefer Web Crypto where available (Edge runtime + modern Node).
  if (typeof globalThis.crypto?.subtle?.digest === 'function') {
    const buf = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // Fallback to Node's crypto (Node runtime route handlers).
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(canonical).digest('hex');
}

export interface ConsentPayload {
  granted: boolean;
  version: string;
  textHash: string;
  grantedAt: string; // ISO 8601
}
