-- =============================================================================
-- Quality Fix — extend ai_service enum to cover Claude Sonnet calls.
--
-- The Quality Fix override wires Anthropic Claude Sonnet 4.6 into:
--   • vocabulary suggestions (replaces dumb-frequency on /dashboard/personalization)
--   • symbol-image vision audit (fixes the "Apple labeled as car" data-quality
--     bug)
--   • sentence completion on the AAC board
--   • content-quality / bilingual translation review
--
-- Every Claude call charges through aiGuard which writes a row to
-- ai_usage_ledger. The existing enum only knows about Whisper / GPT /
-- ElevenLabs / Azure — we add four Claude-shaped values so the cost
-- accounting cleanly separates audit / suggest / complete / other usage.
--
-- Idempotent: ADD VALUE IF NOT EXISTS is safe to re-run.
-- =============================================================================

alter type public.ai_service add value if not exists 'claude_suggest';
alter type public.ai_service add value if not exists 'claude_audit';
alter type public.ai_service add value if not exists 'claude_complete';
alter type public.ai_service add value if not exists 'claude_other';
