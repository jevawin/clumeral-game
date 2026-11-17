declare global {
  interface Window {
    _devFillAnswer?: () => void;
    _devSolve?: () => void;
    _devWrongGuess?: () => void;
    _refreshAccent?: () => void;
    _currentColour?: string;
  }
}

export {};
