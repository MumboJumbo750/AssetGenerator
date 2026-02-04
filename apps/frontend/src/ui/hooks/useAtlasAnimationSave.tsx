import { useCallback } from "react";

import { updateSpec } from "../api";

export function useAtlasAnimationSave(opts: {
  projectId: string;
  onRefreshProject: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const saveAnimation = useCallback(
    async (input: {
      animationSpecId: string;
      animationName: string;
      animationFps: number;
      animationLoop: boolean;
      animationFrames: string[];
    }) => {
      const { animationSpecId, animationName, animationFps, animationLoop, animationFrames } = input;
      if (!opts.projectId || !animationSpecId || animationFrames.length === 0) return;
      try {
        await updateSpec(opts.projectId, animationSpecId, {
          output: {
            kind: "animation",
            animation: {
              name: animationName || undefined,
              fps: animationFps,
              loop: animationLoop,
              frameCount: animationFrames.length,
              frameNames: animationFrames
            }
          }
        });
        await opts.onRefreshProject();
      } catch (e: any) {
        opts.onError(e?.message ?? String(e));
      }
    },
    [opts]
  );

  return { saveAnimation };
}
