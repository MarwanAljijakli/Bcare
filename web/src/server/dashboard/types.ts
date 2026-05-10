/**
 * Dashboard payload — Module 6.
 *
 * Shape returned by `loadDashboard()`. The server page calls the loader
 * once, then hands the payload down through pure server components. No
 * client component on the dashboard ever fetches data directly; the
 * single round-trip + RSC tree keeps the bundle minimal and the auth
 * boundary obvious.
 */
import type { AppLocale } from '@/i18n/routing';

export type Modality = 'symbol' | 'speech' | 'gesture' | 'keyboard';

export interface DashboardCaregiver {
  firstName: string | null;
  email: string | null;
  locale: AppLocale;
}

export interface DashboardChild {
  id: string;
  name: string;
  ageYears: number | null;
}

export interface DashboardHero {
  todayStars: number;
  currentStreakDays: number;
  longestStreakDays: number;
  activeVocabularySize: number;
  todayInputCount: number;
}

export interface DashboardModalityBreakdown {
  symbol: number;
  speech: number;
  gesture: number;
  keyboard: number;
}

export interface DashboardToday {
  modality: DashboardModalityBreakdown;
  successRate: number; // 0..1
  avgSentenceLength: number;
  last24hInputs: number;
  hasData: boolean;
}

export interface DashboardSessionRow {
  id: string;
  startedAt: string;
  durationSeconds: number;
  inputCount: number;
  successRate: number; // 0..1
}

export interface DashboardTopSymbol {
  rank: number;
  symbolId: string;
  label: string;
  imagePath: string | null;
  count: number;
}

export interface DashboardSparklinePoint {
  day: string; // ISO YYYY-MM-DD
  size: number;
}

export interface DashboardSuggestion {
  id: string;
  source: 'frequency' | 'llm';
  score: number;
  reason: string | null;
  symbol: {
    id: string;
    label: string;
    imagePath: string | null;
  };
}

export interface DashboardEmpty {
  newCaregiver: boolean; // no children at all
  noSessions: boolean;
  noMetrics: boolean;
  noSuggestions: boolean;
}

export interface DashboardPayload {
  caregiver: DashboardCaregiver;
  children: DashboardChild[];
  activeChildId: string | null;
  hero: DashboardHero;
  today: DashboardToday;
  recentSessions: DashboardSessionRow[];
  topSymbols: DashboardTopSymbol[];
  vocabSparkline: DashboardSparklinePoint[];
  suggestions: DashboardSuggestion[];
  empty: DashboardEmpty;
}
