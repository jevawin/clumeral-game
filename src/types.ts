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
}

export interface Prefs {
  saveScore: boolean;
}
