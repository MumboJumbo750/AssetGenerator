import React, { useCallback, useRef, useState } from "react";
import { ActionIcon, Text, Tooltip } from "@mantine/core";

/**
 * ColorPicker (color_picker)
 *
 * Click anywhere on the image to sample pixel color.
 * Shows hex value and rgb with a swatch.
 */

type Props = {
  imageUrl: string;
  style?: React.CSSProperties;
};

type SampledColor = {
  hex: string;
  r: number;
  g: number;
  b: number;
  a: number;
  x: number;
  y: number;
};

export function ColorPicker({ imageUrl, style }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [active, setActive] = useState(true);
  const [sampled, setSampled] = useState<SampledColor | null>(null);

  const ensureCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !img.naturalWidth) return null;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    return ctx;
  }, []);

  const onClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!active) return;
      const container = e.currentTarget;
      const img = imgRef.current;
      if (!img) return;

      const ctx = ensureCanvas();
      if (!ctx) return;

      const rect = img.getBoundingClientRect();
      // Compute image-space coordinates accounting for object-fit: contain
      const scaleX = img.naturalWidth / rect.width;
      const scaleY = img.naturalHeight / rect.height;
      const px = Math.round((e.clientX - rect.left) * scaleX);
      const py = Math.round((e.clientY - rect.top) * scaleY);

      if (px < 0 || py < 0 || px >= img.naturalWidth || py >= img.naturalHeight) return;
      const data = ctx.getImageData(px, py, 1, 1).data;
      const r = data[0];
      const g = data[1];
      const b = data[2];
      const a = data[3];
      const hex = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
      setSampled({ hex, r, g, b, a, x: px, y: py });
    },
    [active, ensureCanvas],
  );

  return (
    <div
      className="ag-review-tool ag-tool-color-picker"
      style={{ position: "relative", cursor: active ? "crosshair" : "default", ...style }}
      onClick={onClick}
    >
      <img
        ref={imgRef}
        src={imageUrl}
        alt="Color picker target"
        style={{ maxHeight: "65vh", width: "100%", objectFit: "contain" }}
        crossOrigin="anonymous"
      />
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {sampled && active && (
        <div
          style={{
            position: "absolute",
            bottom: 12,
            left: 12,
            background: "rgba(0,0,0,0.8)",
            borderRadius: 8,
            padding: "6px 12px",
            display: "flex",
            alignItems: "center",
            gap: 8,
            zIndex: 2,
          }}
        >
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: 4,
              backgroundColor: sampled.hex,
              border: "1px solid rgba(255,255,255,0.3)",
            }}
          />
          <div>
            <Text size="xs" ff="monospace">
              {sampled.hex} (a:{sampled.a})
            </Text>
            <Text size="xs" c="dimmed" ff="monospace">
              rgb({sampled.r}, {sampled.g}, {sampled.b}) @ {sampled.x},{sampled.y}
            </Text>
          </div>
        </div>
      )}

      <Tooltip label={active ? "Disable color picker" : "Enable color picker (click to sample)"}>
        <ActionIcon
          variant="filled"
          color={active ? "pink" : "dark"}
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            setActive((v) => !v);
          }}
          style={{ position: "absolute", top: 8, right: 8, zIndex: 2 }}
        >
          <Text size="xs">CP</Text>
        </ActionIcon>
      </Tooltip>
    </div>
  );
}
