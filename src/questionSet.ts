// Pure, framework-free helpers for building the question set.
// Kept out of App.tsx so the selection/ordering logic can be unit-tested
// in isolation (no React, no DOM, no Math.random in the render path).

export function parseLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && !line.startsWith('//'));
}

export function countLines(text: string): number {
  return parseLines(text).length;
}

/** Stable de-duplication preserving first-seen order. */
function unique(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    if (!seen.has(item)) {
      seen.add(item);
      out.push(item);
    }
  }
  return out;
}

/** Fisher–Yates shuffle. `rng` is injectable so tests can be deterministic. */
export function shuffle<T>(items: T[], rng: () => number = Math.random): T[] {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Build the ordered question set: easy questions first, hard questions last.
 *
 * A question that appears in BOTH banks is treated as HARD (hard takes
 * precedence) and removed from the easy pool. Without this, an overlapping
 * question could be randomly drawn into the easy slice and surface among the
 * easy questions — the intermittent "hard question among the easy ones" bug.
 * Each bank is also de-duplicated internally so nothing repeats in the set.
 */
export function buildQuestionSet(
  easyText: string,
  hardText: string,
  easyCount: number,
  hardCount: number,
  rng: () => number = Math.random,
): string[] {
  const hard = unique(parseLines(hardText));
  const hardSet = new Set(hard);
  const easy = unique(parseLines(easyText)).filter((q) => !hardSet.has(q));

  const selectedEasy = shuffle(easy, rng).slice(0, Math.max(0, easyCount));
  const selectedHard = shuffle(hard, rng).slice(0, Math.max(0, hardCount));

  return [...selectedEasy, ...selectedHard];
}
