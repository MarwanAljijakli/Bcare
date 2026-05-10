-- =============================================================================
-- Quality Fix Phase 5 — per-child voice settings.
--
-- The /settings/voice page exposes:
--   • Voice picker (charlotte / sarah)  → already stored in children.voice_id
--   • Speed slider (0.75 / 1.0 / 1.25)  → new column children.voice_speed
--   • Auto-play on Speak toggle         → new column children.auto_play_speak
--
-- Defaults match the current board behavior so existing rows behave
-- identically without app-level migration.
--
-- Idempotent — every column ADD uses IF NOT EXISTS.
-- =============================================================================

alter table public.children
  add column if not exists voice_speed numeric(3, 2) not null default 1.00,
  add column if not exists auto_play_speak boolean not null default true;

-- Sanity check on the speed value so a buggy client can't write 99x.
alter table public.children
  drop constraint if exists children_voice_speed_range;
alter table public.children
  add constraint children_voice_speed_range check (voice_speed >= 0.5 and voice_speed <= 2.0);
