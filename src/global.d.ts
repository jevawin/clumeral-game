declare global {
  interface Window {
    _swapIcons?: (colourName: string) => void;
    _currentColour?: string;
    _devFillAnswer?: () => void;
  }
}

export {};
