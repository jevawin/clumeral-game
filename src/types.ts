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
  tries?: number;
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
  // from all daily stats (see computeStats in completion.ts).
  archived?: boolean;
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
}
