import { useEffect } from "react";

import type { AtlasRecord } from "../api";

export function useAtlasAnimationPreview(opts: {
  selectedAtlas: AtlasRecord | null;
  animationFrames: string[];
  animationFps: number;
  animationLoop: boolean;
  animationCanvasRef: React.RefObject<HTMLCanvasElement>;
  atlasImageRef: React.RefObject<HTMLImageElement>;
}) {
  useEffect(() => {
    const { selectedAtlas, animationFrames, animationFps, animationLoop, animationCanvasRef, atlasImageRef } = opts;
    if (!selectedAtlas || animationFrames.length === 0) return;
    const canvas = animationCanvasRef.current;
    const img = atlasImageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const framesById = new Map(selectedAtlas.frames.map((f) => [f.id, f]));
    const ordered = animationFrames.map((id) => framesById.get(id)).filter(Boolean) as AtlasRecord["frames"];
    if (ordered.length === 0) return;

    let frameIndex = 0;
    let raf = 0;
    let last = performance.now();
    const frameDuration = 1000 / Math.max(1, animationFps);

    const draw = (time: number) => {
      if (time - last >= frameDuration) {
        last = time;
        const frame = ordered[frameIndex];
        frameIndex += 1;
        if (frameIndex >= ordered.length) frameIndex = animationLoop ? 0 : ordered.length - 1;
        canvas.width = frame.rect.w;
        canvas.height = frame.rect.h;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, frame.rect.x, frame.rect.y, frame.rect.w, frame.rect.h, 0, 0, frame.rect.w, frame.rect.h);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [opts]);
}
