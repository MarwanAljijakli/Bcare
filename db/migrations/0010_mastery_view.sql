-- =============================================================================
-- Phase 10.D — child mastery tracking.
--
-- The board uses these aggregates to render the "Level X • Y/N mastered"
-- badge. The personalization cron auto-promotes the child's
-- vocabulary_level when ≥80% of the current level's symbols are
-- mastered. A symbol is "mastered" when the child has tapped it ≥10
-- times across ≥3 distinct sessions.
--
-- mastery_per_child_symbol is a materialized view so the board can
-- read it cheaply (no live aggregation over input_events on every
-- request). Refreshed nightly by /api/cron/personalization.
--
-- Idempotent — every drop/create uses IF NOT EXISTS.
-- =============================================================================

drop materialized view if exists public.mastery_per_child_symbol;

create materialized view public.mastery_per_child_symbol as
select
  ie.child_id,
  ie.symbol_id,
  count(*)::int                          as use_count,
  count(distinct ie.session_id)::int     as session_count,
  (count(*) >= 10
    and count(distinct ie.session_id) >= 3)::int as is_mastered,
  max(ie.created_at)                     as last_used_at,
  min(ie.created_at)                     as first_used_at
from public.input_events ie
where ie.symbol_id is not null
  and ie.modality = 'symbol'
group by ie.child_id, ie.symbol_id;

create unique index if not exists mpcs_pk
  on public.mastery_per_child_symbol (child_id, symbol_id);

create index if not exists mpcs_child_idx
  on public.mastery_per_child_symbol (child_id);

create index if not exists mpcs_child_mastered_idx
  on public.mastery_per_child_symbol (child_id, is_mastered);

-- Refresh function exposed to the personalization cron via the
-- service role. CONCURRENTLY avoids blocking reads on the board while
-- the refresh runs (requires the unique index above).
create or replace function public.refresh_mastery_view()
returns void
language plpgsql
security definer
as $$
begin
  refresh materialized view concurrently public.mastery_per_child_symbol;
end;
$$;

revoke all on function public.refresh_mastery_view() from public;
grant execute on function public.refresh_mastery_view() to service_role;

-- Convenience view: per-child level snapshot. The personalization cron
-- could re-derive this on the fly, but having it as a view keeps the
-- /settings/level page + /dashboard insights queries trivial.
create or replace view public.child_level_progress as
select
  c.id            as child_id,
  c.vocabulary_level,
  coalesce(sum(case when m.is_mastered = 1 then 1 else 0 end), 0)::int as symbols_mastered,
  coalesce(count(m.symbol_id), 0)::int                                 as symbols_attempted,
  coalesce(sum(m.use_count), 0)::int                                   as total_uses
from public.children c
left join public.mastery_per_child_symbol m on m.child_id = c.id
group by c.id, c.vocabulary_level;

comment on materialized view public.mastery_per_child_symbol is
  'Phase 10.D — per-(child,symbol) mastery aggregates. Refresh via refresh_mastery_view() nightly. is_mastered=1 when use_count>=10 and session_count>=3.';
comment on view public.child_level_progress is
  'Phase 10.D — per-child rollup of mastery_per_child_symbol. Cheap read for the level badge + parent dashboard.';
