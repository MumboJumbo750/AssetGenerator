import React, { useCallback, useState } from "react";
import { ActionIcon, Group, Image, Text, Tooltip } from "@mantine/core";

/**
 * AlphaMatteCycler (bg_cycler)
 *
 * Press TAB (or click) to cycle through background colors:
 * Black → White → Green → Checkerboard.
 * Helps spot dirty edges or semi-transparent pixels.
 */

const BG_MODES = ["black", "white", "green", "checker"] as const;
type BgMode = (typeof BG_MODES)[number];

const bgStyles: Record<BgMode, React.CSSProperties> = {
  black: { backgroundColor: "#000000" },
  white: { backgroundColor: "#ffffff" },
  green: { backgroundColor: "#00c853" },
  checker: {
    backgroundImage: "repeating-conic-gradient(#808080 0% 25%, #c0c0c0 0% 50%) 50% / 24px 24px",
  },
};

const bgLabels: Record<BgMode, string> = {
  black: "Black",
  white: "White",
  green: "Green Screen",
  checker: "Checkerboard",
};

type Props = {
  imageUrl: string;
  style?: React.CSSProperties;
};

export function AlphaMatteCycler({ imageUrl, style }: Props) {
  const [modeIndex, setModeIndex] = useState(0);
  const mode = BG_MODES[modeIndex % BG_MODES.length];

  const cycle = useCallback(() => {
    setModeIndex((i) => (i + 1) % BG_MODES.length);
  }, []);

  return (
    <div
      className="ag-review-tool ag-tool-bg-cycler"
      style={{ position: "relative", ...style }}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Tab") {
          e.preventDefault();
          cycle();
        }
      }}
    >
      <div
        className="ag-tool-bg-layer"
        style={{
          ...bgStyles[mode],
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 8,
        }}
      >
        <Image src={imageUrl} alt="Alpha matte preview" fit="contain" h="65vh" />
      </div>
      <Tooltip label={`Background: ${bgLabels[mode]} — press TAB to cycle`}>
        <ActionIcon
          className="ag-tool-badge"
          variant="filled"
          color="dark"
          size="sm"
          onClick={cycle}
          style={{ position: "absolute", top: 8, right: 8, zIndex: 2 }}
        >
          <Text size="xs">BG</Text>
        </ActionIcon>
      </Tooltip>
    </div>
  );
}
