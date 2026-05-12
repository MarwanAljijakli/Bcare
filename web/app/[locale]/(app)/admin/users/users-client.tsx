'use client';

import { ChevronLeft, ChevronRight, Loader2, Search } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc/client';

interface UserRowData {
  userId: string;
  email: string | null;
  fullName: string | null;
  role: string;
  locale: string;
  status: 'active' | 'tombstoned' | 'locked_out';
  createdAt: string;
  lockedUntil: string | null;
}

interface Props {
  locale: 'en' | 'ar';
}

type RoleFilter = 'all' | 'family' | 'caregiver' | 'therapist' | 'admin';
type LocaleFilter = 'all' | 'en' | 'ar';
type StatusFilter = 'all' | 'active' | 'tombstoned' | 'locked_out';

export function AdminUsersClient({ locale }: Props) {
  const T = LABELS[locale];
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [role, setRole] = useState<RoleFilter>('all');
  const [localeFilter, setLocaleFilter] = useState<LocaleFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const list = trpc.admin.usersList.useQuery({
    search: debouncedSearch || undefined,
    role,
    locale: localeFilter,
    status,
    page,
    pageSize: 25,
  });

  const detail = trpc.admin.userDetail.useQuery(
    { userId: selectedUserId ?? '' },
    { enabled: !!selectedUserId },
  );

  // Keyboard shortcuts: j/k to navigate rows, Enter to select.
  const rowsRef = useRef<UserRowData[]>(list.data?.rows ?? []);
  rowsRef.current = list.data?.rows ?? [];
  const [focusedIndex, setFocusedIndex] = useState(0);

  const move = useCallback((delta: number) => {
    setFocusedIndex((prev) => {
      const max = rowsRef.current.length - 1;
      const next = Math.max(0, Math.min(max, prev + delta));
      return next;
    });
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Ignore when typing into an input/textarea.
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (e.key === 'j') {
        e.preventDefault();
        move(1);
      } else if (e.key === 'k') {
        e.preventDefault();
        move(-1);
      } else if (e.key === 'Enter') {
        const row = rowsRef.current[focusedIndex];
        if (row) {
          e.preventDefault();
          setSelectedUserId(row.userId);
        }
      } else if (e.key === 'Escape' && selectedUserId) {
        setSelectedUserId(null);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focusedIndex, move, selectedUserId]);

  const totalPages = Math.max(1, Math.ceil((list.data?.total ?? 0) / 25));

  return (
    <main className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-fg text-3xl font-bold tracking-tight">{T.title}</h1>
        <p className="text-fg-muted text-sm">{T.subtitle}</p>
        <p className="text-fg-subtle text-xs">{T.kbHint}</p>
      </header>

      <FilterBar
        locale={locale}
        search={search}
        onSearch={(v) => {
          setSearch(v);
          setPage(1);
        }}
        role={role}
        onRole={(v) => {
          setRole(v);
          setPage(1);
        }}
        localeFilter={localeFilter}
        onLocaleFilter={(v) => {
          setLocaleFilter(v);
          setPage(1);
        }}
        status={status}
        onStatus={(v) => {
          setStatus(v);
          setPage(1);
        }}
      />

      <UserTable
        locale={locale}
        rows={list.data?.rows ?? []}
        loading={list.isLoading}
        focusedIndex={focusedIndex}
        selectedUserId={selectedUserId}
        onSelect={(id) => setSelectedUserId(id)}
      />

      <Pagination
        locale={locale}
        page={page}
        totalPages={totalPages}
        onPrev={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
      />

      {selectedUserId && (
        <UserDetailPanel
          locale={locale}
          isLoading={detail.isLoading}
          data={detail.data ?? null}
          onClose={() => setSelectedUserId(null)}
        />
      )}
    </main>
  );
}

function FilterBar({
  locale,
  search,
  onSearch,
  role,
  onRole,
  localeFilter,
  onLocaleFilter,
  status,
  onStatus,
}: {
  locale: 'en' | 'ar';
  search: string;
  onSearch: (v: string) => void;
  role: RoleFilter;
  onRole: (v: RoleFilter) => void;
  localeFilter: LocaleFilter;
  onLocaleFilter: (v: LocaleFilter) => void;
  status: StatusFilter;
  onStatus: (v: StatusFilter) => void;
}) {
  const T = LABELS[locale];
  return (
    <section className="border-border-muted bg-bg-elevated grid gap-3 rounded-2xl border p-4 md:grid-cols-4">
      <label className="relative md:col-span-2">
        <Search
          aria-hidden="true"
          className="text-fg-muted pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2"
        />
        <input
          type="text"
          placeholder={T.searchPlaceholder}
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="border-border bg-bg text-fg focus:ring-fg/30 w-full rounded-lg border py-2 pe-3 ps-9 text-sm focus:outline-none focus:ring-2"
        />
      </label>
      <select
        value={role}
        onChange={(e) => onRole(e.target.value as RoleFilter)}
        className="border-border bg-bg text-fg rounded-lg border px-3 py-2 text-sm"
        aria-label={T.filterRoleLabel}
      >
        <option value="all">{T.filterRoleAll}</option>
        <option value="family">family</option>
        <option value="caregiver">caregiver</option>
        <option value="therapist">therapist</option>
        <option value="admin">admin</option>
      </select>
      <select
        value={status}
        onChange={(e) => onStatus(e.target.value as StatusFilter)}
        className="border-border bg-bg text-fg rounded-lg border px-3 py-2 text-sm"
        aria-label={T.filterStatusLabel}
      >
        <option value="all">{T.filterStatusAll}</option>
        <option value="active">{T.statusActive}</option>
        <option value="tombstoned">{T.statusTombstoned}</option>
        <option value="locked_out">{T.statusLocked}</option>
      </select>
      <select
        value={localeFilter}
        onChange={(e) => onLocaleFilter(e.target.value as LocaleFilter)}
        className="border-border bg-bg text-fg rounded-lg border px-3 py-2 text-sm md:col-start-3"
        aria-label={T.filterLocaleLabel}
      >
        <option value="all">{T.filterLocaleAll}</option>
        <option value="en">EN</option>
        <option value="ar">AR</option>
      </select>
    </section>
  );
}

function UserTable({
  locale,
  rows,
  loading,
  focusedIndex,
  selectedUserId,
  onSelect,
}: {
  locale: 'en' | 'ar';
  rows: UserRowData[];
  loading: boolean;
  focusedIndex: number;
  selectedUserId: string | null;
  onSelect: (id: string) => void;
}) {
  const T = LABELS[locale];
  if (loading)
    return (
      <div className="text-fg-muted flex items-center gap-2 text-sm">
        <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
        {T.loading}
      </div>
    );
  if (rows.length === 0) return <p className="text-fg-muted text-sm">{T.emptyResults}</p>;

  return (
    <div className="border-border-muted overflow-x-auto rounded-2xl border">
      <table className="w-full text-sm">
        <thead className="bg-bg-elevated text-fg-subtle text-xs uppercase tracking-wide">
          <tr>
            <th scope="col" className="px-3 py-2 text-start">
              {T.colEmail}
            </th>
            <th scope="col" className="px-3 py-2 text-start">
              {T.colName}
            </th>
            <th scope="col" className="px-3 py-2 text-start">
              {T.colRole}
            </th>
            <th scope="col" className="px-3 py-2 text-start">
              {T.colLocale}
            </th>
            <th scope="col" className="px-3 py-2 text-start">
              {T.colStatus}
            </th>
            <th scope="col" className="px-3 py-2 text-start">
              {T.colCreated}
            </th>
          </tr>
        </thead>
        <tbody className="divide-border-muted divide-y">
          {rows.map((r, idx) => (
            <tr
              key={r.userId}
              onClick={() => onSelect(r.userId)}
              className={
                'text-fg hover:bg-bg-muted cursor-pointer ' +
                (selectedUserId === r.userId
                  ? 'bg-bg-muted'
                  : focusedIndex === idx
                    ? 'bg-bg-elevated'
                    : '')
              }
            >
              <td className="px-3 py-2 font-mono text-xs">{r.email ?? '—'}</td>
              <td className="px-3 py-2">{r.fullName ?? '—'}</td>
              <td className="px-3 py-2">
                <span className="bg-bg-muted text-fg rounded px-1.5 py-0.5 text-xs font-semibold">
                  {r.role}
                </span>
              </td>
              <td className="px-3 py-2 text-xs">{r.locale.toUpperCase()}</td>
              <td className="px-3 py-2 text-xs">
                <StatusBadge status={r.status} labels={LABELS[locale] as unknown as LabelsShape} />
              </td>
              <td className="text-fg-muted px-3 py-2 text-xs tabular-nums">
                {r.createdAt.slice(0, 10)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type LabelsShape = (typeof LABELS)['en'];

function StatusBadge({
  status,
  labels,
}: {
  status: 'active' | 'tombstoned' | 'locked_out';
  labels: LabelsShape;
}) {
  if (status === 'active')
    return (
      <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
        {labels.statusActive}
      </span>
    );
  if (status === 'tombstoned')
    return (
      <span className="rounded bg-rose-50 px-1.5 py-0.5 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300">
        {labels.statusTombstoned}
      </span>
    );
  return (
    <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
      {labels.statusLocked}
    </span>
  );
}

function Pagination({
  locale,
  page,
  totalPages,
  onPrev,
  onNext,
}: {
  locale: 'en' | 'ar';
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const T = LABELS[locale];
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-fg-muted">{T.pageOf(page, totalPages)}</span>
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={onPrev} disabled={page <= 1}>
          <ChevronLeft aria-hidden="true" className="h-4 w-4" />
          <span className="ms-1">{T.prev}</span>
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onNext}
          disabled={page >= totalPages}
        >
          <span className="me-1">{T.next}</span>
          <ChevronRight aria-hidden="true" className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function UserDetailPanel({
  locale,
  isLoading,
  data,
  onClose,
}: {
  locale: 'en' | 'ar';
  isLoading: boolean;
  data: {
    profile: Record<string, unknown> | null;
    user: Record<string, unknown> | null;
    childrenCount: number;
    consentsCount: number;
    recentAudit: Array<{
      id: string;
      action: string;
      target_type: string | null;
      target_id: string | null;
      created_at: string;
      metadata: Record<string, unknown>;
    }>;
  } | null;
  onClose: () => void;
}) {
  const T = LABELS[locale];
  return (
    <div
      role="dialog"
      aria-label={T.detailLabel}
      className="border-border bg-bg-elevated space-y-4 rounded-2xl border p-5"
    >
      <header className="flex items-center justify-between">
        <h2 className="text-fg text-lg font-bold">{T.detailLabel}</h2>
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          {T.close}
        </Button>
      </header>
      {isLoading && (
        <div className="text-fg-muted flex items-center gap-2 text-sm">
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          {T.loading}
        </div>
      )}
      {data && (
        <div className="grid gap-4 md:grid-cols-2">
          <section className="space-y-1.5">
            <h3 className="text-fg-subtle text-xs font-semibold uppercase">{T.profileSection}</h3>
            <pre className="bg-bg/60 text-fg overflow-x-auto rounded-lg p-3 text-xs">
              {JSON.stringify({ ...data.profile, ...data.user }, null, 2)}
            </pre>
          </section>
          <section className="space-y-1.5">
            <h3 className="text-fg-subtle text-xs font-semibold uppercase">{T.countsSection}</h3>
            <p className="text-fg text-sm">
              {T.childrenCount}: <strong>{data.childrenCount}</strong>
            </p>
            <p className="text-fg text-sm">
              {T.consentsCount}: <strong>{data.consentsCount}</strong>
            </p>
            <p className="text-fg text-sm">
              {T.auditCount}: <strong>{data.recentAudit.length}</strong>
            </p>
          </section>
          <section className="space-y-1.5 md:col-span-2">
            <h3 className="text-fg-subtle text-xs font-semibold uppercase">{T.recentAudit}</h3>
            <ul className="border-border-muted divide-border-muted divide-y rounded-lg border">
              {data.recentAudit.map((a) => (
                <li key={a.id} className="px-3 py-2 text-xs">
                  <span className="text-fg-muted tabular-nums">
                    {a.created_at.slice(0, 19).replace('T', ' ')}
                  </span>{' '}
                  · <strong>{a.action}</strong>
                  {a.target_type && (
                    <>
                      {' '}
                      · {a.target_type}: <code>{a.target_id?.slice(0, 8)}</code>
                    </>
                  )}
                </li>
              ))}
              {data.recentAudit.length === 0 && (
                <li className="text-fg-subtle px-3 py-2 text-xs italic">{T.noAudit}</li>
              )}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}

const LABELS = {
  en: {
    title: 'Users',
    subtitle: 'Search, filter, and inspect every user in the system. Read-only.',
    kbHint: 'Keyboard: j / k to move, Enter to open detail, Esc to close.',
    searchPlaceholder: 'Search email or name…',
    filterRoleLabel: 'Filter by role',
    filterRoleAll: 'All roles',
    filterStatusLabel: 'Filter by status',
    filterStatusAll: 'All status',
    filterLocaleLabel: 'Filter by locale',
    filterLocaleAll: 'All locales',
    statusActive: 'Active',
    statusTombstoned: 'Tombstoned',
    statusLocked: 'Locked out',
    colEmail: 'Email',
    colName: 'Name',
    colRole: 'Role',
    colLocale: 'Locale',
    colStatus: 'Status',
    colCreated: 'Created',
    loading: 'Loading users…',
    emptyResults: 'No users match the current filters.',
    pageOf: (a: number, b: number) => `Page ${a} of ${b}`,
    prev: 'Previous',
    next: 'Next',
    detailLabel: 'User detail',
    close: 'Close',
    profileSection: 'Profile / Auth',
    countsSection: 'Counts',
    childrenCount: 'Children',
    consentsCount: 'Consent records',
    auditCount: 'Audit events (last 50)',
    recentAudit: 'Recent audit log',
    noAudit: 'No audit events.',
  },
  ar: {
    title: 'المستخدمون',
    subtitle: 'البحث والتصفية وعرض كل مستخدم في النظام. قراءة فقط.',
    kbHint: 'لوحة المفاتيح: j / k للتنقّل، Enter للفتح، Esc للإغلاق.',
    searchPlaceholder: 'ابحث بالبريد أو الاسم…',
    filterRoleLabel: 'تصفية حسب الدور',
    filterRoleAll: 'كل الأدوار',
    filterStatusLabel: 'تصفية حسب الحالة',
    filterStatusAll: 'كل الحالات',
    filterLocaleLabel: 'تصفية حسب اللغة',
    filterLocaleAll: 'كل اللغات',
    statusActive: 'نشط',
    statusTombstoned: 'محذوف',
    statusLocked: 'مقفل',
    colEmail: 'البريد',
    colName: 'الاسم',
    colRole: 'الدور',
    colLocale: 'اللغة',
    colStatus: 'الحالة',
    colCreated: 'تاريخ الإنشاء',
    loading: 'جاري التحميل…',
    emptyResults: 'لا يوجد مستخدمون مطابقون للمرشّحات.',
    pageOf: (a: number, b: number) => `صفحة ${a} من ${b}`,
    prev: 'السابق',
    next: 'التالي',
    detailLabel: 'تفاصيل المستخدم',
    close: 'إغلاق',
    profileSection: 'الملف الشخصي / المصادقة',
    countsSection: 'الإحصاءات',
    childrenCount: 'الأطفال',
    consentsCount: 'سجلات الموافقة',
    auditCount: 'أحداث التدقيق (آخر ٥٠)',
    recentAudit: 'سجل التدقيق الأخير',
    noAudit: 'لا توجد أحداث.',
  },
} as const;
