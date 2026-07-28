const FILLER_WORDS = [
  'please',
  'can you',
  'could you',
  'would you',
  'jarvis',
  'hey',
  'hi',
  'just',
  'kindly',
  'i want to',
  'i want you to',
  'i need to',
];

/** Normalize raw input: lowercase, trim, strip filler/politeness words */
export function normalize(input: string): string {
  let text = input.toLowerCase().trim();
  text = text.replace(/[.,!?;:]+$/g, '');
  for (const filler of FILLER_WORDS) {
    text = text.replace(new RegExp(`\\b${filler}\\b`, 'g'), '');
  }
  return text.replace(/\s+/g, ' ').trim();
}

/** Levenshtein distance for fuzzy fallback suggestions */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

/** Return the closest known phrase to `input` from `candidates`, or null if too far */
export function closestMatch(input: string, candidates: string[], maxDistance = 4): string | null {
  let best: string | null = null;
  let bestDist = Infinity;
  for (const candidate of candidates) {
    const dist = levenshtein(input, candidate);
    if (dist < bestDist) {
      bestDist = dist;
      best = candidate;
    }
  }
  return bestDist <= maxDistance ? best : null;
}

export function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function formatTime(date = new Date()): string {
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(date = new Date()): string {
  return date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}
