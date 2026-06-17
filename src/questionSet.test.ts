import { describe, expect, it } from 'vitest';
import { buildQuestionSet, parseLines } from './questionSet';

// A tiny deterministic RNG (mulberry32) so shuffles are reproducible per seed.
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const EASY = ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8'].join('\n');
const HARD = ['H1', 'H2', 'H3', 'H4'].join('\n');

describe('buildQuestionSet ordering', () => {
  it('always places every hard question after every easy question (no overlap)', () => {
    const hardBank = new Set(parseLines(HARD));
    for (let seed = 0; seed < 500; seed += 1) {
      const set = buildQuestionSet(EASY, HARD, 6, 2, seeded(seed));
      const firstHardIndex = set.findIndex((q) => hardBank.has(q));
      const lastEasyIndex =
        set.length - 1 - [...set].reverse().findIndex((q) => !hardBank.has(q));
      expect(firstHardIndex).toBeGreaterThan(lastEasyIndex);
      expect(set).toHaveLength(8);
    }
  });

  it('treats a question present in BOTH banks as hard and never shows it among the easy ones', () => {
    // H1 is duplicated into the easy bank — the real-world cause of the bug.
    const easyWithDup = ['E1', 'E2', 'H1', 'E3', 'E4', 'E5', 'E6', 'H2'].join('\n');
    const hardBank = new Set(parseLines(HARD));
    for (let seed = 0; seed < 500; seed += 1) {
      const set = buildQuestionSet(easyWithDup, HARD, 6, 2, seeded(seed));
      const firstHardIndex = set.findIndex((q) => hardBank.has(q));
      const lastEasyIndex =
        set.length - 1 - [...set].reverse().findIndex((q) => !hardBank.has(q));
      // No hard-bank question may appear before an easy one.
      expect(firstHardIndex).toBeGreaterThan(lastEasyIndex);
      // The duplicated question must not appear twice.
      expect(set.filter((q) => q === 'H1')).toHaveLength(set.includes('H1') ? 1 : 0);
    }
  });

  it('respects the requested counts and easy-first order', () => {
    const set = buildQuestionSet(EASY, HARD, 6, 2, seeded(42));
    expect(set).toHaveLength(8);
    const hardBank = new Set(parseLines(HARD));
    const easyPart = set.slice(0, 6);
    const hardPart = set.slice(6);
    expect(easyPart.every((q) => !hardBank.has(q))).toBe(true);
    expect(hardPart.every((q) => hardBank.has(q))).toBe(true);
  });
});
