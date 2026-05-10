-- =============================================================================
-- Quality Fix Phase 3 — extend `suggestion_source` enum for Claude.
--
-- The original enum (frequency | llm) maps `llm` to GPT-4o-mini suggestions
-- shipped during Module 5. Quality Fix replaces the dumb-frequency baseline
-- with Claude Sonnet 4.6 contextual suggestions. We add `claude` as a
-- distinct source so:
--
--   • the dashboard's personalization panel can render the rationale text
--     inline (Claude returns a per-suggestion `rationale` string; the GPT
--     path doesn't);
--   • the cron's audit_log entries can distinguish Claude vs. GPT vs.
--     frequency contributions per run;
--   • analytics can compare approval rates between sources without parsing
--     the suggestions.signals jsonb.
--
-- Idempotent.
-- =============================================================================

alter type public.suggestion_source add value if not exists 'claude';
