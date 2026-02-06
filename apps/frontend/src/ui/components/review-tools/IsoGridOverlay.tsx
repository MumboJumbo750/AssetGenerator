import React, { useCallback, useRef, useState } from "react";
import { ActionIcon, Image, Text, Tooltip } from "@mantine/core";

/**
 * IsoGrid Overlay (overlay_grid)
 *
 * Overlays a 2:1 isometric grid on the image.
 * Drag to offset the grid alignment with asset placement.
 * Helps verify foot placement and projection angle.
 */

type Props = {
  imageUrl: string;
  style?: React.CSSProperties;
};

const GRID_CELL = 48;

function drawIsoGrid(canvas: HTMLCanvasElement, offsetX: number, offsetY: number) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  ctx.strokeStyle = "rgba(0, 255, 200, 0.35)";
  ctx.lineWidth = 1;

  // 2:1 iso ratio = 26.565° line angle
  // Draw diagonal lines (top-left to bottom-right)
  const step = GRID_CELL;
  const diagMax = w + h;

  for (let i = -diagMax; i < diagMax; i += step) {
    const x0 = i + (offsetX % step);
    const y0 = 0 + (offsetY % (step / 2));

    // Rising lines (/)
    ctx.beginPath();
    ctx.moveTo(x0, y0 + h);
    ctx.lineTo(x0 + h * 2, y0);
    ctx.stroke();

    // Falling lines (\)
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0 + h * 2, y0 + h);
    ctx.stroke();
  }
}

export function IsoGridOverlay({ imageUrl, style }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });

  const redraw = useCallback((ox: number, oy: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawIsoGrid(canvas, ox, oy);
  }, []);

  const handleImageLoad = useCallback(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    redraw(offset.x, offset.y);
  }, [offset, redraw]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      dragging.current = true;
      dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [offset],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return;
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      const newOffset = { x: dragStart.current.ox + dx, y: dragStart.current.oy + dy };
      setOffset(newOffset);
      redraw(newOffset.x, newOffset.y);
    },
    [redraw],
  );

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  return (
    <div
      ref={containerRef}
      className="ag-review-tool ag-tool-iso-grid"
      style={{ position: "relative", cursor: visible ? "grab" : "default", ...style }}
      onPointerDown={visible ? onPointerDown : undefined}
      onPointerMove={visible ? onPointerMove : undefined}
      onPointerUp={visible ? onPointerUp : undefined}
    >
      <Image src={imageUrl} alt="Iso grid preview" fit="contain" h="65vh" onLoad={handleImageLoad} />
      {visible && (
        <canvas
          ref={canvasRef}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
          }}
        />
      )}
      <Tooltip label={visible ? "Hide grid" : "Show isometric grid"}>
        <ActionIcon
          variant="filled"
          color={visible ? "teal" : "dark"}
          size="sm"
          onClick={() => setVisible((v) => !v)}
          style={{ position: "absolute", top: 8, right: 8, zIndex: 2 }}
        >
          <Text size="xs">ISO</Text>
        </ActionIcon>
      </Tooltip>
    </div>
  );
}
