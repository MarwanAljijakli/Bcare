import { Activity, Shield, Stamp, Users } from 'lucide-react';
import Link from 'next/link';
import { setRequestLocale } from 'next-intl/server';
import type { AppLocale } from '@/i18n/routing';
import { requireAdmin } from '@/lib/auth/admin-gate';

/**
 * Admin shell — Module 7.
 *
 * Wraps every /[locale]/admin/* route with the role gate + a left
 * sidebar nav. The gate runs server-side via `requireAdmin()`, which
 * redirects to /dashboard if the caller isn't role='admin' (the dev
 * caregiver IS admin under bypass thanks to seed-dev-admin.ts).
 *
 * The sidebar shows four destinations: Overview, Users, Symbols
 * (moderation queue), Audit log. The existing /admin/symbols-audit page
 * stays but isn't linked from this nav — it's a Quality-Fix diagnostic
 * surface, not a primary admin route.
 */
export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: AppLocale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdmin(locale);

  const T = LABELS[locale];

  return (
    <div className="container py-8">
      <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
        <aside aria-label={T.navLabel}>
          <nav className="border-border bg-bg-elevated sticky top-20 space-y-1 rounded-2xl border p-3">
            <SidebarLink
              href={`/${locale}/admin`}
              label={T.overview}
              icon={<Shield className="h-4 w-4" />}
            />
            <SidebarLink
              href={`/${locale}/admin/users`}
              label={T.users}
              icon={<Users className="h-4 w-4" />}
            />
            <SidebarLink
              href={`/${locale}/admin/symbols`}
              label={T.symbols}
              icon={<Stamp className="h-4 w-4" />}
            />
            <SidebarLink
              href={`/${locale}/admin/audit`}
              label={T.audit}
              icon={<Activity className="h-4 w-4" />}
            />
          </nav>
        </aside>
        <section>{children}</section>
      </div>
    </div>
  );
}

function SidebarLink({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="text-fg hover:bg-bg-muted flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
    >
      <span className="text-fg-muted">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}

const LABELS = {
  en: {
    navLabel: 'Admin navigation',
    overview: 'Overview',
    users: 'Users',
    symbols: 'Symbol queue',
    audit: 'Audit log',
  },
  ar: {
    navLabel: 'تنقّل المسؤول',
    overview: 'النظرة العامة',
    users: 'المستخدمون',
    symbols: 'قائمة الرموز',
    audit: 'سجل التدقيق',
  },
} as const;
