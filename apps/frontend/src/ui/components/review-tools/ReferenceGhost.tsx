import React, { useMemo, useState } from "react";
import { ActionIcon, Image, Text, Tooltip } from "@mantine/core";

import type { Asset } from "../../api";

/**
 * ReferenceGhost (reference_ghost)
 *
 * Hold SHIFT to overlay the "parent" or "baseline" entity asset at 50% opacity.
 * Helps check silhouette drift and size consistency between linked assets.
 */

type Props = {
  imageUrl: string;
  /** The current asset being reviewed */
  asset: Asset | null;
  /** Optional explicit reference image URL */
  referenceImageUrl?: string;
  style?: React.CSSProperties;
};

function findReferenceUrl(asset: Asset | null): string {
  if (!asset) return "";
  // Use the first variant of the first version as the "baseline" reference.
  // If there are multiple versions, the first version is the original reference.
  if (asset.versions.length <= 1) return "";
  const firstVersion = asset.versions[0];
  const refVariant =
    firstVersion?.variants.find((v) => v.id === firstVersion.primaryVariantId) ?? firstVersion?.variants[0];
  const path = refVariant?.alphaPath ?? refVariant?.originalPath;
  if (!path) return "";
  if (path.startsWith("http") || path.startsWith("/data/")) return path;
  if (path.startsWith("data/")) return `/${path}`;
  return `/data/${path}`;
}

export function ReferenceGhost({ imageUrl, asset, referenceImageUrl, style }: Props) {
  const [showGhost, setShowGhost] = useState(false);
  const [locked, setLocked] = useState(false);

  const refUrl = referenceImageUrl || findReferenceUrl(asset);
  const ghostActive = locked || showGhost;

  return (
    <div
      className="ag-review-tool ag-tool-reference-ghost"
      style={{ position: "relative", ...style }}
      onKeyDown={(e) => {
        if (e.key === "Shift") setShowGhost(true);
      }}
      onKeyUp={(e) => {
        if (e.key === "Shift") setShowGhost(false);
      }}
      tabIndex={0}
    >
      <Image src={imageUrl} alt="Current variant" fit="contain" h="65vh" />
      {refUrl && ghostActive && (
        <Image
          src={refUrl}
          alt="Reference ghost"
          fit="contain"
          h="65vh"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            opacity: 0.5,
            pointerEvents: "none",
            objectFit: "contain",
          }}
        />
      )}
      {!refUrl && ghostActive && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            background: "rgba(0,0,0,0.7)",
            padding: "8px 16px",
            borderRadius: 6,
          }}
        >
          <Text size="sm" c="dimmed">
            No reference image available
          </Text>
        </div>
      )}
      <Tooltip label={locked ? "Unlock ghost overlay" : "Lock ghost overlay (or hold SHIFT)"}>
        <ActionIcon
          variant="filled"
          color={locked ? "violet" : "dark"}
          size="sm"
          onClick={() => setLocked((v) => !v)}
          style={{ position: "absolute", top: 8, right: 8, zIndex: 2 }}
        >
          <Text size="xs">REF</Text>
        </ActionIcon>
      </Tooltip>
    </div>
  );
}
