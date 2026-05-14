/**
 * Regression guard for onboarding wizard i18n keys.
 *
 * Phase 11.B Bug 1 root cause: JSON keys with dots in them
 * (`"1.25"`, `"1.5"` for fontScale) made `t('fontScale.options.1.25')`
 * fail silently and leak the raw `marketing.auth.onboardingWizard.*`
 * key into the rendered page.
 *
 * Strategy: walk the message bundle's onboardingWizard subtree and
 * assert no leaf-level key segment contains a `.` (which next-intl
 * uses as a path separator). Plus: assert every t() call surface
 * used by step components has a matching path in the bundle.
 *
 * If you add a new translation key, this test does not need updates;
 * it dynamically scans the JSON. It only fails when the JSON itself
 * grows a dotted segment again.
 */
import { describe, expect, it } from 'vitest';
import arMessages from '../../../messages/ar.json';
import enMessages from '../../../messages/en.json';

type AnyDict = Record<string, unknown>;

function walk(
  node: unknown,
  prefix: string[],
  visit: (path: string[], value: string) => void,
): void {
  if (typeof node === 'string') {
    visit(prefix, node);
    return;
  }
  if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node as AnyDict)) {
      walk(value, [...prefix, key], visit);
    }
  }
}

function getOnboardingTree(bundle: AnyDict): AnyDict {
  const marketing = bundle.marketing as AnyDict | undefined;
  const auth = marketing?.auth as AnyDict | undefined;
  const wiz = auth?.onboardingWizard as AnyDict | undefined;
  if (!wiz) throw new Error('marketing.auth.onboardingWizard not found in bundle');
  return wiz;
}

describe('onboarding i18n bundle structure', () => {
  for (const [name, bundle] of [
    ['en', enMessages as AnyDict],
    ['ar', arMessages as AnyDict],
  ] as const) {
    describe(`${name}.json`, () => {
      it('has no dotted key segments under marketing.auth.onboardingWizard', () => {
        const tree = getOnboardingTree(bundle);
        const offenders: string[] = [];
        walk(tree, [], (path) => {
          for (const segment of path) {
            if (segment.includes('.')) {
              offenders.push(path.join(' > ') + ` (segment "${segment}")`);
              break;
            }
          }
        });
        // No keys may include `.` — next-intl splits on it.
        expect(
          offenders,
          `dotted i18n keys found in ${name}.json (next-intl will fail to resolve them):\n  ${offenders.join('\n  ')}`,
        ).toEqual([]);
      });

      it('every leaf value is a non-empty string', () => {
        const tree = getOnboardingTree(bundle);
        const empties: string[] = [];
        walk(tree, [], (path, value) => {
          if (typeof value !== 'string' || value.length === 0) {
            empties.push(path.join('.'));
          }
        });
        expect(empties, `empty leaf values in ${name}.json onboardingWizard subtree`).toEqual([]);
      });

      it('has fontScale options keyed x100, x125, x150 (Bug 1 regression)', () => {
        const tree = getOnboardingTree(bundle);
        const sensory = tree.sensory as AnyDict | undefined;
        const fontScale = sensory?.fontScale as AnyDict | undefined;
        const options = fontScale?.options as AnyDict | undefined;
        expect(options, `${name}.json missing sensory.fontScale.options`).toBeDefined();
        expect(Object.keys(options ?? {}).sort()).toEqual(['x100', 'x125', 'x150']);
      });

      it('has voice options keyed charlotte + sarah (Bug 2 regression)', () => {
        const tree = getOnboardingTree(bundle);
        const voice = tree.voice as AnyDict | undefined;
        const voices = voice?.voices as AnyDict | undefined;
        expect(voices, `${name}.json missing voice.voices`).toBeDefined();
        const keys = Object.keys(voices ?? {}).sort();
        expect(keys).toEqual(['charlotte', 'sarah']);
      });
    });
  }
});
