/**
 * Smoke test for the Anthropic Claude wrapper — Quality Fix Phase 0.7.
 *
 * Sends a one-token prompt through the Anthropic SDK and asserts the
 * response is exactly the word "ready". Confirms three things:
 *
 *   1. ANTHROPIC_API_KEY is set + valid.
 *   2. The SDK can reach the Anthropic API from this network.
 *   3. The model ID `claude-sonnet-4-6` resolves and returns text.
 *
 * Implementation note: this script invokes the SDK directly rather
 * than importing `web/src/lib/ai/anthropic.ts`. That wrapper is tagged
 * with `import 'server-only'` (a Next.js-internal module) which does
 * not resolve under plain tsx, so any import chain hitting it throws
 * at module-load. The wrapper's logic (model ID, pricing constants,
 * cost computation) is mirrored here so the smoke test stays
 * self-contained.
 *
 * Does NOT touch ai_usage_ledger — this is a connectivity probe with
 * no child context. Production code paths use the wrapper's
 * `claudeForChild()` which routes through aiGuard.
 *
 * Usage:
 *   pnpm exec tsx db/scripts/test-anthropic.ts
 *
 * Exit codes:
 *   0 — response is "ready". Phase 0 connectivity confirmed.
 *   1 — request failed OR response did not match.
 *   2 — ANTHROPIC_API_KEY missing.
 */
import './lib/env';
import Anthropic from '@anthropic-ai/sdk';

const CLAUDE_MODEL = 'claude-sonnet-4-6';
const INPUT_PER_MTOK_USD = 3;
const OUTPUT_PER_MTOK_USD = 15;

function estimateCost(input_tokens: number, output_tokens: number): number {
  const cost =
    (Math.max(0, input_tokens) / 1_000_000) * INPUT_PER_MTOK_USD +
    (Math.max(0, output_tokens) / 1_000_000) * OUTPUT_PER_MTOK_USD;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

async function main(): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('[smoke] FAILED — Missing ANTHROPIC_API_KEY in env.');
    process.exit(2);
  }
  console.info(`[smoke] model   = ${CLAUDE_MODEL}`);
  console.info('[smoke] sending one-word prompt …');

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const startedAt = Date.now();
  let res;
  try {
    res = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 16,
      temperature: 0,
      system:
        'You are a smoke-test endpoint. Respond with the single lowercase word "ready" and nothing else. No punctuation, no quotes, no explanation.',
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: 'Reply with the single word: ready' }],
        },
      ],
    });
  } catch (e) {
    console.error('[smoke] FAILED — request threw:');
    console.error(e instanceof Error ? e.stack : String(e));
    process.exit(1);
  }
  const elapsedMs = Date.now() - startedAt;

  const text = res.content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');
  const trimmed = text.trim().toLowerCase();
  const cost = estimateCost(res.usage.input_tokens, res.usage.output_tokens);

  console.info(`[smoke] response   = ${JSON.stringify(text)}`);
  console.info(`[smoke] trimmed    = ${JSON.stringify(trimmed)}`);
  console.info(`[smoke] tokens     = in:${res.usage.input_tokens} out:${res.usage.output_tokens}`);
  console.info(`[smoke] cost       = $${cost.toFixed(6)}`);
  console.info(`[smoke] elapsedMs  = ${elapsedMs}`);
  console.info(`[smoke] stopReason = ${res.stop_reason ?? 'null'}`);

  if (trimmed !== 'ready') {
    console.error(`[smoke] FAILED — expected "ready", got ${JSON.stringify(trimmed)}`);
    process.exit(1);
  }
  console.info('[smoke] OK — Anthropic wrapper is wired correctly.');
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.stack : String(e));
  process.exit(1);
});
