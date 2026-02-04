import { useCallback, useEffect, useRef, useState } from "react";

import { listAtlases, type AtlasRecord } from "../api";
import { useAtlasImageSizing } from "./useAtlasImageSizing";

export function useAtlasWorkspace(projectId: string) {
  const [atlases, setAtlases] = useState<AtlasRecord[]>([]);
  const [selectedAtlasId, setSelectedAtlasId] = useState<string | null>(null);
  const [selectedAtlas, setSelectedAtlas] = useState<AtlasRecord | null>(null);
  const [atlasError, setAtlasError] = useState<string | null>(null);
  const atlasImageRef = useRef<HTMLImageElement | null>(null);
  const { imageSize, setImageSize, onImageLoad } = useAtlasImageSizing({
    atlasImageRef,
    selectedAtlasId
  });

  const refreshAtlases = useCallback(async () => {
    if (!projectId) return;
    try {
      const { atlases } = await listAtlases(projectId);
      setAtlases(atlases);
      setAtlasError(null);
      if (!selectedAtlasId && atlases[0]) setSelectedAtlasId(atlases[0].id);
    } catch (e: any) {
      setAtlasError(e?.message ?? String(e));
    }
  }, [projectId, selectedAtlasId]);

  useEffect(() => {
    refreshAtlases();
  }, [refreshAtlases]);

  useEffect(() => {
    if (!selectedAtlasId) {
      setSelectedAtlas(null);
      return;
    }
    const atlas = atlases.find((a) => a.id === selectedAtlasId) ?? null;
    setSelectedAtlas(atlas);
  }, [atlases, selectedAtlasId]);

  return {
    atlases,
    selectedAtlasId,
    setSelectedAtlasId,
    selectedAtlas,
    setSelectedAtlas,
    atlasError,
    refreshAtlases,
    atlasImageRef,
    imageSize,
    setImageSize,
    onImageLoad
  };
}
