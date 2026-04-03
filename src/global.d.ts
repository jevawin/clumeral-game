interface PuzzleData {
  date?: string;
  puzzleNumber?: number;
  answer: number;
  clues: Array<{
    propKey: string;
    label: string;
    operator: string;
    value: number | boolean;
  }>;
  isRandom?: boolean;
}

declare global {
  interface Window {
    PUZZLE_DATA?: PuzzleData;
    _swapIcons?: (colourName: string) => void;
    _currentColour?: string;
    _devFillAnswer?: () => void;
  }
}

export {};
