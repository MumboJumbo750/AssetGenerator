import React, { useMemo, useState } from "react";
import { Badge, Group, Image, SegmentedControl, Stack, Text } from "@mantine/core";

import type { Asset } from "../../api";
import { AlphaMatteCycler } from "./AlphaMatteCycler";
import { IsoGridOverlay } from "./IsoGridOverlay";
import { ReferenceGhost } from "./ReferenceGhost";
import { HorizonCheck } from "./HorizonCheck";
import { SafeFrame } from "./SafeFrame";
import { OnionSkin } from "./OnionSkin";
import { ColorPicker } from "./ColorPicker";

/* ------------------------------------------------------------------ */
/*  Tool registry mapping                                              */
/* ------------------------------------------------------------------ */

const TOOL_ORDER = [
  "bg_cycler",
  "overlay_grid",
  "reference_ghost",
  "horizon_line",
  "safe_area",
  "onion_skin",
  "color_picker",
] as const;

const toolLabels: Record<string, string> = {
  bg_cycler: "BG Cycle",
  overlay_grid: "Iso Grid",
  reference_ghost: "Ghost Ref",
  horizon_line: "Horizon",
  safe_area: "Safe Frame",
  onion_skin: "Onion Skin",
  color_picker: "Color Pick",
  none: "Plain",
};

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

type ReviewToolHostProps = {
  imageUrl: string;
  /** Tool types recommended by the question / tag catalog */
  activeTools: string[];
  asset: Asset | null;
  tags: string[];
  style?: React.CSSProperties;
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ReviewToolHost({ imageUrl, activeTools, asset, tags, style }: ReviewToolHostProps) {
  // Determine which tools to offer
  const availableTools = useMemo(() => {
    const set = new Set(activeTools);
    // Always include "none" (plain view) as option
    const tools: string[] = [];
    for (const t of TOOL_ORDER) {
      if (set.has(t)) tools.push(t);
    }
    return tools;
  }, [activeTools]);

  const [selectedTool, setSelectedTool] = useState<string>(availableTools[0] ?? "none");

  // If available tools change (new question), reset selection
  const toolsKey = availableTools.join(",");
  const [prevToolsKey, setPrevToolsKey] = useState(toolsKey);
  if (toolsKey !== prevToolsKey) {
    setPrevToolsKey(toolsKey);
    const next = availableTools[0] ?? "none";
    if (selectedTool !== next) setSelectedTool(next);
  }

  // Render tool
  const renderTool = () => {
    switch (selectedTool) {
      case "bg_cycler":
        return <AlphaMatteCycler imageUrl={imageUrl} />;
      case "overlay_grid":
        return <IsoGridOverlay imageUrl={imageUrl} />;
      case "reference_ghost":
        return <ReferenceGhost imageUrl={imageUrl} asset={asset} />;
      case "horizon_line":
        return <HorizonCheck imageUrl={imageUrl} />;
      case "safe_area":
        return <SafeFrame imageUrl={imageUrl} />;
      case "onion_skin":
        return <OnionSkin imageUrl={imageUrl} asset={asset} />;
      case "color_picker":
        return <ColorPicker imageUrl={imageUrl} />;
      default:
        return <Image src={imageUrl} alt="Review image" fit="contain" h="65vh" />;
    }
  };

  return (
    <Stack gap="xs" style={style}>
      {/* Tool selector — only shown if tools are available */}
      {availableTools.length > 0 && (
        <Group gap="xs" justify="center">
          <SegmentedControl
            size="xs"
            value={selectedTool}
            onChange={setSelectedTool}
            data={[
              ...availableTools.map((t) => ({ value: t, label: toolLabels[t] ?? t })),
              { value: "none", label: "Plain" },
            ]}
            className="ag-tool-selector"
          />
        </Group>
      )}
      {/* Tool viewport */}
      <div className="ag-tool-viewport">{renderTool()}</div>
    </Stack>
  );
}
