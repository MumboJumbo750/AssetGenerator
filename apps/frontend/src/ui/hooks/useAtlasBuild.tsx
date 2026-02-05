import { useCallback, useState } from "react";

import { createJob } from "../api";

export type FrameEntry = {
  key: string;
  path: string;
  assetId: string;
  versionId: string;
  variantId: string;
};

export function useAtlasBuild(opts: {
  projectId: string;
  onRefreshProject: () => Promise<void>;
  onRefreshAtlases: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [atlasId, setAtlasId] = useState("");
  const [padding, setPadding] = useState(2);
  const [maxSize, setMaxSize] = useState(2048);
  const [powerOfTwo, setPowerOfTwo] = useState(true);
  const [trim, setTrim] = useState(true);
  const [extrude, setExtrude] = useState(0);
  const [sort, setSort] = useState("area");
  const [frames, setFrames] = useState<FrameEntry[]>([]);

  const addFrame = useCallback((candidate: { assetId: string; versionId: string; variantId: string; path: string }) => {
    setFrames((items) => [
      ...items,
      {
        key: `${candidate.assetId}_${candidate.variantId}`,
        path: candidate.path,
        assetId: candidate.assetId,
        versionId: candidate.versionId,
        variantId: candidate.variantId,
      },
    ]);
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

  const updateFrameKey = useCallback((index: number, value: string) => {
    setFrames((items) => items.map((item, idx) => (idx === index ? { ...item, key: value } : item)));
  }, []);

  const removeFrame = useCallback((index: number) => {
    setFrames((items) => items.filter((_, idx) => idx !== index));
  }, []);

  const resetBuild = useCallback(() => {
    setFrames([]);
    setAtlasId("");
  }, []);

  const createAtlas = useCallback(async () => {
    if (!opts.projectId || frames.length === 0) return;
    try {
      await createJob(opts.projectId, "atlas_pack", {
        atlasId: atlasId.trim() || undefined,
        padding,
        maxSize,
        powerOfTwo,
        trim,
        extrude,
        sort,
        framePaths: frames.map((f) => ({ key: f.key, path: f.path })),
      });
      await opts.onRefreshProject();
      await opts.onRefreshAtlases();
      resetBuild();
    } catch (e: any) {
      opts.onError(e?.message ?? String(e));
    }
  }, [opts, frames, atlasId, padding, maxSize, powerOfTwo, trim, extrude, sort, resetBuild]);

  return {
    atlasId,
    padding,
    maxSize,
    powerOfTwo,
    trim,
    extrude,
    sort,
    frames,
    setAtlasId,
    setPadding,
    setMaxSize,
    setPowerOfTwo,
    setTrim,
    setExtrude,
    setSort,
    addFrame,
    moveFrame,
    updateFrameKey,
    removeFrame,
    createAtlas,
  };
}
