-- =============================================================================
-- Quality Fix Phase 2 — Supabase Storage bucket for TTS audio cache.
--
-- Every /api/voice/synthesize call hashes (text + voice + language + speed)
-- with SHA-256, looks up the resulting key in this bucket, and returns the
-- cached MP3 if present. On miss, ElevenLabs is called, the response is
-- uploaded here, and the public URL is returned. Cache hit rate target is
-- ≥ 60% over a 30-day window — without it, ElevenLabs costs balloon.
--
-- Per Quality Fix directive:
--   • public read (clients fetch the MP3 directly via the public URL)
--   • service-role write (the route handler uploads after each miss)
--   • 1MB cap per file (a 5-second clip at 64kbps mono MP3 is ~40KB; 1MB
--     leaves runway for longer phrases without permitting abuse)
--   • allowed mime: audio/mpeg only
--
-- Naming: keys live at `tts/<hash>.mp3` so we can co-locate other audio
-- types in the same bucket later (custom-voice samples, recorded prompts)
-- under different prefixes if needed.
--
-- Idempotent: the insert uses on conflict do nothing.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tts-cache', 'tts-cache', true, 1048576, '{"audio/mpeg"}')
on conflict (id) do nothing;

-- Public read access for the audio URLs the browser plays directly.
drop policy if exists tts_cache_public_read on storage.objects;
create policy tts_cache_public_read on storage.objects
  for select using (bucket_id = 'tts-cache');

-- Writes are gated to the service role (which bypasses RLS implicitly,
-- so this policy intentionally denies authenticated/anon writes —
-- there is no policy that grants them). Listing the bucket also stays
-- service-role-only so caregivers can't enumerate cache keys.
