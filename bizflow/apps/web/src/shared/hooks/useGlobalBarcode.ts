import { useEffect, useRef } from 'react';

interface UseGlobalBarcodeProps {
  onScan: (barcode: string) => void;
  minChars?: number;
  maxDelay?: number;
}

export function useGlobalBarcode({ onScan, minChars = 3, maxDelay = 30 }: UseGlobalBarcodeProps) {
  const buffer = useRef('');
  const lastKeyTime = useRef<number>(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input field or textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      const currentTime = performance.now();
      const timeDiff = currentTime - lastKeyTime.current;

      if (e.key === 'Enter') {
        if (buffer.current.length >= minChars) {
          // A complete barcode was scanned
          onScan(buffer.current);
          e.preventDefault();
        }
        buffer.current = '';
        return;
      }

      // If the time between keypresses is too long, it's a human typing, reset the buffer
      if (timeDiff > maxDelay) {
        buffer.current = '';
      }

      // Ignore modifier keys
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        buffer.current += e.key;
      }
      
      lastKeyTime.current = currentTime;
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onScan, minChars, maxDelay]);
}
