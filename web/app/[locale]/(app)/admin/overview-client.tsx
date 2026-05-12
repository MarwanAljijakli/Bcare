'use client';

import { AlertCircle, CheckCircle2, Database, Mic, Shield, Server } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';

interface Props {
  locale: 'en' | 'ar';
}

type AnyJson = Record<string, unknown>;

function bool(v: unknown): boolean {
  return v === true;
}

function nullableStr(v: unknown): string | null {
  if (typeof v === 'string' && v.length > 0) return v;
  return null;
}

export function AdminOverviewClient({ locale }: Props) {
  const query = trpc.admin.health.useQuery(undefined, {
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
  });
  const T = LABELS[locale];

  const auth = (query.data?.auth as AnyJson | null) ?? null;
  const voice = (query.data?.voice as AnyJson | null) ?? null;
  const api = (query.data?.api as AnyJson | null) ?? null;
  const db = query.data?.database ?? null;

  const apiOk = bool(api?.ok);
  const authOk = bool(auth?.ok);
  const voiceOk = bool(voice?.ok);
  const bypassActive = bool(auth?.bypassActive);

  const providers = {
    elevenlabs: bool(voice?.elevenLabsConfigured),
    openai: bool(voice?.openAiTtsConfigured),
    whisper: bool(voice?.whisperConfigured),
    claude: bool(voice?.claudeConfigured),
  };
  const cacheHit =
    typeof voice?.ttsCacheHitRate30d === 'number' ? (voice.ttsCacheHitRate30d as number) : 0;
  const sttCalls = typeof voice?.sttCalls30d === 'number' ? (voice.sttCalls30d as number) : 0;
  const ttsCalls = typeof voice?.ttsCalls30d === 'number' ? (voice.ttsCalls30d as number) : 0;
  const cost = typeof voice?.totalCostUsd30d === 'number' ? (voice.totalCostUsd30d as number) : 0;

  return (
    <main className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-fg text-3xl font-bold tracking-tight">{T.title}</h1>
        <p className="text-fg-muted text-sm">{T.subtitle}</p>
        {query.isFetching && <p className="text-fg-subtle text-xs italic">{T.refreshing}</p>}
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Auth card */}
        <Card title={T.auth.title} icon={<Shield className="h-5 w-5" />} ok={authOk}>
          <Row label={T.auth.projectRef} value={nullableStr(auth?.supabaseProject) ?? '—'} />
          <Row
            label={T.auth.magicLinkOk}
            value={
              bool(auth?.magicLinkOk) ? (
                <span className="text-emerald-700 dark:text-emerald-400">{T.statusYes}</span>
              ) : (
                <span className="text-amber-700 dark:text-amber-400">{T.statusNo}</span>
              )
            }
          />
          <Row
            label={T.auth.bypass}
            value={
              bypassActive ? (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  {T.auth.bypassOn}
                </span>
              ) : (
                <span className="text-emerald-700 dark:text-emerald-400">{T.auth.bypassOff}</span>
              )
            }
          />
        </Card>

        {/* Voice card */}
        <Card title={T.voice.title} icon={<Mic className="h-5 w-5" />} ok={voiceOk}>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <ProviderChip label="ElevenLabs" ok={providers.elevenlabs} />
            <ProviderChip label="OpenAI TTS" ok={providers.openai} />
            <ProviderChip label="Whisper STT" ok={providers.whisper} />
            <ProviderChip label="Claude" ok={providers.claude} />
          </div>
          <Row label={T.voice.cacheHit} value={`${(cacheHit * 100).toFixed(1)}%`} />
          <Row label={T.voice.calls30d} value={`TTS ${ttsCalls} · STT ${sttCalls}`} />
          <Row label={T.voice.cost30d} value={`$${cost.toFixed(4)}`} />
        </Card>

        {/* Database card */}
        <Card title={T.database.title} icon={<Database className="h-5 w-5" />} ok>
          <Row label={T.database.projectRef} value={db?.projectRef ?? '—'} />
          <Row label={T.database.symbolsCount} value={db?.symbolsCount ?? '—'} />
          <Row label={T.database.lastMigration} value="0010_therapist_read_access" />
        </Card>

        {/* Deploy card */}
        <Card title={T.deploy.title} icon={<Server className="h-5 w-5" />} ok={apiOk}>
          <Row label={T.deploy.appVersion} value={nullableStr(api?.version) ?? '—'} />
          <Row
            label={T.deploy.heartbeat}
            value={
              apiOk ? (
                <span className="text-emerald-700 dark:text-emerald-400">{T.statusOk}</span>
              ) : (
                <span className="text-amber-700 dark:text-amber-400">{T.statusDown}</span>
              )
            }
          />
          <Row
            label={T.deploy.timestamp}
            value={nullableStr(api?.timestamp)?.slice(0, 19).replace('T', ' ') ?? '—'}
          />
        </Card>
      </div>
    </main>
  );
}

function Card({
  title,
  icon,
  ok,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  ok: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="border-border bg-bg-elevated space-y-3 rounded-2xl border p-5">
      <header className="flex items-center justify-between">
        <h2 className="text-fg flex items-center gap-2 text-lg font-bold">
          <span className="text-fg-muted">{icon}</span>
          {title}
        </h2>
        {ok ? (
          <CheckCircle2
            aria-hidden="true"
            className="h-5 w-5 text-emerald-600 dark:text-emerald-400"
          />
        ) : (
          <AlertCircle aria-hidden="true" className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        )}
      </header>
      <dl className="space-y-1.5">{children}</dl>
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <dt className="text-fg-muted">{label}</dt>
      <dd className="text-fg font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function ProviderChip({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span
      className={
        ok
          ? 'inline-flex items-center justify-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
          : 'inline-flex items-center justify-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
      }
    >
      {ok ? '✓' : '✗'} {label}
    </span>
  );
}

const LABELS = {
  en: {
    title: 'System overview',
    subtitle: 'Live state of auth, voice, database, and deploy. Refreshes every 30s.',
    refreshing: 'Refreshing…',
    statusYes: 'Yes',
    statusNo: 'No',
    statusOk: 'Healthy',
    statusDown: 'Down',
    auth: {
      title: 'Auth',
      projectRef: 'Project ref',
      magicLinkOk: 'Magic link route OK',
      bypass: 'Bypass mode',
      bypassOn: 'ON (dev)',
      bypassOff: 'OFF',
    },
    voice: {
      title: 'Voice',
      cacheHit: 'Cache hit rate (30d)',
      calls30d: 'Calls (30d)',
      cost30d: 'Cost (30d)',
    },
    database: {
      title: 'Database',
      projectRef: 'Project ref',
      symbolsCount: 'symbols rows',
      lastMigration: 'Last migration',
    },
    deploy: {
      title: 'Deploy',
      appVersion: 'App version',
      heartbeat: 'API heartbeat',
      timestamp: 'Probed at (UTC)',
    },
  },
  ar: {
    title: 'نظرة عامة على النظام',
    subtitle: 'الحالة الحيّة للمصادقة والصوت وقاعدة البيانات والنشر. تحديث كل ٣٠ ثانية.',
    refreshing: 'يتمّ التحديث…',
    statusYes: 'نعم',
    statusNo: 'لا',
    statusOk: 'سليم',
    statusDown: 'متعطّل',
    auth: {
      title: 'المصادقة',
      projectRef: 'مرجع المشروع',
      magicLinkOk: 'مسار الرابط السحري سليم',
      bypass: 'وضع التجاوز',
      bypassOn: 'مفعّل (تطوير)',
      bypassOff: 'متوقّف',
    },
    voice: {
      title: 'الصوت',
      cacheHit: 'نسبة التخزين المؤقّت (٣٠ يومًا)',
      calls30d: 'المكالمات (٣٠ يومًا)',
      cost30d: 'التكلفة (٣٠ يومًا)',
    },
    database: {
      title: 'قاعدة البيانات',
      projectRef: 'مرجع المشروع',
      symbolsCount: 'صفوف symbols',
      lastMigration: 'آخر هجرة',
    },
    deploy: {
      title: 'النشر',
      appVersion: 'إصدار التطبيق',
      heartbeat: 'نبضة API',
      timestamp: 'وقت الفحص (UTC)',
    },
  },
} as const;
