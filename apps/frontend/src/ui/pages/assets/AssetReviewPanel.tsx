import React from "react";
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
  onReviewNoteChange: (value: string) => void;
  onSaveReviewNote: () => void;
  onCustomTagChange: (value: string) => void;
  onAddCustomTag: () => void;
  onToggleTag: (tagId: string, groupTagIds: string[], exclusive: boolean) => void;
  onZoomChange: (value: number) => void;
};

export function AssetReviewPanel(props: Props) {
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
            <Group>
              <Select
                label={
                  <Group gap="xs">
                    <span>Variant</span>
                    <HelpTip label="Switch between generated variants." topicId="review-variants" />
                  </Group>
                }
                data={props.selectedVersion.variants.map((v) => ({ value: v.id, label: v.id }))}
                value={props.selectedVariantId ?? ""}
                onChange={(value: string | null) => props.onSelectVariantId(value ?? "")}
              />
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

            {props.selectedVariant && (
              <Stack gap="xs">
                <Group justify="space-between">
                  <Group gap="xs">
                    <Text size="sm" fw={600}>
                      Preview
                    </Text>
                    <HelpTip label="Use zoom to check edges and alpha." topicId="review-variants" />
                  </Group>
                  <Group gap="xs">
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
              </Stack>
            )}
          </>
        )}
      </Stack>
    </Card>
  );
}
