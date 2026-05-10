declare global {
  interface Window {
    _devFillAnswer?: () => void;
    _refreshAccent?: () => void;
    _currentColour?: string;
  }
}

export {};
