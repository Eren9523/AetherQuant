import { useState, useEffect } from 'react';

interface UseCountUpOptions {
  end: number;
  duration?: number; // ms
  start?: number;
  enabled?: boolean;
}

export function useCountUp({ end, duration = 1500, start = 1, enabled = true }: UseCountUpOptions): number {
  const [count, setCount] = useState<number>(start);

  useEffect(() => {
    if (!enabled) {
      setCount(end);
      return;
    }

    let startTime: number | null = null;
    let animationFrameId: number;

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      // Ease out quad
      const easedProgress = 1 - (1 - progress) * (1 - progress);
      const current = Math.floor(start + (end - start) * easedProgress);
      
      setCount(current);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step);
      }
    };

    animationFrameId = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [end, duration, start, enabled]);

  return count;
}
