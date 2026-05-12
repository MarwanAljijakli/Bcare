/**
 * Per-child monthly AI cost guard. Every AI call (Whisper STT, GPT-4o-mini
 * suggestions, ElevenLabs TTS, Azure TTS) MUST pass through `aiGuard()`
 * before the outbound API call fires.
 *
 * Behavior:
 *   1. Look up the running total of cost for (childId, current year-month).
 *   2. If `running + this-call-estimate > AI_MONTHLY_BUDGET_USD_PER_CHILD`,
 *      record a `blocked=1` ledger row and reject. The caller must surface
 *      a graceful-degradation path (cached response, fewer suggestions) —
 *      this guard NEVER paywalls a user.
 *   3. Otherwise, record `blocked=0`, run the callback, and return its
 *      result.
 *
 * The acceptance-criterion-13 contract: "Cost-guard AI cap enforced in
 * code with a unit test." Tests live alongside (`./guard.test.ts`).
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type AiService =
  | 'whisper_stt'
  | 'gpt_personalization'
  | 'elevenlabs_tts'
  | 'azure_tts'
  // Quality Fix Phase 0 — Claude Sonnet 4.6 sub-services. Migration
  // 0005 extended the public.ai_service enum to match. Phase 10.E
  // added `claude_report` for the weekly parent-facing insights via
  // migration 0011.
  | 'claude_suggest'
  | 'claude_audit'
  | 'claude_complete'
  | 'claude_report'
  | 'claude_other';

export interface GuardInput {
  /** Owning child for this AI call. */
  childId: string;
  service: AiService;
  /** Estimated cost in USD for this call, with up to 6 decimals. */
  estimatedCostUsd: number;
  /** Caller-defined unit count (tokens, characters, ms of audio). */
  units: number;
  /** Service-role-bound Supabase client. */
  supabase: SupabaseClient<never>;
}

export interface GuardOk<T> {
  ok: true;
  result: T;
}
export interface GuardBlocked {
  ok: false;
  reason: 'cap_reached';
  remainingUsd: number;
  monthlyCapUsd: number;
}
export type GuardResult<T> = GuardOk<T> | GuardBlocked;

const DEFAULT_CAP_USD = 5;

/** Read the monthly cap from env (default 5 USD per child per month). */
function monthlyCapUsd(): number {
  const raw = process.env.AI_MONTHLY_BUDGET_USD_PER_CHILD;
  const n = raw ? Number(raw) : DEFAULT_CAP_USD;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_CAP_USD;
}

function currentYearMonth(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

async function sumMonthly(
  supabase: SupabaseClient<never>,
  childId: string,
  yearMonth: string,
): Promise<number> {
  // The service-role client bypasses RLS so this read works without an
  // authenticated user context. The placeholder Database type doesn't
  // narrow `from('ai_usage_ledger')` so we cast through unknown to
  // avoid a type assertion.
  const q = await (
    supabase.from('ai_usage_ledger') as never as {
      select: (cols: string) => {
        eq: (
          col: string,
          v: string,
        ) => {
          eq: (col2: string, v2: string) => Promise<{ data: { cost_usd: number }[] | null }>;
        };
      };
    }
  )
    .select('cost_usd')
    .eq('child_id', childId)
    .eq('year_month', yearMonth);
  const rows = q.data ?? [];
  return rows.reduce((sum, r) => sum + Number(r.cost_usd ?? 0), 0);
}

async function record(supabase: SupabaseClient<never>, row: AiUsageLedgerRow): Promise<void> {
  // Same cast pattern — placeholder Database type, real shape comes in
  // Module 9 when supabase gen types runs in CI.
  await (
    supabase.from('ai_usage_ledger') as never as {
      insert: (row: AiUsageLedgerRow) => Promise<unknown>;
    }
  ).insert(row);
}

interface AiUsageLedgerRow {
  child_id: string;
  service: AiService;
  year_month: string;
  units: number;
  cost_usd: number;
  blocked: 0 | 1;
}

export async function aiGuard<T>(
  input: GuardInput,
  call: () => Promise<T>,
): Promise<GuardResult<T>> {
  const yearMonth = currentYearMonth();
  const cap = monthlyCapUsd();
  const running = await sumMonthly(input.supabase, input.childId, yearMonth);
  const projected = running + Math.max(0, input.estimatedCostUsd);

  if (projected > cap) {
    await record(input.supabase, {
      child_id: input.childId,
      service: input.service,
      year_month: yearMonth,
      units: input.units,
      cost_usd: input.estimatedCostUsd,
      blocked: 1,
    });
    return {
      ok: false,
      reason: 'cap_reached',
      remainingUsd: Math.max(0, cap - running),
      monthlyCapUsd: cap,
    };
  }

  // Pre-record the entry so the running total reflects this call even if
  // it later errors. If `call()` throws, the cost is still booked because
  // the upstream service may have charged us.
  await record(input.supabase, {
    child_id: input.childId,
    service: input.service,
    year_month: yearMonth,
    units: input.units,
    cost_usd: input.estimatedCostUsd,
    blocked: 0,
  });

  const result = await call();
  return { ok: true, result };
}

export const __testing = { monthlyCapUsd, currentYearMonth };
