import React, { useEffect, useMemo, useState } from "react";
import { Button, Card, Group, Select, Slider, Stack, Text, TextInput } from "@mantine/core";

import { HelpTip } from "../../components/HelpTip";
import type { Asset } from "../../api";

type AssetVersion = Asset["versions"][number];
type AssetVariant = Asset["versions"][number]["variants"][number];

type Props = {
  selectedAsset: Asset | null;
  selectedVersion: AssetVersion | null;
  selectedVariant: AssetVariant | null;
  selectedVariantId: string;
  selectedVersionId: string;
  onSelectVersionId: (value: string) => void;
  sequenceVersions: AssetVersion[];
  selectedSpec: {
    title: string;
    assetType?: string;
    output?: { kind?: string; animation?: { fps?: number } };
    prompt: { positive: string; negative: string };
  } | null;
  assetUpdateBusy: boolean;
  reviewNote: string;
  customTag: string;
  zoom: number;
  tagCatalog: {
    groups: Array<{ id: string; label: string; exclusive?: boolean; tags: Array<{ id: string; label: string }> }>;
  } | null;
  tagCatalogError: string | null;
  onSetPrimaryVariant: () => void;
  onSetVersionStatus: (value: "draft" | "review" | "approved" | "rejected" | "deprecated") => void;
  onSelectVariantId: (value: string) => void;
  onSetVariantStatus: (value: "candidate" | "selected" | "rejected") => void;
  onSetVariantRating: (value: number | null) => void;
  onSetAllVariantsStatus: (value: "candidate" | "selected" | "rejected") => void;
  onReviewNoteChange: (value: string) => void;
  onSaveReviewNote: () => void;
  onCustomTagChange: (value: string) => void;
  onAddCustomTag: () => void;
  onToggleTag: (tagId: string, groupTagIds: string[], exclusive: boolean) => void;
  onZoomChange: (value: number) => void;
  showPreview?: boolean;
};

export function AssetReviewPanel(props: Props) {
  const showPreview = props.showPreview !== false;
  const variants = props.selectedVersion?.variants ?? [];
  const currentIndex = variants.findIndex((v) => v.id === props.selectedVariantId);
  const selectByOffset = (delta: number) => {
    if (variants.length === 0) return;
    const safeIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = (safeIndex + delta + variants.length) % variants.length;
    props.onSelectVariantId(variants[nextIndex].id);
  };

  const helperSpec = props.selectedSpec;
  const helperImage = useMemo(() => {
    if (!props.selectedVariant) return null;
    return props.selectedVariant.alphaPath ?? props.selectedVariant.originalPath ?? null;
  }, [props.selectedVariant]);

  const helperVariants = variants
    .map((v) => v.alphaPath ?? v.originalPath ?? null)
    .filter((path): path is string => Boolean(path));
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

  useEffect(() => {
    setAnimIndex(0);
  }, [props.selectedVariantId]);

  const frameIndex = hasSequence
    ? Math.max(
        0,
        sequenceVersions.findIndex((version) => version.id === props.selectedVersionId),
      )
    : 0;
  const frameLabel = hasSequence
    ? String((props.selectedVersion as any)?.generation?.frameName ?? `frame_${frameIndex + 1}`)
    : "";
  const selectFrameByOffset = (delta: number) => {
    if (!hasSequence) return;
    const count = sequenceVersions.length;
    if (count === 0) return;
    const safeIndex = frameIndex >= 0 ? frameIndex : 0;
    const nextIndex = (safeIndex + delta + count) % count;
    props.onSelectVersionId(sequenceVersions[nextIndex].id);
  };

  const sequenceFramePaths = useMemo(() => {
    if (!hasSequence) return helperVariants;
    return sequenceVersions
      .map((version) => {
        const primary = version.primaryVariantId
          ? version.variants.find((v) => v.id === version.primaryVariantId)
          : null;
        const selected = version.variants.find((v) => v.status === "selected") ?? null;
        const candidate = version.variants[0] ?? null;
        const variant = primary ?? selected ?? candidate;
        return variant?.alphaPath ?? variant?.originalPath ?? null;
      })
      .filter((path): path is string => Boolean(path));
  }, [hasSequence, sequenceVersions, helperVariants]);

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
      <Stack gap="md">
        <Group justify="space-between">
          <Group gap="xs">
            <Text fw={600}>Review</Text>
            <HelpTip
              label="Pick the best variant, tag it, and set a primary for exports/training."
              topicId="review-variants"
            />
          </Group>
          <Button onClick={props.onSetPrimaryVariant} disabled={!props.selectedVariant || props.assetUpdateBusy}>
            Set Primary
          </Button>
        </Group>

        {!props.selectedAsset && <Text size="sm">Pick an asset from the list to review variants.</Text>}

        {props.selectedAsset && props.selectedVersion && (
          <>
            <Text size="xs" c="dimmed">
              version={props.selectedVersion.id} · status={props.selectedVersion.status} · primary=
              {props.selectedVersion.primaryVariantId ?? "n/a"}
              {hasSequence && ` · frame=${frameIndex + 1}/${sequenceVersions.length}`}
            </Text>
            <Group>
              <Select
                label={
                  <Group gap="xs">
                    <span>Version status</span>
                    <HelpTip label="Lifecycle status for the whole version." topicId="ratings-and-status" />
                  </Group>
                }
                data={[
                  { value: "draft", label: "draft" },
                  { value: "review", label: "review" },
                  { value: "approved", label: "approved" },
                  { value: "rejected", label: "rejected" },
                  { value: "deprecated", label: "deprecated" },
                ]}
                value={props.selectedVersion.status}
                onChange={(value: string | null) => props.onSetVersionStatus((value ?? "review") as any)}
                disabled={props.assetUpdateBusy}
              />
            </Group>
            {hasSequence && (
              <Group>
                <Button size="xs" variant="light" onClick={() => selectFrameByOffset(-1)}>
                  Prev frame
                </Button>
                <Select
                  label="Frame"
                  data={sequenceVersions.map((version, index) => {
                    const name = (version as any).generation?.frameName ?? `frame_${index + 1}`;
                    return { value: version.id, label: `#${index + 1} ${name}` };
                  })}
                  value={props.selectedVersionId}
                  onChange={(value: string | null) => props.onSelectVersionId(value ?? "")}
                />
                <Button size="xs" variant="light" onClick={() => selectFrameByOffset(1)}>
                  Next frame
                </Button>
                <Text size="xs" c="dimmed">
                  {frameLabel}
                </Text>
              </Group>
            )}
            <Group>
              <Button size="xs" variant="light" onClick={() => selectByOffset(-1)} disabled={variants.length === 0}>
                Prev
              </Button>
              <Select
                label={
                  <Group gap="xs">
                    <span>Variant</span>
                    <HelpTip label="Switch between generated variants." topicId="review-variants" />
                  </Group>
                }
                data={variants.map((v) => ({ value: v.id, label: v.id }))}
                value={props.selectedVariantId ?? ""}
                onChange={(value: string | null) => props.onSelectVariantId(value ?? "")}
              />
              <Button size="xs" variant="light" onClick={() => selectByOffset(1)} disabled={variants.length === 0}>
                Next
              </Button>
              <Select
                label={
                  <Group gap="xs">
                    <span>Status</span>
                    <HelpTip label="Mark as selected or rejected to manage review flow." topicId="ratings-and-status" />
                  </Group>
                }
                data={[
                  { value: "candidate", label: "candidate" },
                  { value: "selected", label: "selected" },
                  { value: "rejected", label: "rejected" },
                ]}
                value={props.selectedVariant?.status ?? "candidate"}
                onChange={(value: string | null) => props.onSetVariantStatus((value ?? "candidate") as any)}
              />
              <Select
                label={
                  <Group gap="xs">
                    <span>Rating</span>
                    <HelpTip label="Score quality quickly to aid later sorting." topicId="ratings-and-status" />
                  </Group>
                }
                data={["", "0", "1", "2", "3", "4", "5"].map((v) => ({ value: v, label: v === "" ? "rating" : v }))}
                value={props.selectedVariant?.rating?.toString() ?? ""}
                onChange={(value: string | null) => props.onSetVariantRating(value === "" ? null : Number(value))}
              />
            </Group>

            <Group align="flex-end">
              <TextInput
                label={
                  <Group gap="xs">
                    <span>Review note</span>
                    <HelpTip label="Capture why this variant was accepted or rejected." topicId="ratings-and-status" />
                  </Group>
                }
                placeholder="Short rationale (e.g. clean edges, wrong lighting)"
                value={props.reviewNote}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  props.onReviewNoteChange(event.currentTarget.value)
                }
                style={{ flex: 1 }}
              />
              <Button
                variant="light"
                onClick={props.onSaveReviewNote}
                disabled={!props.selectedVariant || props.assetUpdateBusy}
              >
                Save note
              </Button>
            </Group>

            <Group>
              <TextInput
                placeholder="Add custom tag (e.g. quality:blurry)"
                value={props.customTag}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  props.onCustomTagChange(event.currentTarget.value)
                }
                style={{ flex: 1 }}
                label={
                  <Group gap="xs">
                    <span>Custom tag</span>
                    <HelpTip
                      label="Use consistent tags to filter later (quality:*, style:*, usage:*)."
                      topicId="tags-and-catalogs"
                    />
                  </Group>
                }
              />
              <Button
                variant="light"
                onClick={props.onAddCustomTag}
                disabled={!props.selectedVariant || props.assetUpdateBusy}
              >
                Add tag
              </Button>
            </Group>

            {props.tagCatalogError && <Text size="xs">Tags error: {props.tagCatalogError}</Text>}
            {!props.tagCatalog && !props.tagCatalogError && <Text size="xs">Loading tags...</Text>}

            {props.tagCatalog && (
              <Stack gap="xs">
                {props.tagCatalog.groups.map((group) => (
                  <div key={group.id}>
                    <Text size="xs" c="dimmed">
                      {group.label} {group.exclusive ? "(exclusive)" : ""}
                    </Text>
                    <Group gap={6} wrap="wrap">
                      {group.tags.map((tag) => {
                        const active = (props.selectedVariant?.tags ?? []).includes(tag.id);
                        return (
                          <Button
                            key={tag.id}
                            size="xs"
                            variant={active ? "filled" : "light"}
                            color={active ? "indigo" : "gray"}
                            onClick={() =>
                              props.onToggleTag(
                                tag.id,
                                group.tags.map((t) => t.id),
                                Boolean(group.exclusive),
                              )
                            }
                            disabled={!props.selectedVariant || props.assetUpdateBusy}
                          >
                            {tag.label}
                          </Button>
                        );
                      })}
                    </Group>
                  </div>
                ))}
              </Stack>
            )}

            {props.selectedVariant && showPreview && (
              <Stack gap="xs">
                <Group justify="space-between">
                  <Group gap="xs">
                    <Text size="sm" fw={600}>
                      Preview
                    </Text>
                    <HelpTip label="Use zoom to check edges and alpha." topicId="review-variants" />
                  </Group>
                  <Group gap="xs">
                    <Button
                      size="xs"
                      variant="light"
                      onClick={() => selectByOffset(-1)}
                      disabled={variants.length === 0}
                    >
                      Prev
                    </Button>
                    <Button
                      size="xs"
                      variant="light"
                      onClick={() => selectByOffset(1)}
                      disabled={variants.length === 0}
                    >
                      Next
                    </Button>
                    <Button
                      size="xs"
                      color="green"
                      variant="light"
                      onClick={() => props.onSetVariantStatus("selected")}
                      disabled={!props.selectedVariant || props.assetUpdateBusy}
                    >
                      Select
                    </Button>
                    <Button
                      size="xs"
                      color="red"
                      variant="light"
                      onClick={() => props.onSetVariantStatus("rejected")}
                      disabled={!props.selectedVariant || props.assetUpdateBusy}
                    >
                      Reject
                    </Button>
                    <Text size="xs" c="dimmed">
                      Zoom
                    </Text>
                    <HelpTip label="Zoom in to inspect edges and detail." topicId="review-variants" />
                    <Slider value={props.zoom} onChange={props.onZoomChange} min={0.5} max={3} step={0.1} w={160} />
                  </Group>
                </Group>
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
                {(isTileableSpec || isAnimationSpec) && (
                  <Stack gap="xs">
                    <Text size="sm" fw={600}>
                      Helpers
                    </Text>
                    {isAnimationSpec && variants.length > 1 && (
                      <Group gap="xs">
                        <Button
                          size="xs"
                          variant="light"
                          color="green"
                          onClick={() => props.onSetAllVariantsStatus("selected")}
                          disabled={props.assetUpdateBusy}
                        >
                          Accept variants
                        </Button>
                        <Button
                          size="xs"
                          variant="light"
                          color="red"
                          onClick={() => props.onSetAllVariantsStatus("rejected")}
                          disabled={props.assetUpdateBusy}
                        >
                          Reject variants
                        </Button>
                        {!hasSequence && (
                          <Text size="xs" c="dimmed">
                            Treat variants as frames for this animation
                          </Text>
                        )}
                      </Group>
                    )}
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
            )}
          </>
        )}
      </Stack>
    </Card>
  );
}
