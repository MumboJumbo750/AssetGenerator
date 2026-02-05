import React, { useEffect, useMemo, useState } from "react";
import { Button, Card, Group, Slider, Stack, Text } from "@mantine/core";

import { HelpTip } from "../../components/HelpTip";
import type { Asset } from "../../api";
import { AnimationSequenceModal } from "./AnimationSequenceModal";

type AssetVersion = Asset["versions"][number];
type AssetVariant = Asset["versions"][number]["variants"][number];

type Props = {
  selectedAsset: Asset | null;
  selectedVersion: AssetVersion | null;
  selectedVariant: AssetVariant | null;
  selectedVariantId: string;
  selectedVersionId: string;
  sequenceVersions: AssetVersion[];
  selectedSpec: {
    title: string;
    assetType?: string;
    output?: { kind?: string; animation?: { fps?: number } };
    prompt: { positive: string; negative: string };
  } | null;
  projectId: string;
  onRefresh: () => Promise<void>;
  zoom: number;
  onZoomChange: (value: number) => void;
};

export function AssetPreviewPanel(props: Props) {
  const helperSpec = props.selectedSpec;
  const helperImage = useMemo(() => {
    if (!props.selectedVariant) return null;
    return props.selectedVariant.alphaPath ?? props.selectedVariant.originalPath ?? null;
  }, [props.selectedVariant]);

  const helperVariants =
    props.selectedVersion?.variants
      ?.map((v) => v.alphaPath ?? v.originalPath ?? null)
      .filter((path): path is string => Boolean(path)) ?? [];

  const isAnimationSpec =
    helperSpec?.output?.kind === "animation" ||
    helperSpec?.assetType === "spritesheet" ||
    helperSpec?.assetType === "sprite";
  const sequenceVersions = props.sequenceVersions ?? [];
  const hasSequence = isAnimationSpec && sequenceVersions.length > 1;
  const isTileableSpec =
    helperSpec?.assetType === "texture" ||
    helperSpec?.assetType === "tile" ||
    (props.selectedVariant?.tags ?? []).includes("tileable:yes");

  const [animIndex, setAnimIndex] = useState(0);
  const [animPlaying, setAnimPlaying] = useState(true);
  const animFps = helperSpec?.output?.animation?.fps ?? 8;
  const [editorOpen, setEditorOpen] = useState(false);

  useEffect(() => {
    setAnimIndex(0);
  }, [props.selectedVariantId, props.selectedVersionId]);

  const sequenceFramePaths = useMemo(() => {
    if (!hasSequence) return helperVariants;
    return sequenceVersions
      .map((version) => {
        if (version.id === props.selectedVersionId && props.selectedVariantId) {
          const current = version.variants.find((v) => v.id === props.selectedVariantId) ?? null;
          if (current) return current.alphaPath ?? current.originalPath ?? null;
        }
        const primary = version.primaryVariantId
          ? version.variants.find((v) => v.id === version.primaryVariantId)
          : null;
        const selected = version.variants.find((v) => v.status === "selected") ?? null;
        const candidate = version.variants[0] ?? null;
        const variant = primary ?? selected ?? candidate;
        return variant?.alphaPath ?? variant?.originalPath ?? null;
      })
      .filter((path): path is string => Boolean(path));
  }, [hasSequence, sequenceVersions, helperVariants, props.selectedVersionId, props.selectedVariantId]);

  useEffect(() => {
    const frames = hasSequence ? sequenceFramePaths : helperVariants;
    if (!isAnimationSpec || !animPlaying || frames.length < 2) return;
    const interval = Math.max(80, Math.round(1000 / animFps));
    const t = window.setInterval(() => {
      setAnimIndex((prev) => (prev + 1) % frames.length);
    }, interval);
    return () => window.clearInterval(t);
  }, [isAnimationSpec, animPlaying, helperVariants.length, sequenceFramePaths.length, animFps, hasSequence]);

  return (
    <Card withBorder radius="md" p="md">
      <Stack gap="xs">
        <Group justify="space-between">
          <Group gap="xs">
            <Text fw={600}>Preview</Text>
            <HelpTip label="Use zoom to check edges and alpha." topicId="review-variants" />
          </Group>
          <Group gap="xs">
            {hasSequence && (
              <Button size="xs" variant="light" onClick={() => setEditorOpen(true)}>
                Edit animation
              </Button>
            )}
            <Text size="xs" c="dimmed">
              Zoom
            </Text>
            <Slider value={props.zoom} onChange={props.onZoomChange} min={0.5} max={3} step={0.1} w={140} />
          </Group>
        </Group>

        {!props.selectedAsset && <Text size="sm">Pick an asset from the list to preview.</Text>}

        {props.selectedVariant && (
          <>
            <div className="ag-checkerboard ag-preview-surface">
              {props.selectedVariant.alphaPath && (
                <img
                  src={`/data/${props.selectedVariant.alphaPath}`}
                  className="ag-preview-image"
                  style={{ transform: `scale(${props.zoom})` }}
                  alt="alpha preview"
                />
              )}
              {!props.selectedVariant.alphaPath && props.selectedVariant.originalPath && (
                <img
                  src={`/data/${props.selectedVariant.originalPath}`}
                  className="ag-preview-image"
                  style={{ transform: `scale(${props.zoom})` }}
                  alt="original preview"
                />
              )}
              {!props.selectedVariant.alphaPath && !props.selectedVariant.originalPath && (
                <Text size="sm" c="dimmed">
                  No preview image available.
                </Text>
              )}
            </div>
            <Text size="xs" c="dimmed">
              tags={(props.selectedVariant.tags ?? []).join(", ") || "none"}
            </Text>
            {props.selectedSpec && (
              <Stack gap={4}>
                <Text size="xs" fw={600}>
                  Spec: {props.selectedSpec.title}
                </Text>
                {(props.selectedVersion as any)?.generation?.framePrompt && (
                  <Text size="xs" c="dimmed">
                    frame: {(props.selectedVersion as any).generation.framePrompt}
                  </Text>
                )}
                <Text size="xs" c="dimmed">
                  positive: {props.selectedSpec.prompt.positive}
                </Text>
                <Text size="xs" c="dimmed">
                  negative: {props.selectedSpec.prompt.negative}
                </Text>
              </Stack>
            )}
          </>
        )}

        {(isTileableSpec || isAnimationSpec) && props.selectedVariant && (
          <Stack gap="xs">
            <Text size="sm" fw={600}>
              Helpers
            </Text>
            {isTileableSpec && helperImage && (
              <div className="ag-checkerboard ag-preview-surface">
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    backgroundImage: `url(/data/${helperImage})`,
                    backgroundRepeat: "repeat",
                    backgroundSize: "140px 140px",
                  }}
                />
              </div>
            )}
            {isAnimationSpec && sequenceFramePaths.length > 1 && (
              <Stack gap="xs">
                <Group gap="xs">
                  <Button size="xs" variant="light" onClick={() => setAnimPlaying((v) => !v)}>
                    {animPlaying ? "Pause" : "Play"}
                  </Button>
                  <Text size="xs" c="dimmed">
                    Previewing {animIndex + 1}/{sequenceFramePaths.length} @ {animFps}fps
                  </Text>
                </Group>
                <div className="ag-checkerboard ag-preview-surface">
                  <img
                    src={`/data/${sequenceFramePaths[animIndex]}`}
                    className="ag-preview-image"
                    style={{ transform: `scale(${props.zoom})` }}
                    alt="animation preview"
                  />
                </div>
              </Stack>
            )}
          </Stack>
        )}
      </Stack>
      {props.selectedAsset && (
        <AnimationSequenceModal
          open={editorOpen}
          onClose={() => setEditorOpen(false)}
          projectId={props.projectId}
          assetId={props.selectedAsset.id}
          sequenceVersions={sequenceVersions}
          selectedSpec={props.selectedSpec}
          onRefresh={props.onRefresh}
        />
      )}
    </Card>
  );
}
