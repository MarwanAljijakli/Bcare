'use client';
/**
 * PostHog browser client — Module 9.3.
 *
 * No-op when NEXT_PUBLIC_POSTHOG_KEY is missing. Initialized lazily on
 * the first `track()` call so the SDK chunk isn't loaded for visitors
 * who never trigger an event. Strict event-name allow-list — anything
 * outside the list is silently dropped (failsafe against accidental
 * child-content leaks).
 *
 * Never call from the board surface. The hook below explicitly bails
 * when window.location.pathname starts with /board or /[locale]/board.
 *
 * Provision: see docs/pre-release-credentials.md → PostHog.
 */

import type { PostHog } from 'posthog-js';

let client: PostHog | null = null;
let initPromise: Promise<PostHog | null> | null = null;

/** Strict allow-list. Anything else is dropped. Pattern matches use
 *  startsWith semantics. */
const ALLOWED_EVENT_PREFIXES = [
  'page_view',
  'dashboard_',
  'settings_',
  'admin_',
  'voice_test_',
  'help_',
  'therapist_',
  'onboarding_step_',
] as const;

function isAllowed(eventName: string): boolean {
  return ALLOWED_EVENT_PREFIXES.some((p) => eventName.startsWith(p));
}

function isBoardRoute(): boolean {
  if (typeof window === 'undefined') return false;
  const p = window.location.pathname;
  return /^\/[a-z]{2}\/board(\/|$)/.test(p) || p === '/board' || p.startsWith('/board/');
}

async function ensureClient(): Promise<PostHog | null> {
  if (client) return client;
  if (initPromise) return initPromise;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key || key.length === 0) return null;
  initPromise = (async () => {
    const { default: posthog } = await import('posthog-js');
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
      capture_pageview: false, // we emit our own page_view via track()
      capture_pageleave: false,
      autocapture: false,
      disable_session_recording: true,
      respect_dnt: true,
      person_profiles: 'identified_only',
    });
    client = posthog;
    return posthog;
  })();
  return initPromise;
}

/**
 * Emit a typed analytics event. Dropped silently when:
 *   • PostHog is not configured (no key)
 *   • the event name is not in the allow-list
 *   • the user is currently on /board (caregiver/therapist surfaces only)
 */
export async function track(
  eventName: string,
  properties: Record<string, unknown> = {},
): Promise<void> {
  if (isBoardRoute()) return;
  if (!isAllowed(eventName)) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[posthog] dropped: "${eventName}" not in allow-list`);
    }
    return;
  }
  const ph = await ensureClient();
  if (!ph) return;
  ph.capture(eventName, properties);
}

/** Identify the current user to PostHog. Pass user_id only. NEVER
 *  pass child information. */
export async function identify(userId: string): Promise<void> {
  if (isBoardRoute()) return;
  const ph = await ensureClient();
  if (!ph) return;
  ph.identify(userId);
}

export async function reset(): Promise<void> {
  const ph = await ensureClient();
  if (!ph) return;
  ph.reset();
}
