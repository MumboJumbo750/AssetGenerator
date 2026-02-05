import { useCallback } from "react";

import type { AtlasRecord } from "../api";

export function useAtlasPivotEditor(opts: {
  setSelectedAtlas: React.Dispatch<React.SetStateAction<AtlasRecord | null>>;
}) {
  const updatePivot = useCallback(
    (frameId: string, axis: "x" | "y", value: number) => {
      opts.setSelectedAtlas((prev) => {
        if (!prev) return prev;
        const framesNext = prev.frames.map((frame) => {
          if (frame.id !== frameId) return frame;
          const pivot = frame.pivot ?? { x: 0.5, y: 0.5 };
          return { ...frame, pivot: { ...pivot, [axis]: value } };
        });
        return { ...prev, frames: framesNext };
      });
    },
    [opts],
  );

  return { updatePivot };
}
