import { useTranslations } from 'next-intl';

/**
 * The first focusable element on every page. Visually hidden until focused,
 * then it slides in to give keyboard users a quick path to the main region.
 * Required for WCAG 2.4.1 (Bypass Blocks).
 */
export function SkipLink() {
  const t = useTranslations('common');
  return (
    <a href="#main" className="skip-link">
      {t('skipToMain')}
    </a>
  );
}
