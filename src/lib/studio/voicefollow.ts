export interface Token {
  word: string;        // normalized (lowercase, alpha-num only)
  beatIndex: number;
  globalIndex: number;
}

export interface FollowState {
  tokenIndex: number;  // count of script words considered "spoken" so far
  beatIndex: number;   // active beat
}

interface BeatLike {
  say: string;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function flattenScript(beats: BeatLike[]): Token[] {
  const tokens: Token[] = [];
  beats.forEach((b, beatIndex) => {
    for (const raw of b.say.split(/\s+/)) {
      const word = normalize(raw);
      if (!word) continue;
      tokens.push({ word, beatIndex, globalIndex: tokens.length });
    }
  });
  return tokens;
}

/** Sørensen–Dice coefficient over character bigrams. */
function dice(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const bigrams = (s: string) => {
    const m = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.slice(i, i + 2);
      m.set(g, (m.get(g) ?? 0) + 1);
    }
    return m;
  };
  const A = bigrams(a);
  const B = bigrams(b);
  let overlap = 0;
  for (const [g, countA] of A) {
    const countB = B.get(g) ?? 0;
    overlap += Math.min(countA, countB);
  }
  return (2 * overlap) / (a.length - 1 + (b.length - 1));
}

const THRESHOLD = 0.6;       // fuzzy-match acceptance
const LOOK_AHEAD = 6;        // how far forward we search for the next spoken word
const RESYNC_HORIZON = 40;   // how far ahead a 2-word resync may jump

export interface Follower {
  push(recognized: string[]): FollowState;
  state(): FollowState;
  /** Re-anchor to a beat (manual prev/next while voice-follow is on). */
  seek(beatIndex: number): void;
}

/** Advance-only matcher: walks `tokens` forward as recognized words arrive. */
export function createFollower(tokens: Token[]): Follower {
  let tokenIndex = 0;
  // After a manual seek, report this beat until matching makes real progress
  // (tokenIndex alone can't represent "at the start of beat N, nothing spoken").
  let seekedBeat: number | null = null;
  // Last word that failed to match — two consecutive misses that DO match two
  // consecutive script tokens further ahead mean the pointer fell behind
  // (whisper mangled a phrase / speaker skipped); jump to recover.
  let prevMiss: string | null = null;

  function matchOne(word: string): boolean {
    const end = Math.min(tokenIndex + LOOK_AHEAD, tokens.length);
    for (let i = tokenIndex; i < end; i++) {
      if (dice(tokens[i].word, word) >= THRESHOLD) {
        tokenIndex = i + 1;     // advance-only: jump past the matched token
        return true;
      }
    }
    return false; // no match in the window → hold (ad-lib / off-script)
  }

  function tryResync(word: string): boolean {
    if (prevMiss === null) return false;
    const end = Math.min(tokenIndex + RESYNC_HORIZON, tokens.length - 1);
    for (let i = tokenIndex; i < end; i++) {
      if (dice(tokens[i].word, prevMiss) >= THRESHOLD && dice(tokens[i + 1].word, word) >= THRESHOLD) {
        tokenIndex = i + 2;
        return true;
      }
    }
    return false;
  }

  function currentBeat(): number {
    if (seekedBeat !== null) return seekedBeat;
    if (tokens.length === 0) return 0;
    if (tokenIndex >= tokens.length) return tokens[tokens.length - 1].beatIndex;
    return tokens[Math.max(0, tokenIndex - 1)]?.beatIndex ?? 0;
  }

  return {
    push(recognized) {
      for (const raw of recognized) {
        const w = normalize(raw);
        if (!w) continue;
        if (matchOne(w) || tryResync(w)) {
          prevMiss = null;
          seekedBeat = null;
        } else {
          prevMiss = w;
        }
      }
      return { tokenIndex, beatIndex: currentBeat() };
    },
    state() {
      return { tokenIndex, beatIndex: currentBeat() };
    },
    seek(beatIndex) {
      const first = tokens.findIndex((t) => t.beatIndex === beatIndex);
      tokenIndex = first >= 0 ? first : tokens.length;
      seekedBeat = beatIndex;
      prevMiss = null;
    },
  };
}
