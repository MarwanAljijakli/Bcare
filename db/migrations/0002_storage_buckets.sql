-- =============================================================================
-- Module 3 — Storage buckets for symbol assets
--
-- Two buckets:
--   • symbols-public  — ARASAAC-seeded pictograms + admin-curated system art.
--                       Public read; INSERT only via service-role (seed/admin).
--   • symbols-private — caregiver-uploaded custom symbols + recorded voice
--                       clips. Private read; INSERT/SELECT scoped to the owner.
--
-- ARASAAC pictograms are CC BY-NC-SA. Attribution is rendered in the app
-- footer on /board and on /accessibility. The public bucket holds bytes
-- only; the relational metadata + attribution string lives on the
-- `symbols` table.
--
-- Run via Supabase SQL editor (operator-paste workflow until Module 9
-- swaps in drizzle-kit migrate against DATABASE_URL).
-- =============================================================================

-- Buckets
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('symbols-public', 'symbols-public', true, 524288, '{"image/png","image/svg+xml","image/webp"}'),
  ('symbols-private', 'symbols-private', false, 2097152, '{"image/png","image/jpeg","image/webp","audio/webm","audio/mpeg","audio/wav"}')
on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- symbols-public policies — public read; admin/service role writes only.
-- ─────────────────────────────────────────────────────────────────────────────
drop policy if exists "symbols_public_read" on storage.objects;
create policy "symbols_public_read" on storage.objects
  for select
  using (bucket_id = 'symbols-public');

drop policy if exists "symbols_public_admin_write" on storage.objects;
create policy "symbols_public_admin_write" on storage.objects
  for insert
  with check (
    bucket_id = 'symbols-public'
    and (auth.role() = 'service_role' or public.is_admin())
  );

drop policy if exists "symbols_public_admin_update" on storage.objects;
create policy "symbols_public_admin_update" on storage.objects
  for update
  using (
    bucket_id = 'symbols-public'
    and (auth.role() = 'service_role' or public.is_admin())
  );

drop policy if exists "symbols_public_admin_delete" on storage.objects;
create policy "symbols_public_admin_delete" on storage.objects
  for delete
  using (
    bucket_id = 'symbols-public'
    and (auth.role() = 'service_role' or public.is_admin())
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- symbols-private policies — owner-scoped read + write.
-- Convention: object path is `{user_id}/{filename}` so the policy can
-- match the leading folder against auth.uid().
-- ─────────────────────────────────────────────────────────────────────────────
drop policy if exists "symbols_private_owner_read" on storage.objects;
create policy "symbols_private_owner_read" on storage.objects
  for select
  using (
    bucket_id = 'symbols-private'
    and (
      auth.role() = 'service_role'
      or public.is_admin()
      or (storage.foldername(name))[1] = auth.uid()::text
    )
  );

drop policy if exists "symbols_private_owner_write" on storage.objects;
create policy "symbols_private_owner_write" on storage.objects
  for insert
  with check (
    bucket_id = 'symbols-private'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "symbols_private_owner_update" on storage.objects;
create policy "symbols_private_owner_update" on storage.objects
  for update
  using (
    bucket_id = 'symbols-private'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "symbols_private_owner_delete" on storage.objects;
create policy "symbols_private_owner_delete" on storage.objects
  for delete
  using (
    bucket_id = 'symbols-private'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
