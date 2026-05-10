/**
 * Locale-aware formatting helpers for the dashboard.
 *
 * Server-only because the loader uses them, but they are pure functions
 * with no I/O — safe to import from server components and Vitest tests.
 *
 * Convention: every helper takes the locale explicitly. Don't reach for
 * navigator.language or environment defaults; the page passes through
 * the next-intl locale and that's the source of truth.
 */
import type { DashboardChild } from './types';
import type { AppLocale } from '@/i18n/routing';

/** Locale-aware integer formatter (Arabic-Indic digits in `ar`). */
export function formatInteger(value: number, locale: AppLocale): string {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-US').format(Math.round(value));
}

/** Locale-aware percentage formatter. Input is a 0..1 ratio. */
export function formatPercent(ratio: number, locale: AppLocale): string {
  if (!Number.isFinite(ratio)) return formatPercent(0, locale);
  const clamped = Math.max(0, Math.min(1, ratio));
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-US', {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(clamped);
}

/** Format a fractional number with up to one decimal digit. */
export function formatDecimal(value: number, locale: AppLocale): string {
  if (!Number.isFinite(value)) return formatDecimal(0, locale);
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-US', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  }).format(value);
}

/**
 * Render a duration in seconds as a short locale-aware string.
 *
 *   45        → "45s" / "٤٥ث"
 *   125       → "2m 5s" / "٢د ٥ث"
 *   3725      → "1h 2m" / "١س ٢د"
 *
 * The unit suffixes are intentionally short — matches the table column
 * width budget and reads naturally in both EN and AR.
 */
export function formatDurationShort(
  seconds: number,
  locale: AppLocale,
  units: { hour: string; minute: string; second: string },
): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${formatInteger(s, locale)}${units.second}`;
  if (s < 3600) {
    const m = Math.floor(s / 60);
    const rem = s - m * 60;
    if (rem === 0) return `${formatInteger(m, locale)}${units.minute}`;
    return `${formatInteger(m, locale)}${units.minute} ${formatInteger(rem, locale)}${units.second}`;
  }
  const h = Math.floor(s / 3600);
  const m = Math.floor((s - h * 3600) / 60);
  if (m === 0) return `${formatInteger(h, locale)}${units.hour}`;
  return `${formatInteger(h, locale)}${units.hour} ${formatInteger(m, locale)}${units.minute}`;
}

/** Format a date as a short locale-aware label (e.g. "May 9" / "٩ مايو"). */
export function formatShortDate(iso: string, locale: AppLocale): string {
  try {
    return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-US', {
      month: 'short',
      day: 'numeric',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/**
 * Pick the locale-appropriate label for a symbol. Falls back to the
 * other locale or a placeholder when both are missing — the symbols
 * table doesn't enforce both labels at insert time, and the dashboard
 * shouldn't render an empty cell.
 */
export function pickSymbolLabel(
  locale: AppLocale,
  sym: { label_en?: string | null; label_ar?: string | null } | null,
  fallback = '—',
): string {
  if (!sym) return fallback;
  const primary = locale === 'ar' ? sym.label_ar : sym.label_en;
  if (primary && primary.trim().length > 0) return primary.trim();
  const secondary = locale === 'ar' ? sym.label_en : sym.label_ar;
  if (secondary && secondary.trim().length > 0) return secondary.trim();
  return fallback;
}

/**
 * Compute the integer age of a child in completed years from a DOB.
 *
 * Returns null when the DOB is missing or unparseable. The dashboard
 * uses this for the child-tab strip's small "5 yrs" annotation; we'd
 * rather omit the annotation than show "NaN".
 */
export function ageYears(dob: string | null | undefined, now: Date = new Date()): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  let age = now.getFullYear() - d.getFullYear();
  const monthDiff = now.getMonth() - d.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < d.getDate())) age--;
  return Math.max(0, age);
}

/** Caregiver greeting first-name. Empty + falls-through-friendly. */
export function firstNameOf(fullName: string | null | undefined): string | null {
  if (!fullName) return null;
  const trimmed = fullName.trim();
  if (trimmed.length === 0) return null;
  return trimmed.split(/\s+/)[0] ?? null;
}

/**
 * Sort children for the tab strip: created_at ascending so the family
 * sees the children in the order they were added. Stable across loads.
 */
export function sortChildrenForTabs(children: DashboardChild[]): DashboardChild[] {
  return [...children].sort((a, b) => a.name.localeCompare(b.name));
}
