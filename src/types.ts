export interface ClueData {
  propKey: string;
  label: string;
  operator: string;
  value: number | boolean;
}

export interface GameState {
  answer: number | null;
  guesses: number[];
  solved: boolean;
  /** null means "played, not recorded" — a day-only marker. undefined means the
   *  puzzle is not solved. The two are different and the solved view reads both. */
  tries?: number | null;
  /** Counted play seconds for the solved game, so the /play solved view can show
   *  the same "Solved in 2 goes, 1m 05s" line the completion panel does. */
  seconds?: number;
  puzzleNum?: number;
  isRandom?: boolean;
  date?: string;
  token?: string;
}

export interface HistoryEntry {
  date: string;
  tries: number;
  answer?: number;
  // Tags an archived solve (a puzzle whose date != today). Backward compatible:
  // absence means a live daily solve. Archived entries are recorded but excluded
  // from all daily stats (see computePlayerStats in player-stats.ts).
  archived?: boolean;
  /** Counted play seconds, 0–86400. Absent = unknown: pre-launch rows, opted-out
   *  players, and rows whose stored value failed validation. Never read as 0.
   *  A valid value above OUTLIER_SECONDS still shows on its own panel but is
   *  excluded from the average and from fastest (brief 31, 134). */
  seconds?: number;
  /** Day-only marker (brief 71): the player finished this day with saving off.
   *  tries is 0 and means nothing. Filtered out of every figure before counting. */
  marker?: true;
}

export interface Prefs {
  saveScore: boolean;
}

export interface ActiveState {
  v: 1;                       // schema version — loadActive discards on mismatch (never bump without incrementing)
  date: string;               // local YYYY-MM-DD — loadActive discards when !== todayKey() (D-07 day-rollover discard)
  possibles: number[][];      // per-box remaining digits (Set<number> serialized as arrays)
  guesses: number[];          // wrong guesses submitted this session
  activeBox: number | null;   // 0 | 1 | 2 | null
  feedbackKey: string | null; // "incorrect" | "error" | null  (never "correct" — solve clears active state)
  /** Counted seconds so far. Absent on any board written before this shipped. */
  elapsed?: number;
  /** How many times the idle cut-off has fired this game. Absent = 0. */
  idles?: number;
}
