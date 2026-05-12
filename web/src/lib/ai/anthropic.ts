/**
 * Anthropic Claude wrapper — Quality Fix override.
 *
 * Wires Claude Sonnet 4.6 (`claude-sonnet-4-6`) into BlueCare for:
 *   • vocabulary suggestions (replaces dumb-frequency on
 *     /dashboard/personalization)
 *   • symbol-image vision audit — fixes the "Apple labeled as car" data
 *     quality bug; every existing + caregiver-uploaded symbol runs
 *     through Claude vision before going live
 *   • sentence completion on the AAC board (top-3 next-word picks)
 *   • content quality (bilingual translation review)
 *
 * Cost accounting:
 *   • Sonnet 4.6 pricing — input $3 / 1M tokens, output $15 / 1M tokens.
 *   • Every billable call routes through `aiGuard()` which writes a row
 *     to `ai_usage_ledger` and enforces the per-child monthly cap.
 *   • The `claude_*` ai_service enum values were added in migration 0005.
 *
 * Free-first override: this is the FIRST code path in BlueCare that
 * intentionally REQUIRES a paid AI service for full functionality. It
 * is scope-locked to the three quality vectors above (voice + symbols +
 * intelligence). Everywhere else stays free-first.
 *
 * Server-only — `ANTHROPIC_API_KEY` MUST never reach the browser. The
 * NEXT_PUBLIC_ prefix is forbidden for this key.
 */
import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { aiGuard, type GuardResult } from './guard';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Model ID per Quality Fix directive. */
export const CLAUDE_MODEL = 'claude-sonnet-4-6';

/** Pricing per million tokens (USD) — Sonnet 4.6. */
const INPUT_PER_MTOK_USD = 3;
const OUTPUT_PER_MTOK_USD = 15;

/** Which sub-service is this call attributed to in ai_usage_ledger? */
export type ClaudeService =
  | 'claude_suggest'
  | 'claude_audit'
  | 'claude_complete'
  | 'claude_report'
  | 'claude_other';

/**
 * True when ANTHROPIC_API_KEY is configured. Surfaces a "Claude features
 * disabled" state in the dashboard / admin UIs without hard-failing.
 */
export function isClaudeAvailable(): boolean {
  return !!process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.length > 0;
}

/**
 * Lazy singleton — the SDK reuses HTTP keep-alive sockets, so we want
 * one client per Node process, not one per call.
 */
let cachedClient: Anthropic | null = null;
export function getAnthropicClient(): Anthropic {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }
  cachedClient = new Anthropic({ apiKey });
  return cachedClient;
}

/** USD cost for a Claude call given token usage. */
export function estimateClaudeCostUsd(input_tokens: number, output_tokens: number): number {
  const cost =
    (Math.max(0, input_tokens) / 1_000_000) * INPUT_PER_MTOK_USD +
    (Math.max(0, output_tokens) / 1_000_000) * OUTPUT_PER_MTOK_USD;
  // Round to 6 decimal places to match the ai_usage_ledger numeric(12,6) column.
  return Math.round(cost * 1_000_000) / 1_000_000;
}

/** A single content block for Claude — text or an image (data URL). */
export type ClaudeContent =
  | { type: 'text'; text: string }
  | {
      type: 'image';
      source:
        | {
            type: 'base64';
            media_type: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';
            data: string;
          }
        | { type: 'url'; url: string };
    };

export interface ClaudeCallInput {
  /** Optional system prompt — improves grounding for structured tasks. */
  system?: string;
  /** Either a plain string (rendered as a single user-text block) or
   *  full content blocks (text + image, for vision audits). */
  user: string | ClaudeContent[];
  /** Output token cap. Defaults to 1024. */
  max_tokens?: number;
  /** 0..1 — Claude's "creativity" knob. Defaults to 0.2 for grounded tasks. */
  temperature?: number;
}

export interface ClaudeCallResult {
  /** Concatenated text from every text content block in the response. */
  text: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  /** Stop reason from the SDK — useful for debugging truncated responses. */
  stop_reason: string | null;
}

/**
 * Direct Claude call — does NOT charge ai_usage_ledger. Use for
 * connectivity probes (smoke test) and operator scripts that have no
 * child context. Production code paths SHOULD use `claudeForChild()`
 * instead so the per-child cap is enforced.
 */
export async function claudeDirect(input: ClaudeCallInput): Promise<ClaudeCallResult> {
  const client = getAnthropicClient();
  const messages = [
    {
      role: 'user' as const,
      content:
        typeof input.user === 'string'
          ? [{ type: 'text' as const, text: input.user }]
          : (input.user as Anthropic.Messages.ContentBlockParam[]),
    },
  ];

  const res = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: input.max_tokens ?? 1024,
    temperature: input.temperature ?? 0.2,
    system: input.system,
    messages,
  });

  const text = res.content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');

  return {
    text,
    input_tokens: res.usage.input_tokens,
    output_tokens: res.usage.output_tokens,
    cost_usd: estimateClaudeCostUsd(res.usage.input_tokens, res.usage.output_tokens),
    stop_reason: res.stop_reason,
  };
}

/**
 * Claude call wrapped through aiGuard. Charges ai_usage_ledger BEFORE
 * dispatching the API call (matching the existing aiGuard pre-record
 * convention so an in-flight crash still books the cost).
 *
 * Returns:
 *   • { ok: true, result }      — call succeeded; `result` carries text + tokens + cost.
 *   • { ok: false, reason }     — cap reached. Caller falls back to
 *                                 free-tier behavior. NEVER paywalls
 *                                 the user.
 *
 * Cost estimation: aiGuard takes a per-call estimate up-front. Token
 * counts are only known AFTER the response — so we pre-charge an
 * `estimatedCostUsd` (caller-supplied or computed from a max-tokens
 * worst case), then update the ledger row with the actual numbers via
 * `chargeClaudeUsage()`.
 */
export async function claudeForChild(args: {
  supabaseAdmin: SupabaseClient<never>;
  childId: string;
  service: ClaudeService;
  /** Pre-call upper-bound estimate. Defaults to a conservative
   *  worst-case of $0.05 per call (≈ 3K input + 1K output tokens). */
  estimatedCostUsd?: number;
  call: ClaudeCallInput;
}): Promise<GuardResult<ClaudeCallResult>> {
  return aiGuard<ClaudeCallResult>(
    {
      supabase: args.supabaseAdmin,
      childId: args.childId,
      service: args.service,
      estimatedCostUsd: args.estimatedCostUsd ?? 0.05,
      units: 1,
    },
    async () => claudeDirect(args.call),
  );
}

/**
 * Persist the actual token usage of a Claude call to ai_usage_ledger.
 *
 * The aiGuard pre-charge writes the *estimated* cost as a placeholder.
 * After the call lands, callers SHOULD call this with the real token
 * counts so the running total stays honest. The schema doesn't track
 * input/output tokens separately (that's a Module-9 hardening task) —
 * we just adjust the cost_usd on the most recent unblocked row for
 * (child, service, year-month).
 *
 * If the row can't be located (race / wrong service), this is a no-op:
 * the pre-charge estimate stays as the booking. We never want this to
 * surface a user-facing error.
 */
export async function chargeClaudeUsage(args: {
  supabaseAdmin: SupabaseClient<never>;
  childId: string;
  service: ClaudeService;
  input_tokens: number;
  output_tokens: number;
}): Promise<void> {
  const cost = estimateClaudeCostUsd(args.input_tokens, args.output_tokens);
  const yearMonth = (() => {
    const d = new Date();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  })();
  // Find the most recent unblocked row for (child, service, year-month).
  const recent = await (
    args.supabaseAdmin.from('ai_usage_ledger') as never as {
      select: (cols: string) => {
        eq: (
          col: string,
          v: string,
        ) => {
          eq: (
            col2: string,
            v2: string,
          ) => {
            eq: (
              col3: string,
              v3: string,
            ) => {
              eq: (
                col4: string,
                v4: number,
              ) => {
                order: (
                  col: string,
                  opts: { ascending: boolean },
                ) => {
                  limit: (n: number) => Promise<{ data: { id: string }[] | null }>;
                };
              };
            };
          };
        };
      };
    }
  )
    .select('id')
    .eq('child_id', args.childId)
    .eq('service', args.service)
    .eq('year_month', yearMonth)
    .eq('blocked', 0)
    .order('created_at', { ascending: false })
    .limit(1);
  const id = recent.data?.[0]?.id;
  if (!id) return;
  await (
    args.supabaseAdmin.from('ai_usage_ledger') as never as {
      update: (patch: { cost_usd: number; units: number }) => {
        eq: (col: string, v: string) => Promise<unknown>;
      };
    }
  )
    .update({ cost_usd: cost, units: args.input_tokens + args.output_tokens })
    .eq('id', id);
}
