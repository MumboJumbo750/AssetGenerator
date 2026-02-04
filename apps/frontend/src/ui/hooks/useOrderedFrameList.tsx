import { useCallback, useState } from "react";

export function useOrderedFrameList() {
  const [frames, setFrames] = useState<string[]>([]);

  const addFrame = useCallback((frameId: string) => {
    setFrames((items) => (items.includes(frameId) ? items : [...items, frameId]));
  }, []);

  const clearFrames = useCallback(() => {
    setFrames([]);
  }, []);

  const moveFrame = useCallback((index: number, dir: -1 | 1) => {
    setFrames((items) => {
      const next = [...items];
      const swap = index + dir;
      if (swap < 0 || swap >= next.length) return next;
      [next[index], next[swap]] = [next[swap], next[index]];
      return next;
    });
  }, []);

  const removeFrame = useCallback((index: number) => {
    setFrames((items) => items.filter((_, idx) => idx !== index));
  }, []);

  return {
    frames,
    setFrames,
    addFrame,
    clearFrames,
    moveFrame,
    removeFrame
  };
}
