import type { PuzzleData } from './types.ts';

declare global {
  interface Window {
    PUZZLE_DATA?: PuzzleData;
    _swapIcons?: (colourName: string) => void;
    _currentColour?: string;
    _devFillAnswer?: () => void;
  }
}

export {};
