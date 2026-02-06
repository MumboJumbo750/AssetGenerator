import React, { useCallback, useRef, useState } from "react";
import { ActionIcon, Image, Text, Tooltip } from "@mantine/core";

/**
 * HorizonCheck (horizon_line)
 *
 * Shows an adjustable horizontal floor line on the image.
 * Drag to position. Helps ensure characters aren't "floating" or "sinking."
 */

type Props = {
  imageUrl: string;
  style?: React.CSSProperties;
};

export function HorizonCheck({ imageUrl, style }: Props) {
  const [visible, setVisible] = useState(true);
  const [yPercent, setYPercent] = useState(75); // default at 75% from top
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const updatePosition = useCallback((clientY: number) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const pct = ((clientY - rect.top) / rect.height) * 100;
    setYPercent(Math.max(0, Math.min(100, pct)));
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      dragging.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      updatePosition(e.clientY);
    },
    [updatePosition],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return;
      updatePosition(e.clientY);
    },
    [updatePosition],
  );

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  return (
    <div
      ref={containerRef}
      className="ag-review-tool ag-tool-horizon"
      style={{ position: "relative", cursor: visible ? "ns-resize" : "default", ...style }}
      onPointerDown={visible ? onPointerDown : undefined}
      onPointerMove={visible ? onPointerMove : undefined}
      onPointerUp={visible ? onPointerUp : undefined}
    >
      <Image src={imageUrl} alt="Horizon check" fit="contain" h="65vh" />
      {visible && (
        <>
          <div
            style={{
              position: "absolute",
              top: `${yPercent}%`,
              left: 0,
              right: 0,
              height: 2,
              background: "rgba(255, 200, 40, 0.8)",
              pointerEvents: "none",
              zIndex: 1,
            }}
          />
          <div
            style={{
              position: "absolute",
              top: `${yPercent}%`,
              right: 8,
              transform: "translateY(-50%)",
              background: "rgba(0,0,0,0.7)",
              padding: "2px 6px",
              borderRadius: 4,
              pointerEvents: "none",
              zIndex: 1,
            }}
          >
            <Text size="xs" c="yellow.4">
              Floor line {Math.round(yPercent)}%
            </Text>
          </div>
        </>
      )}
      <Tooltip label={visible ? "Hide floor line" : "Show floor line (drag to adjust)"}>
        <ActionIcon
          variant="filled"
          color={visible ? "yellow" : "dark"}
          size="sm"
          onClick={() => setVisible((v) => !v)}
          style={{ position: "absolute", top: 8, right: 8, zIndex: 2 }}
        >
          <Text size="xs">FLR</Text>
        </ActionIcon>
      </Tooltip>
    </div>
  );
}
