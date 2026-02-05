import { useEffect, useState } from "react";

export function useAtlasImageSizing(opts: {
  atlasImageRef: React.RefObject<HTMLImageElement>;
  selectedAtlasId: string | null;
}) {
  const [imageSize, setImageSize] = useState<{
    naturalW: number;
    naturalH: number;
    displayW: number;
    displayH: number;
  }>({
    naturalW: 1,
    naturalH: 1,
    displayW: 1,
    displayH: 1,
  });

  useEffect(() => {
    const img = opts.atlasImageRef.current;
    if (!img) return;
    const update = () => {
      setImageSize({
        naturalW: img.naturalWidth || 1,
        naturalH: img.naturalHeight || 1,
        displayW: img.clientWidth || 1,
        displayH: img.clientHeight || 1,
      });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [opts.atlasImageRef, opts.selectedAtlasId]);

  const onImageLoad = () => {
    setImageSize((prev) => ({
      ...prev,
      naturalW: opts.atlasImageRef.current?.naturalWidth ?? prev.naturalW,
      naturalH: opts.atlasImageRef.current?.naturalHeight ?? prev.naturalH,
      displayW: opts.atlasImageRef.current?.clientWidth ?? prev.displayW,
      displayH: opts.atlasImageRef.current?.clientHeight ?? prev.displayH,
    }));
  };

  return { imageSize, setImageSize, onImageLoad };
}
