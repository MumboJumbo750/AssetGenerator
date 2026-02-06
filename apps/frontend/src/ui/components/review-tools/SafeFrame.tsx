import React, { useState } from "react";
import { ActionIcon, Image, Text, Tooltip } from "@mantine/core";

/**
 * SafeFrame (safe_area)
 *
 * Shows padded bounds / bleed area overlay on the image.
 * Ensures icons and logos don't touch edges.
 */

type Props = {
  imageUrl: string;
  /** Padding percentage from each edge (default 10%) */
  paddingPercent?: number;
  style?: React.CSSProperties;
};

export function SafeFrame({ imageUrl, paddingPercent = 10, style }: Props) {
  const [visible, setVisible] = useState(true);

  return (
    <div className="ag-review-tool ag-tool-safe-frame" style={{ position: "relative", ...style }}>
      <Image src={imageUrl} alt="Safe frame preview" fit="contain" h="65vh" />
      {visible && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            pointerEvents: "none",
            zIndex: 1,
          }}
        >
          {/* Safe area rect */}
          <div
            style={{
              position: "absolute",
              top: `${paddingPercent}%`,
              left: `${paddingPercent}%`,
              right: `${paddingPercent}%`,
              bottom: `${paddingPercent}%`,
              border: "2px dashed rgba(100, 220, 255, 0.6)",
              borderRadius: 4,
            }}
          />
          {/* Danger zones (semi-transparent red) */}
          {/* Top */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: `${paddingPercent}%`,
              background: "rgba(255, 60, 80, 0.12)",
            }}
          />
          {/* Bottom */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: `${paddingPercent}%`,
              background: "rgba(255, 60, 80, 0.12)",
            }}
          />
          {/* Left */}
          <div
            style={{
              position: "absolute",
              top: `${paddingPercent}%`,
              left: 0,
              bottom: `${paddingPercent}%`,
              width: `${paddingPercent}%`,
              background: "rgba(255, 60, 80, 0.12)",
            }}
          />
          {/* Right */}
          <div
            style={{
              position: "absolute",
              top: `${paddingPercent}%`,
              right: 0,
              bottom: `${paddingPercent}%`,
              width: `${paddingPercent}%`,
              background: "rgba(255, 60, 80, 0.12)",
            }}
          />
          {/* Label */}
          <div
            style={{
              position: "absolute",
              top: `${paddingPercent}%`,
              left: `${paddingPercent}%`,
              transform: "translate(4px, 4px)",
            }}
          >
            <Text size="xs" c="cyan.4">
              Safe area ({paddingPercent}%)
            </Text>
          </div>
        </div>
      )}
      <Tooltip label={visible ? "Hide safe frame" : "Show safe area overlay"}>
        <ActionIcon
          variant="filled"
          color={visible ? "cyan" : "dark"}
          size="sm"
          onClick={() => setVisible((v) => !v)}
          style={{ position: "absolute", top: 8, right: 8, zIndex: 2 }}
        >
          <Text size="xs">SF</Text>
        </ActionIcon>
      </Tooltip>
    </div>
  );
}
