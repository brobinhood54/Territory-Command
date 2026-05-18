function normalize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[] = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      dp[j] =
        a[i - 1] === b[j - 1]
          ? prev
          : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = temp;
    }
  }
  return dp[n];
}

// Returns the first candidate whose normalized form fuzzy-matches target.
// Uses substring containment OR Levenshtein distance < 3.
export function fuzzyMatchName(target: string, candidates: string[]): string | null {
  const t = normalize(target);
  if (!t) return null;
  for (const c of candidates) {
    const n = normalize(c);
    if (!n) continue;
    if (n.includes(t) || t.includes(n)) return c;
    if (levenshtein(t, n) < 3) return c;
  }
  return null;
}

// Tokenize a string into lowercase words.
function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

// Jaccard similarity between two token sets.
function jaccardSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// Returns the first candidate whose token-overlap similarity to target meets threshold.
// Used for question text deduplication during re-parse.
export function fuzzyMatchText(
  target: string,
  candidates: string[],
  threshold = 0.6
): string | null {
  const targetTokens = tokenize(target);
  if (targetTokens.length === 0) return null;
  for (const c of candidates) {
    const sim = jaccardSimilarity(targetTokens, tokenize(c));
    if (sim >= threshold) return c;
  }
  return null;
}
