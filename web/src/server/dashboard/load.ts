import 'server-only';
/**
 * Dashboard loader — Module 6.
 *
 * Single async function called by the dashboard server page. Performs
 * one parallel batch of seven RLS-scoped reads after resolving the
 * caregiver's children + active child. RLS does ALL scoping; we never
 * filter by caregiver_id in app code. Filtering manually risks
 * divergence with `therapist_grants` once therapist read access ships.
 *
 * Day-1 friendly: when the caregiver has no children OR the active
 * child has no progress_metrics yet, the loader still returns a valid
 * payload with the relevant `empty.*` flags set. Components downstream
 * use those flags to render copy-rich empty states instead of
 * misleading 0% bars.
 */
import { ageYears, firstNameOf, pickSymbolLabel, sortChildrenForTabs } from './format';
import type {
  DashboardChild,
  DashboardModalityBreakdown,
  DashboardPayload,
  DashboardSessionRow,
  DashboardSparklinePoint,
  DashboardSuggestion,
  DashboardTopSymbol,
} from './types';
import type { AppLocale } from '@/i18n/routing';
import type { SupabaseClient } from '@supabase/supabase-js';

// Match the relaxed shape the rest of the server modules use; the
// generated `Database` type drifts in shape between Supabase generator
// versions and forcing it through here costs more than it earns.
type SupabaseAny = SupabaseClient<never>;

const SPARKLINE_DAYS = 30;
const RECENT_SESSIONS_LIMIT = 10;
const TOP_SYMBOLS_LIMIT = 6;
const SUGGESTIONS_LIMIT = 6;

interface ChildRow {
  id: string;
  full_name: string;
  preferred_name: string | null;
  date_of_birth: string | null;
  created_at: string;
}

interface GamificationRow {
  total_stars: number;
  current_streak_days: number;
  longest_streak_days: number;
  stars_awarded_today: number;
  stars_awarded_day: string | null;
}

interface ProgressMetricRow {
  day: string;
  active_vocabulary_size: number;
  input_count: number;
  output_count: number;
  avg_sentence_length: string | number | null;
  success_rate: string | number | null;
  modality_breakdown: Partial<DashboardModalityBreakdown> | null;
  top_symbols: { symbolId: string; count: number }[] | null;
}

interface SessionRowRaw {
  id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  input_count: number | null;
  successful_selections: number | null;
}

interface SuggestionRowRaw {
  id: string;
  source: 'frequency' | 'llm';
  score: string | number;
  reason: string | null;
  symbol_id: string;
}

interface SymbolRow {
  id: string;
  label_en: string | null;
  label_ar: string | null;
  image_path: string | null;
}

function todayKey(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** ISO YYYY-MM-DD for `daysAgo` days before today (UTC). */
function dayKeyDaysAgo(daysAgo: number, now: Date = new Date()): string {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return todayKey(d);
}

function emptyHero() {
  return {
    todayStars: 0,
    currentStreakDays: 0,
    longestStreakDays: 0,
    activeVocabularySize: 0,
    todayInputCount: 0,
  };
}

function emptyToday() {
  return {
    modality: { symbol: 0, speech: 0, gesture: 0, keyboard: 0 },
    successRate: 0,
    avgSentenceLength: 0,
    last24hInputs: 0,
    hasData: false,
  };
}

function emptyPayload(args: {
  caregiverFirstName: string | null;
  caregiverEmail: string | null;
  locale: AppLocale;
  newCaregiver: boolean;
  isAdmin?: boolean;
}): DashboardPayload {
  return {
    caregiver: {
      firstName: args.caregiverFirstName,
      email: args.caregiverEmail,
      locale: args.locale,
      isAdmin: args.isAdmin ?? false,
    },
    children: [],
    activeChildId: null,
    hero: emptyHero(),
    today: emptyToday(),
    recentSessions: [],
    topSymbols: [],
    vocabSparkline: zeroSparkline(),
    suggestions: [],
    empty: {
      newCaregiver: args.newCaregiver,
      noSessions: true,
      noMetrics: true,
      noSuggestions: true,
    },
  };
}

function zeroSparkline(): DashboardSparklinePoint[] {
  const points: DashboardSparklinePoint[] = [];
  for (let i = SPARKLINE_DAYS - 1; i >= 0; i--) {
    points.push({ day: dayKeyDaysAgo(i), size: 0 });
  }
  return points;
}

export interface LoadDashboardArgs {
  supabase: SupabaseAny;
  userId: string;
  locale: AppLocale;
  childIdParam: string | null;
  /** Override `now` for testing. Defaults to system clock. */
  now?: Date;
}

/**
 * Load everything the dashboard renders. Single function, single page
 * load; never call from a client component.
 */
export async function loadDashboard(args: LoadDashboardArgs): Promise<DashboardPayload> {
  const { supabase, userId, locale, childIdParam } = args;
  const now = args.now ?? new Date();

  // 1. Caregiver profile (best-effort). We also read `role` so the
  // dashboard shell can surface the Admin link when the caller has it.
  const profileFetch = (
    supabase.from('profiles') as never as {
      select: (cols: string) => {
        eq: (
          col: string,
          v: string,
        ) => {
          maybeSingle: () => Promise<{
            data: { full_name: string | null; role: string | null } | null;
          }>;
        };
      };
    }
  )
    .select('full_name, role')
    .eq('user_id', userId)
    .maybeSingle();

  const userFetch = supabase.auth.getUser();
  const childrenFetch = (
    supabase.from('children') as never as {
      select: (cols: string) => {
        is: (
          col: string,
          v: null,
        ) => {
          order: (
            col: string,
            opts: { ascending: boolean },
          ) => Promise<{ data: ChildRow[] | null }>;
        };
      };
    }
  )
    .select('id, full_name, preferred_name, date_of_birth, created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  const [profileRes, userRes, childrenRes] = await Promise.all([
    profileFetch,
    userFetch,
    childrenFetch,
  ]);

  const caregiverFirstName = firstNameOf(profileRes.data?.full_name ?? null);
  const caregiverEmail = userRes.data.user?.email ?? null;
  const isAdmin = profileRes.data?.role === 'admin';
  const childrenRaw = childrenRes.data ?? [];

  if (childrenRaw.length === 0) {
    return emptyPayload({
      caregiverFirstName,
      caregiverEmail,
      locale,
      newCaregiver: true,
      isAdmin,
    });
  }

  const children: DashboardChild[] = sortChildrenForTabs(
    childrenRaw.map((c) => ({
      id: c.id,
      name: c.preferred_name?.trim() || c.full_name.trim(),
      ageYears: ageYears(c.date_of_birth, now),
    })),
  );

  // Resolve active child — query param, validated against owned children.
  // Silent fallback to first child if mismatch (never echo the rejected id).
  let activeChild = children[0]!;
  if (childIdParam) {
    const match = children.find((c) => c.id === childIdParam);
    if (match) activeChild = match;
  }
  const activeChildId = activeChild.id;

  // 2. Per-child reads — the seven-way batch.
  const sparklineFromDay = dayKeyDaysAgo(SPARKLINE_DAYS - 1, now);
  const today = todayKey(now);
  const last24hStart = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const gamificationFetch = (
    supabase.from('gamification_state') as never as {
      select: (cols: string) => {
        eq: (
          col: string,
          v: string,
        ) => {
          maybeSingle: () => Promise<{ data: GamificationRow | null }>;
        };
      };
    }
  )
    .select(
      'total_stars, current_streak_days, longest_streak_days, stars_awarded_today, stars_awarded_day',
    )
    .eq('child_id', activeChildId)
    .maybeSingle();

  const metricsFetch = (
    supabase.from('progress_metrics') as never as {
      select: (cols: string) => {
        eq: (
          col: string,
          v: string,
        ) => {
          gte: (
            col: string,
            v: string,
          ) => {
            order: (
              col: string,
              opts: { ascending: boolean },
            ) => Promise<{ data: ProgressMetricRow[] | null }>;
          };
        };
      };
    }
  )
    .select(
      'day, active_vocabulary_size, input_count, output_count, avg_sentence_length, success_rate, modality_breakdown, top_symbols',
    )
    .eq('child_id', activeChildId)
    .gte('day', sparklineFromDay)
    .order('day', { ascending: true });

  const sessionsFetch = (
    supabase.from('sessions') as never as {
      select: (cols: string) => {
        eq: (
          col: string,
          v: string,
        ) => {
          order: (
            col: string,
            opts: { ascending: boolean },
          ) => {
            limit: (n: number) => Promise<{ data: SessionRowRaw[] | null }>;
          };
        };
      };
    }
  )
    .select('id, started_at, ended_at, duration_seconds, input_count, successful_selections')
    .eq('child_id', activeChildId)
    .order('started_at', { ascending: false })
    .limit(RECENT_SESSIONS_LIMIT);

  const vocabSizeFetch = (
    supabase.from('vocabulary_sets') as never as {
      select: (
        cols: string,
        opts: { count: 'exact'; head: true },
      ) => {
        eq: (col: string, v: string) => Promise<{ count: number | null }>;
      };
    }
  )
    .select('child_id', { count: 'exact', head: true })
    .eq('child_id', activeChildId);

  const last24hFetch = (
    supabase.from('input_events') as never as {
      select: (
        cols: string,
        opts: { count: 'exact'; head: true },
      ) => {
        eq: (
          col: string,
          v: string,
        ) => {
          gte: (col: string, v: string) => Promise<{ count: number | null }>;
        };
      };
    }
  )
    .select('id', { count: 'exact', head: true })
    .eq('child_id', activeChildId)
    .gte('created_at', last24hStart);

  const suggestionsFetch = (
    supabase.from('vocabulary_suggestions') as never as {
      select: (cols: string) => {
        eq: (
          col: string,
          v: string,
        ) => {
          eq: (
            col2: string,
            v2: string,
          ) => {
            order: (
              col: string,
              opts: { ascending: boolean },
            ) => {
              limit: (n: number) => Promise<{ data: SuggestionRowRaw[] | null }>;
            };
          };
        };
      };
    }
  )
    .select('id, source, score, reason, symbol_id')
    .eq('child_id', activeChildId)
    .eq('status', 'pending')
    .order('score', { ascending: false })
    .limit(SUGGESTIONS_LIMIT);

  const [gamRes, metricsRes, sessionsRes, vocabSizeRes, last24hRes, suggestionsRes] =
    await Promise.all([
      gamificationFetch,
      metricsFetch,
      sessionsFetch,
      vocabSizeFetch,
      last24hFetch,
      suggestionsFetch,
    ]);

  const gam = gamRes.data;
  const metricRows = metricsRes.data ?? [];
  const sessionsRaw = sessionsRes.data ?? [];
  const vocabSize = vocabSizeRes.count ?? 0;
  const last24h = last24hRes.count ?? 0;
  const suggestionsRaw = suggestionsRes.data ?? [];

  // 3. Symbol catalog enrichment — single follow-up read for every symbol
  //    referenced by either top_symbols or pending suggestions. Capped.
  const symbolIds = new Set<string>();
  for (const m of metricRows) {
    for (const t of m.top_symbols ?? []) symbolIds.add(t.symbolId);
  }
  for (const s of suggestionsRaw) symbolIds.add(s.symbol_id);

  const symbolMap = new Map<string, SymbolRow>();
  if (symbolIds.size > 0) {
    const ids = Array.from(symbolIds).slice(0, 60);
    const symbolsRes = await (
      supabase.from('symbols') as never as {
        select: (cols: string) => {
          in: (col: string, v: string[]) => Promise<{ data: SymbolRow[] | null }>;
        };
      }
    )
      .select('id, label_en, label_ar, image_path')
      .in('id', ids);
    for (const r of symbolsRes.data ?? []) symbolMap.set(r.id, r);
  }

  // 4. Build the payload.
  const todayMetric = metricRows.find((m) => m.day === today) ?? null;
  const recentMetric = todayMetric ?? metricRows[metricRows.length - 1] ?? null;

  const noMetrics = metricRows.length === 0;
  const noSessions = sessionsRaw.length === 0;
  const noSuggestions = suggestionsRaw.length === 0;

  const todayStars = gam && gam.stars_awarded_day === today ? gam.stars_awarded_today : 0;

  // ---- recentSessions ----
  const recentSessions: DashboardSessionRow[] = sessionsRaw.map((s) => ({
    id: s.id,
    startedAt: s.started_at,
    durationSeconds: s.duration_seconds ?? 0,
    inputCount: s.input_count ?? 0,
    successRate: s.input_count
      ? Math.max(0, Math.min(1, (s.successful_selections ?? 0) / s.input_count))
      : 0,
  }));

  // ---- topSymbols (aggregated across the metric window) ----
  const symbolCount = new Map<string, number>();
  for (const m of metricRows) {
    for (const t of m.top_symbols ?? []) {
      symbolCount.set(t.symbolId, (symbolCount.get(t.symbolId) ?? 0) + (t.count ?? 0));
    }
  }
  const topSymbols: DashboardTopSymbol[] = Array.from(symbolCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_SYMBOLS_LIMIT)
    .map(([id, count], i) => {
      const sym = symbolMap.get(id) ?? null;
      return {
        rank: i + 1,
        symbolId: id,
        label: pickSymbolLabel(locale, sym),
        imagePath: sym?.image_path ?? null,
        count,
      };
    });

  // ---- vocabSparkline ----
  const sparkMap = new Map<string, number>();
  for (const m of metricRows) sparkMap.set(m.day, m.active_vocabulary_size ?? 0);
  const vocabSparkline: DashboardSparklinePoint[] = [];
  for (let i = SPARKLINE_DAYS - 1; i >= 0; i--) {
    const day = dayKeyDaysAgo(i, now);
    vocabSparkline.push({ day, size: sparkMap.get(day) ?? 0 });
  }

  // ---- today panel ----
  const modality: DashboardModalityBreakdown = {
    symbol: 0,
    speech: 0,
    gesture: 0,
    keyboard: 0,
  };
  if (recentMetric?.modality_breakdown) {
    const mb = recentMetric.modality_breakdown;
    modality.symbol = Math.max(0, Math.round(mb.symbol ?? 0));
    modality.speech = Math.max(0, Math.round(mb.speech ?? 0));
    modality.gesture = Math.max(0, Math.round(mb.gesture ?? 0));
    modality.keyboard = Math.max(0, Math.round(mb.keyboard ?? 0));
  }
  const successRate = recentMetric ? Number(recentMetric.success_rate ?? 0) : 0;
  const avgSentenceLength = recentMetric ? Number(recentMetric.avg_sentence_length ?? 0) : 0;
  const todayHasData = !!recentMetric;

  // ---- suggestions ----
  const suggestions: DashboardSuggestion[] = suggestionsRaw.map((s) => {
    const sym = symbolMap.get(s.symbol_id) ?? null;
    return {
      id: s.id,
      source: s.source,
      score: Number(s.score),
      reason: s.reason,
      symbol: {
        id: s.symbol_id,
        label: pickSymbolLabel(locale, sym),
        imagePath: sym?.image_path ?? null,
      },
    };
  });

  return {
    caregiver: {
      firstName: caregiverFirstName,
      email: caregiverEmail,
      locale,
      isAdmin,
    },
    children,
    activeChildId,
    hero: {
      todayStars,
      currentStreakDays: gam?.current_streak_days ?? 0,
      longestStreakDays: gam?.longest_streak_days ?? 0,
      activeVocabularySize: vocabSize,
      todayInputCount: todayMetric?.input_count ?? 0,
    },
    today: {
      modality,
      successRate,
      avgSentenceLength,
      last24hInputs: last24h,
      hasData: todayHasData,
    },
    recentSessions,
    topSymbols,
    vocabSparkline,
    suggestions,
    empty: {
      newCaregiver: false,
      noSessions,
      noMetrics,
      noSuggestions,
    },
  };
}
