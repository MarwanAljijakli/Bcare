/**
 * Optional GPT-4o-mini upgrade path for vocabulary suggestions.
 *
 * Free-first guarantee: if `OPENAI_API_KEY` is missing OR `aiGuard` blocks
 * the call (per-child monthly cap), this function returns an empty array
 * and the system falls back to the frequency-based engine. The caregiver
 * never sees a paywall, never sees a "feature unavailable" toast. The
 * LLM upgrade is purely additive when configured + enabled.
 *
 * When enabled, generates 3-5 additional candidate symbols per child by
 * giving the model:
 *   • The child's most-used categories (top 3).
 *   • A list of symbols already on their board (so it doesn't suggest
 *     duplicates).
 *   • A list of symbols available in their categories not yet on the
 *     board.
 *
 * The model picks the symbol IDs with reasoning. We never send the
 * child's name, age, or any caregiver-identifying detail — only category
 * keys + symbol IDs.
 */

import { aiGuard, type GuardResult } from './guard';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface LlmSuggestion {
  symbolId: string;
  score: number;
  reason: string;
}

interface SymbolStub {
  id: string;
  label_en: string;
  categories: string[];
}

const ESTIMATED_COST_USD = 0.002; // GPT-4o-mini ~ $0.0015 input + $0.006 output / 1k toks; 3-5 picks ≈ $0.002.

/**
 * Returns a list of LLM-picked suggestions, or an empty array if:
 *   - OPENAI_API_KEY is missing.
 *   - aiGuard blocks the call.
 *   - The OpenAI request fails for any reason (graceful degrade).
 *
 * Caller should always have frequency-based suggestions as the primary
 * path; this function adds *more* candidates when budget + config allow.
 */
export async function generateLlmSuggestions(input: {
  supabase: SupabaseClient<never>;
  childId: string;
  topCategories: string[];
  boardSymbolIds: string[];
  candidateSymbols: SymbolStub[];
}): Promise<LlmSuggestion[]> {
  if (!process.env.OPENAI_API_KEY) return [];
  if (input.candidateSymbols.length === 0) return [];

  const guard: GuardResult<LlmSuggestion[]> = await aiGuard(
    {
      childId: input.childId,
      service: 'gpt_personalization',
      estimatedCostUsd: ESTIMATED_COST_USD,
      units: 1,
      supabase: input.supabase,
    },
    async () => callOpenAi(input),
  );

  if (!guard.ok) return [];
  return guard.result;
}

async function callOpenAi(input: {
  topCategories: string[];
  boardSymbolIds: string[];
  candidateSymbols: SymbolStub[];
}): Promise<LlmSuggestion[]> {
  const sys = `You are an AAC vocabulary curator. The user is a caregiver of a non-verbal child with autism. Pick 3-5 symbols from the candidate list that would be most useful additions to the child's board. Prefer symbols from categories the child is already engaging with. Return strict JSON of shape: {"picks": [{"symbolId":"<uuid>","score":0..1,"reason":"<short reason>"}]}.`;
  const user = JSON.stringify({
    topCategories: input.topCategories,
    boardSymbolIds: input.boardSymbolIds,
    candidates: input.candidateSymbols,
  });

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: user },
      ],
      temperature: 0.2,
      max_tokens: 400,
    }),
  });
  if (!res.ok) return [];
  type OpenAiResp = { choices?: { message?: { content?: string } }[] };
  const body = (await res.json()) as OpenAiResp;
  const content = body.choices?.[0]?.message?.content;
  if (!content) return [];
  try {
    const parsed = JSON.parse(content) as { picks?: LlmSuggestion[] };
    if (!Array.isArray(parsed.picks)) return [];
    return parsed.picks
      .filter((p) => typeof p.symbolId === 'string' && typeof p.score === 'number')
      .slice(0, 5);
  } catch {
    return [];
  }
}

/** True when the deployment has OPENAI_API_KEY set — used by the
 *  caregiver settings UI to decide whether to render the toggle at all. */
export function isLlmAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY;
}
