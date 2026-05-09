import { ImageResponse } from 'next/og';
import { type NextRequest } from 'next/server';

// 1200×630 Open Graph card. Renders the brand mark + page title + tagline on
// a calm canvas with a soft trust-blue accent. Generated at request time;
// Next caches at the edge so CTR-grade SEO doesn't pay a per-share cost.
export const runtime = 'edge';
export const contentType = 'image/png';
export const size = { width: 1200, height: 630 };

const FALLBACK_TITLES = {
  en: 'BlueCare',
  ar: 'بلوكير',
} as const;

const FALLBACK_TAGLINES = {
  en: 'Smart, personalized communication for children with autism.',
  ar: 'تواصل ذكي وشخصي للأطفال ذوي اضطراب طيف التوحد.',
} as const;

export function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const localeParam = searchParams.get('locale') === 'ar' ? 'ar' : 'en';
  const isArabic = localeParam === 'ar';
  const title = searchParams.get('title') ?? FALLBACK_TITLES[localeParam];
  const tagline = searchParams.get('tagline') ?? FALLBACK_TAGLINES[localeParam];

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 80,
        background: 'linear-gradient(135deg, #F9FAFB 0%, #EFF6FF 60%, #DBEAFE 100%)',
        color: '#1E293B',
        fontFamily: 'sans-serif',
        direction: isArabic ? 'rtl' : 'ltr',
      }}
    >
      {/* Top: brand mark + locale flag */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <div
          style={{
            width: 88,
            height: 88,
            borderRadius: 24,
            background: '#2B6CB0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#A7F3D0',
            fontSize: 56,
            fontWeight: 700,
          }}
        >
          ♥
        </div>
        <div
          style={{
            fontSize: 40,
            fontWeight: 700,
            color: '#1E293B',
            letterSpacing: -0.5,
          }}
        >
          {isArabic ? 'بلوكير' : 'BlueCare'}
        </div>
      </div>

      {/* Middle: page title */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
          maxWidth: 1000,
        }}
      >
        <div
          style={{
            fontSize: 84,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: -1.5,
            color: '#0F2E55',
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 32,
            lineHeight: 1.4,
            color: '#374151',
            fontWeight: 500,
          }}
        >
          {tagline}
        </div>
      </div>

      {/* Bottom: locale tag + URL */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          color: '#4B5563',
          fontSize: 22,
        }}
      >
        <span>bluecare.app</span>
        <span
          style={{
            padding: '8px 20px',
            borderRadius: 999,
            background: '#A7F3D0',
            color: '#14532D',
            fontWeight: 600,
          }}
        >
          {isArabic ? 'العربية' : 'English'}
        </span>
      </div>
    </div>,
    { ...size },
  );
}
