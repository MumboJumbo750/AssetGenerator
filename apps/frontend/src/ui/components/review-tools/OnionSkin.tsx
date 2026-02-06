import React, { useCallback, useMemo, useState } from "react";
import { ActionIcon, Group, Image, Slider, Text, Tooltip } from "@mantine/core";

import type { Asset } from "../../api";

/**
 * OnionSkin (onion_skin)
 *
 * For multi-frame/spritesheet assets: a playback scrubber with
 * previous/next frame ghosting at reduced opacity.
 * Helps check animation fluidity and centering.
 */

type Props = {
  imageUrl: string;
  asset: Asset | null;
  style?: React.CSSProperties;
};

function toDataUrl(pathValue?: string) {
  if (!pathValue?.trim()) return "";
  if (pathValue.startsWith("http") || pathValue.startsWith("/data/")) return pathValue;
  if (pathValue.startsWith("data/")) return `/${pathValue}`;
  return `/data/${pathValue}`;
}

function extractFrameUrls(asset: Asset | null): string[] {
  if (!asset) return [];

  // Gather all version variants sorted by frame index
  const frames: { index: number; url: string }[] = [];

  for (const version of asset.versions) {
    const gen = version.generation as Record<string, unknown> | undefined;
    const frameIndex = typeof gen?.frameIndex === "number" ? gen.frameIndex : -1;
    const variant = version.variants.find((v) => v.id === version.primaryVariantId) ?? version.variants[0];
    const url = toDataUrl(variant?.alphaPath ?? variant?.previewPath ?? variant?.originalPath);
    if (url) {
      frames.push({ index: frameIndex >= 0 ? frameIndex : frames.length, url });
    }
  }

  frames.sort((a, b) => a.index - b.index);
  return frames.map((f) => f.url);
}

export function OnionSkin({ imageUrl, asset, style }: Props) {
  const frames = useMemo(() => {
    const extracted = extractFrameUrls(asset);
    // Ensure current imageUrl is included
    if (extracted.length === 0) return [imageUrl];
    return extracted;
  }, [asset, imageUrl]);

  const [frameIndex, setFrameIndex] = useState(0);
  const [showOnion, setShowOnion] = useState(true);

  const currentFrame = frames[frameIndex] ?? imageUrl;
  const prevFrame = frameIndex > 0 ? frames[frameIndex - 1] : null;
  const nextFrame = frameIndex < frames.length - 1 ? frames[frameIndex + 1] : null;

  const goTo = useCallback(
    (idx: number) => setFrameIndex(Math.max(0, Math.min(frames.length - 1, idx))),
    [frames.length],
  );

  if (frames.length <= 1) {
    // Not a multi-frame asset — just show the image with a note
    return (
      <div className="ag-review-tool ag-tool-onion-skin" style={{ position: "relative", ...style }}>
        <Image src={imageUrl} alt="Single frame" fit="contain" h="65vh" />
        <div style={{ position: "absolute", top: 8, right: 8, zIndex: 2 }}>
          <Tooltip label="Onion skin requires multiple frames">
            <ActionIcon variant="filled" color="dark" size="sm">
              <Text size="xs">OS</Text>
            </ActionIcon>
          </Tooltip>
        </div>
      </div>
    );
  }

  return (
    <div className="ag-review-tool ag-tool-onion-skin" style={{ position: "relative", ...style }}>
      {/* Ghost previous */}
      {showOnion && prevFrame && (
        <Image
          src={prevFrame}
          alt="Previous frame ghost"
          fit="contain"
          h="65vh"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            opacity: 0.25,
            pointerEvents: "none",
            filter: "hue-rotate(180deg)",
            zIndex: 0,
          }}
        />
      )}
      {/* Ghost next */}
      {showOnion && nextFrame && (
        <Image
          src={nextFrame}
          alt="Next frame ghost"
          fit="contain"
          h="65vh"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            opacity: 0.25,
            pointerEvents: "none",
            filter: "hue-rotate(-90deg)",
            zIndex: 0,
          }}
        />
      )}
      {/* Current frame */}
      <Image
        src={currentFrame}
        alt={`Frame ${frameIndex + 1}`}
        fit="contain"
        h="65vh"
        style={{ position: "relative", zIndex: 1 }}
      />

      {/* Scrubber */}
      <div
        style={{
          position: "absolute",
          bottom: 12,
          left: 24,
          right: 24,
          background: "rgba(0,0,0,0.7)",
          borderRadius: 8,
          padding: "8px 16px",
          zIndex: 2,
        }}
      >
        <Group gap="sm" align="center">
          <Text size="xs" c="dimmed">
            Frame {frameIndex + 1}/{frames.length}
          </Text>
          <Slider
            value={frameIndex}
            onChange={goTo}
            min={0}
            max={frames.length - 1}
            step={1}
            size="sm"
            style={{ flex: 1 }}
          />
        </Group>
      </div>

      {/* Toggle */}
      <Tooltip label={showOnion ? "Hide onion skin" : "Show onion skin ghosting"}>
        <ActionIcon
          variant="filled"
          color={showOnion ? "grape" : "dark"}
          size="sm"
          onClick={() => setShowOnion((v) => !v)}
          style={{ position: "absolute", top: 8, right: 8, zIndex: 2 }}
        >
          <Text size="xs">OS</Text>
        </ActionIcon>
      </Tooltip>
    </div>
  );
}
