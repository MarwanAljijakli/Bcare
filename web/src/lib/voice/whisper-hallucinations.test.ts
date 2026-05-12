import { describe, it, expect } from 'vitest';
import {
  detectHallucination,
  KNOWN_HALLUCINATION_PATTERNS,
  levenshtein,
  normalizeForMatch,
} from './whisper-hallucinations';

describe('detectHallucination — Phase 9.B', () => {
  describe('the 6 documented Whisper hallucination patterns', () => {
    const patterns: Array<{ name: string; text: string }> = [
      { name: 'AR YouTube — subscribe to the channel', text: 'اشتركوا في القناة' },
      { name: 'AR YouTube — thanks for watching', text: 'شكراً لكم على المشاهدة' },
      { name: 'AR YouTube — subtitle of the film', text: 'ترجمة الفيلم' },
      { name: 'AR YouTube — see you next video', text: 'نراكم في الفيديو القادم' },
      { name: 'EN YouTube — thank you for watching', text: 'Thank you for watching' },
      { name: 'EN YouTube — subscribe', text: 'Subscribe' },
    ];

    for (const p of patterns) {
      it(`matches "${p.name}" as a known hallucination`, () => {
        const out = detectHallucination(p.text);
        expect(out.hallucination).toBe(true);
        expect(out.reason).toBe('matched_known_pattern');
      });
    }
  });

  describe('near-match heuristic (Levenshtein < 3)', () => {
    it('matches a transcript with diacritics added on top of a canonical AR pattern', () => {
      const out = detectHallucination('اشترَكوا في القنَاة');
      expect(out.hallucination).toBe(true);
      expect(out.matched_pattern).toBe('اشتركوا في القناة');
    });

    it('matches a transcript with trailing punctuation', () => {
      const out = detectHallucination('Subscribe!!!');
      expect(out.hallucination).toBe(true);
    });

    it('matches a transcript with 1-char typo', () => {
      // "thanks for watcing" — missing 'h'. Levenshtein distance 1 vs canonical.
      const out = detectHallucination('thanks for watcing');
      expect(out.hallucination).toBe(true);
    });

    it('matches the singular AR variant of subscribe', () => {
      const out = detectHallucination('اشترك في القناة');
      expect(out.hallucination).toBe(true);
    });
  });

  describe('does NOT flag legitimate child speech', () => {
    const legitimate = [
      'أريد أن آكل التفاح من فضلك',
      'أمي، أنا جوعان',
      'I want water please',
      'Mom, can I have an apple?',
      'هل نقدر نروح للحديقة بعد الغداء؟',
      'help me',
      'more please',
      'نعم',
      'لا',
    ];
    for (const text of legitimate) {
      it(`accepts "${text}" as legitimate`, () => {
        const out = detectHallucination(text);
        expect(out.hallucination).toBe(false);
        expect(out.reason).toBe('none');
      });
    }
  });

  describe('does NOT false-positive on a long sentence that quotes a hallucination phrase', () => {
    it('a long legitimate sentence with "subscribe" in it is NOT flagged', () => {
      const out = detectHallucination(
        'yesterday I watched a video and at the end the person said please subscribe and like the video then I went to dinner',
      );
      expect(out.hallucination).toBe(false);
    });

    it('a long AR sentence quoting the subscribe phrase is NOT flagged', () => {
      const out = detectHallucination(
        'شاهدت أمس فيديو ممتع وفي النهاية قال المذيع اشتركوا في القناة ثم انتقلت إلى مقطع آخر يتحدث عن الطبيعة',
      );
      expect(out.hallucination).toBe(false);
    });
  });

  it('empty transcript is not a hallucination', () => {
    expect(detectHallucination('').hallucination).toBe(false);
    expect(detectHallucination('   ').hallucination).toBe(false);
  });

  it('the patterns list contains at least one AR + EN entry per documented category', () => {
    const joined = KNOWN_HALLUCINATION_PATTERNS.join('|');
    expect(joined).toContain('اشتركوا'); // AR subscribe
    expect(joined).toContain('شكرا'); // AR thanks
    expect(joined).toContain('ترجمة'); // AR subtitle
    expect(joined).toContain('Subscribe'.toLowerCase()); // EN subscribe (lower-cased in list)
    expect(joined).toContain('thank you'); // EN thanks
  });
});

describe('normalizeForMatch', () => {
  it('strips Arabic diacritics', () => {
    expect(normalizeForMatch('اشتَركوا')).toBe('اشتركوا');
  });
  it('collapses alif variants', () => {
    expect(normalizeForMatch('أمي')).toBe('امي');
    expect(normalizeForMatch('إمي')).toBe('امي');
  });
  it('collapses alif-maksura to ya', () => {
    expect(normalizeForMatch('على')).toBe('علي');
  });
  it('lower-cases English', () => {
    expect(normalizeForMatch('Subscribe')).toBe('subscribe');
  });
  it('collapses whitespace', () => {
    expect(normalizeForMatch('  hello   world  ')).toBe('hello world');
  });
});

describe('levenshtein', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshtein('hello', 'hello')).toBe(0);
  });
  it('returns the empty-string length when one side is empty', () => {
    expect(levenshtein('', 'abc')).toBe(3);
    expect(levenshtein('abc', '')).toBe(3);
  });
  it('returns 1 for a single substitution', () => {
    expect(levenshtein('kitten', 'sitten')).toBe(1);
  });
  it('classic kitten → sitting is 3', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
  });
});
