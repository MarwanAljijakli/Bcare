'use client';
/**
 * <ProgressReportPdf> — Module 6.1 item 3.
 *
 * Renders a bilingual progress report as a @react-pdf/renderer
 * document. Layout:
 *   • Header band with brand wordmark + child name + window.
 *   • Summary metrics (sessions, inputs, successful selections,
 *     average session duration).
 *   • Vocabulary growth chart (per-day active_vocabulary_size, drawn
 *     as a horizontal column chart — pure rectangles, no SVG).
 *   • Session frequency mini-chart.
 *   • Multimodal breakdown (4-row table with pct bars).
 *   • Top symbols list (label + count).
 *   • Therapist notes section (one paragraph per noted session).
 *
 * RTL: when locale === 'ar' the document body sets `direction: 'rtl'`,
 * the alignment flips, and labels swap. The fallback font registered
 * below supports both Latin + Arabic glyphs from a single source —
 * Cairo from Google Fonts CDN.
 *
 * Why an ALL-Cairo font (not Inter + Cairo): @react-pdf/renderer has
 * weak fallback support; registering two families and toggling per-run
 * is brittle. Cairo is a beautiful, readable, professional sans that
 * works well for both English and Arabic at the body sizes we use.
 */
import { Document, Font, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { ProgressReportPayload } from '@/server/trpc/routers/reports';

// Cairo TTF mirrors. @react-pdf/renderer needs raw .ttf URLs.
// jsdelivr serves @fontsource/cairo's TTF assets reliably from CDN.
Font.register({
  family: 'Cairo',
  fonts: [
    {
      src: 'https://cdn.jsdelivr.net/npm/@fontsource/cairo@5.0.13/files/cairo-arabic-400-normal.ttf',
      fontWeight: 400,
    },
    {
      src: 'https://cdn.jsdelivr.net/npm/@fontsource/cairo@5.0.13/files/cairo-arabic-700-normal.ttf',
      fontWeight: 700,
    },
  ],
});

const COLOR = {
  ink: '#0F172A',
  inkSoft: '#475569',
  inkSubtle: '#94A3B8',
  brand: '#1E40AF',
  brandSoft: '#DBEAFE',
  bar: '#3B82F6',
  rule: '#E2E8F0',
  bg: '#FFFFFF',
};

const styles = StyleSheet.create({
  page: {
    padding: 32,
    backgroundColor: COLOR.bg,
    fontFamily: 'Cairo',
    fontSize: 10,
    color: COLOR.ink,
    lineHeight: 1.4,
  },
  pageRtl: {
    direction: 'rtl',
    textAlign: 'right',
  },
  headerBand: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.rule,
    borderBottomStyle: 'solid',
  },
  brand: { fontSize: 14, fontWeight: 700, color: COLOR.brand },
  brandSub: { fontSize: 9, color: COLOR.inkSubtle, marginTop: 2 },
  childName: { fontSize: 22, fontWeight: 700, marginTop: 6 },
  windowLine: { fontSize: 10, color: COLOR.inkSoft, marginTop: 2 },

  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    marginTop: 16,
    marginBottom: 6,
    color: COLOR.ink,
  },

  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 6,
  },
  metricCard: {
    width: '23%',
    marginRight: '2%',
    marginBottom: 6,
    padding: 8,
    backgroundColor: COLOR.brandSoft,
    borderRadius: 6,
  },
  metricLabel: { fontSize: 7, color: COLOR.inkSoft, textTransform: 'uppercase' },
  metricValue: { fontSize: 16, fontWeight: 700, marginTop: 2 },

  chartRow: { flexDirection: 'row', alignItems: 'flex-end', height: 90, marginTop: 4 },
  chartBar: {
    flex: 1,
    marginHorizontal: 0.5,
    backgroundColor: COLOR.bar,
    minHeight: 1,
  },
  axisRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  axisLabel: { fontSize: 7, color: COLOR.inkSubtle },

  modalityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  modalityLabel: { width: 90, fontSize: 9, color: COLOR.inkSoft },
  modalityTrack: {
    flex: 1,
    height: 8,
    backgroundColor: COLOR.rule,
    borderRadius: 4,
    overflow: 'hidden',
  },
  modalityFill: { height: 8, backgroundColor: COLOR.bar },
  modalityValue: { width: 40, fontSize: 9, textAlign: 'right', marginLeft: 8 },

  symbolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.rule,
    borderBottomStyle: 'solid',
  },
  symbolRank: { width: 16, fontSize: 9, color: COLOR.inkSubtle },
  symbolLabel: { flex: 1, fontSize: 10 },
  symbolCount: { fontSize: 9, color: COLOR.inkSoft, width: 30, textAlign: 'right' },

  noteCard: {
    marginTop: 6,
    padding: 8,
    backgroundColor: '#F8FAFC',
    borderLeftWidth: 3,
    borderLeftColor: COLOR.brand,
    borderLeftStyle: 'solid',
  },
  noteDate: { fontSize: 8, color: COLOR.inkSubtle, marginBottom: 2 },
  noteBody: { fontSize: 9, color: COLOR.ink },

  footer: {
    position: 'absolute',
    bottom: 18,
    left: 32,
    right: 32,
    fontSize: 7,
    color: COLOR.inkSubtle,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: COLOR.rule,
    borderTopStyle: 'solid',
    paddingTop: 6,
  },
});

interface Labels {
  brand: string;
  brandSub: string;
  reportFor: string;
  window: (n: number) => string;
  metricSessions: string;
  metricInputs: string;
  metricSuccessful: string;
  metricAvgDuration: string;
  vocabHeading: string;
  vocabHint: string;
  freqHeading: string;
  freqHint: string;
  modalityHeading: string;
  topSymbolsHeading: string;
  noTopSymbols: string;
  notesHeading: string;
  noNotes: string;
  footerBrand: string;
  footerPage: (cur: number, total: number) => string;
}

const LABELS: Record<'en' | 'ar', Labels> = {
  en: {
    brand: 'BlueCare',
    brandSub: 'Progress report',
    reportFor: 'Report for',
    window: (n) => `Last ${n} days`,
    metricSessions: 'Sessions',
    metricInputs: 'Inputs',
    metricSuccessful: 'Successful',
    metricAvgDuration: 'Avg session',
    vocabHeading: 'Vocabulary growth',
    vocabHint: 'Daily active vocabulary size',
    freqHeading: 'Session frequency',
    freqHint: 'Sessions per day',
    modalityHeading: 'Multimodal breakdown',
    topSymbolsHeading: 'Top symbols',
    noTopSymbols: 'No symbol activity in this window.',
    notesHeading: 'Therapist notes',
    noNotes: 'No therapist notes in this window.',
    footerBrand: 'Generated by BlueCare',
    footerPage: (cur, total) => `Page ${cur} of ${total}`,
  },
  ar: {
    brand: 'BlueCare',
    brandSub: 'تقرير التقدّم',
    reportFor: 'تقرير لـ',
    window: (n) => `آخر ${n} يومًا`,
    metricSessions: 'الجلسات',
    metricInputs: 'الإدخالات',
    metricSuccessful: 'ناجحة',
    metricAvgDuration: 'متوسّط الجلسة',
    vocabHeading: 'نمو المفردات',
    vocabHint: 'حجم المفردات النشطة يوميًا',
    freqHeading: 'تكرار الجلسات',
    freqHint: 'جلسات في اليوم',
    modalityHeading: 'تحليل الوسائط',
    topSymbolsHeading: 'الرموز الأكثر استخدامًا',
    noTopSymbols: 'لا يوجد نشاط في هذه الفترة.',
    notesHeading: 'ملاحظات المعالج',
    noNotes: 'لا توجد ملاحظات في هذه الفترة.',
    footerBrand: 'تم إنشاؤه بواسطة BlueCare',
    footerPage: (cur, total) => `صفحة ${cur} من ${total}`,
  },
};

const MODALITY_KEYS: Array<keyof ProgressReportPayload['multimodalBreakdown']> = [
  'symbol',
  'speech',
  'gesture',
  'keyboard',
];

const MODALITY_LABELS: Record<'en' | 'ar', Record<string, string>> = {
  en: { symbol: 'Symbol tap', speech: 'Speech', gesture: 'Gesture', keyboard: 'Keyboard' },
  ar: { symbol: 'لمس الرمز', speech: 'الكلام', gesture: 'الإيماءات', keyboard: 'لوحة المفاتيح' },
};

function fmtDuration(sec: number, locale: 'en' | 'ar'): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (locale === 'ar') return m > 0 ? `${m}د ${s}ث` : `${s}ث`;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function ProgressReportPdf({
  payload,
  locale,
  caregiverEmail,
}: {
  payload: ProgressReportPayload;
  locale: 'en' | 'ar';
  caregiverEmail?: string | null;
}) {
  const T = LABELS[locale];
  const isRtl = locale === 'ar';
  const pageStyle = isRtl ? [styles.page, styles.pageRtl] : styles.page;

  const maxVocab = Math.max(1, ...payload.vocabSparkline.map((p) => p.size));
  const maxFreq = Math.max(1, ...payload.sessionFrequency.map((p) => p.count));
  const modalityTotal =
    payload.multimodalBreakdown.symbol +
    payload.multimodalBreakdown.speech +
    payload.multimodalBreakdown.gesture +
    payload.multimodalBreakdown.keyboard;

  return (
    <Document>
      <Page size="A4" style={pageStyle}>
        {/* Header band */}
        <View style={styles.headerBand}>
          <View>
            <Text style={styles.brand}>{T.brand}</Text>
            <Text style={styles.brandSub}>{T.brandSub}</Text>
          </View>
          <View style={isRtl ? { alignItems: 'flex-start' } : { alignItems: 'flex-end' }}>
            <Text style={styles.windowLine}>
              {payload.windowStart} → {payload.windowEnd}
            </Text>
            <Text style={styles.windowLine}>{T.window(payload.window)}</Text>
          </View>
        </View>

        <Text style={styles.childName}>
          {T.reportFor} {payload.child.name}
        </Text>
        {caregiverEmail && <Text style={styles.brandSub}>{caregiverEmail}</Text>}

        {/* Summary metrics */}
        <View style={styles.metricGrid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>{T.metricSessions}</Text>
            <Text style={styles.metricValue}>{payload.totals.sessions}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>{T.metricInputs}</Text>
            <Text style={styles.metricValue}>{payload.totals.inputs}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>{T.metricSuccessful}</Text>
            <Text style={styles.metricValue}>{payload.totals.successfulSelections}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>{T.metricAvgDuration}</Text>
            <Text style={styles.metricValue}>
              {fmtDuration(payload.totals.avgSessionDurationSeconds, locale)}
            </Text>
          </View>
        </View>

        {/* Vocabulary growth */}
        <Text style={styles.sectionTitle}>{T.vocabHeading}</Text>
        <Text style={styles.brandSub}>{T.vocabHint}</Text>
        <View style={styles.chartRow}>
          {payload.vocabSparkline.map((p, i) => (
            <View key={i} style={[styles.chartBar, { height: `${(p.size / maxVocab) * 100}%` }]} />
          ))}
        </View>
        <View style={styles.axisRow}>
          <Text style={styles.axisLabel}>{payload.vocabSparkline[0]?.day ?? ''}</Text>
          <Text style={styles.axisLabel}>
            {payload.vocabSparkline[payload.vocabSparkline.length - 1]?.day ?? ''}
          </Text>
        </View>

        {/* Session frequency */}
        <Text style={styles.sectionTitle}>{T.freqHeading}</Text>
        <Text style={styles.brandSub}>{T.freqHint}</Text>
        <View style={styles.chartRow}>
          {payload.sessionFrequency.map((p, i) => (
            <View key={i} style={[styles.chartBar, { height: `${(p.count / maxFreq) * 100}%` }]} />
          ))}
        </View>

        {/* Multimodal breakdown */}
        <Text style={styles.sectionTitle}>{T.modalityHeading}</Text>
        {MODALITY_KEYS.map((key) => {
          const val = payload.multimodalBreakdown[key];
          const pct = modalityTotal > 0 ? (val / modalityTotal) * 100 : 0;
          return (
            <View key={key} style={styles.modalityRow}>
              <Text style={styles.modalityLabel}>{MODALITY_LABELS[locale][key]}</Text>
              <View style={styles.modalityTrack}>
                <View style={[styles.modalityFill, { width: `${pct}%` }]} />
              </View>
              <Text style={styles.modalityValue}>
                {val} ({pct.toFixed(0)}%)
              </Text>
            </View>
          );
        })}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>{T.footerBrand}</Text>
          <Text render={({ pageNumber, totalPages }) => T.footerPage(pageNumber, totalPages)} />
        </View>
      </Page>

      <Page size="A4" style={pageStyle}>
        <View style={styles.headerBand}>
          <View>
            <Text style={styles.brand}>{T.brand}</Text>
            <Text style={styles.brandSub}>
              {T.reportFor} {payload.child.name}
            </Text>
          </View>
          <Text style={styles.windowLine}>{T.window(payload.window)}</Text>
        </View>

        {/* Top symbols */}
        <Text style={styles.sectionTitle}>{T.topSymbolsHeading}</Text>
        {payload.topSymbols.length === 0 ? (
          <Text style={styles.brandSub}>{T.noTopSymbols}</Text>
        ) : (
          payload.topSymbols.map((s, idx) => (
            <View key={s.symbolId} style={styles.symbolRow}>
              <Text style={styles.symbolRank}>{idx + 1}.</Text>
              <Text style={styles.symbolLabel}>{locale === 'ar' ? s.label_ar : s.label_en}</Text>
              <Text style={styles.symbolCount}>{s.count}</Text>
            </View>
          ))
        )}

        {/* Therapist notes */}
        <Text style={styles.sectionTitle}>{T.notesHeading}</Text>
        {payload.therapistNotes.length === 0 ? (
          <Text style={styles.brandSub}>{T.noNotes}</Text>
        ) : (
          payload.therapistNotes.map((n) => (
            <View key={n.sessionId} style={styles.noteCard}>
              <Text style={styles.noteDate}>{n.date.slice(0, 10)}</Text>
              <Text style={styles.noteBody}>{n.notes}</Text>
            </View>
          ))
        )}

        <View style={styles.footer} fixed>
          <Text>{T.footerBrand}</Text>
          <Text render={({ pageNumber, totalPages }) => T.footerPage(pageNumber, totalPages)} />
        </View>
      </Page>
    </Document>
  );
}

// Re-export so the route page can import side-by-side.
export type { ProgressReportPayload };
