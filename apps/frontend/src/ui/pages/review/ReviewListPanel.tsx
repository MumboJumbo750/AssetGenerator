import React, { useRef } from "react";
import { Badge, Button, Card, Group, ScrollArea, Stack, Text } from "@mantine/core";

import type { Asset, AssetSpec } from "../../api";

type Props = {
  assets: Asset[];
  specsById: Map<string, AssetSpec>;
  selectedAssetId: string;
  onSelectAsset: (id: string) => void;
  layout?: "vertical" | "horizontal";
};

type PreviewVariant = { path: string | null; label: string };

function getPreview(asset: Asset): PreviewVariant {
  const versions = asset.versions ?? [];
  const hasFrames = versions.some((version) => Number.isFinite(Number((version as any).generation?.frameIndex)));
  const sorted = [...versions].sort((a, b) => {
    const aIndex = Number((a as any).generation?.frameIndex);
    const bIndex = Number((b as any).generation?.frameIndex);
    const aHas = Number.isFinite(aIndex);
    const bHas = Number.isFinite(bIndex);
    if (hasFrames) {
      if (aHas && bHas && aIndex !== bIndex) return aIndex - bIndex;
      if (aHas && !bHas) return -1;
      if (!aHas && bHas) return 1;
    }
    return a.createdAt.localeCompare(b.createdAt);
  });
  const latest = hasFrames ? sorted[0] : (sorted[sorted.length - 1] ?? null);
  const variant = latest?.variants?.find((v) => v.id === latest?.primaryVariantId) ?? latest?.variants?.[0] ?? null;
  const path = variant?.alphaPath ?? variant?.originalPath ?? null;
  return { path, label: variant?.id ?? "n/a" };
}

export function ReviewListPanel(props: Props) {
  const layout = props.layout ?? "vertical";
  const isHorizontal = layout === "horizontal";
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const scrollBy = (delta: number) => {
    const el = viewportRef.current;
    if (!el) return;
    el.scrollBy({ left: delta, behavior: "smooth" });
  };

  return (
    <Card withBorder radius="md" p="md">
      <Stack gap="md">
        <Group justify="space-between">
          <Group gap="xs">
            <Text fw={600}>Review Queue</Text>
          </Group>
          <Group gap="xs">
            {isHorizontal && (
              <>
                <Button size="xs" variant="light" onClick={() => scrollBy(-260)}>
                  Left
                </Button>
                <Button size="xs" variant="light" onClick={() => scrollBy(260)}>
                  Right
                </Button>
              </>
            )}
            <Badge variant="light">{props.assets.length}</Badge>
          </Group>
        </Group>
        {props.assets.length === 0 && (
          <Text size="sm" c="dimmed">
            No reviewable assets. Generate assets to populate this list.
          </Text>
        )}
        <ScrollArea
          h={isHorizontal ? undefined : 600}
          offsetScrollbars
          type="auto"
          scrollbarSize={6}
          viewportRef={viewportRef}
        >
          <Group
            gap="xs"
            wrap={isHorizontal ? "nowrap" : "wrap"}
            align="stretch"
            style={{ flexDirection: isHorizontal ? "row" : "column" }}
          >
            {props.assets.map((asset) => {
              const spec = props.specsById.get(asset.specId) ?? null;
              const preview = getPreview(asset);
              return (
                <Card
                  key={asset.id}
                  withBorder
                  radius="sm"
                  p="sm"
                  style={{
                    cursor: "pointer",
                    borderColor: asset.id === props.selectedAssetId ? "#6d7cff" : undefined,
                    minWidth: isHorizontal ? 220 : undefined,
                  }}
                  onClick={() => props.onSelectAsset(asset.id)}
                >
                  <Group align="center" gap="md" wrap="nowrap">
                    <div
                      className="ag-checkerboard"
                      style={{
                        width: 72,
                        height: 72,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {preview.path ? (
                        <img
                          src={`/data/${preview.path}`}
                          alt="preview"
                          style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                        />
                      ) : (
                        <Text size="xs" c="dimmed">
                          no image
                        </Text>
                      )}
                    </div>
                    <Stack gap={2} style={{ flex: 1 }}>
                      <Text fw={600} size="sm" lineClamp={2}>
                        {spec?.title ?? asset.specId}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {spec?.assetType ?? "asset"} · {preview.label}
                      </Text>
                    </Stack>
                  </Group>
                </Card>
              );
            })}
          </Group>
        </ScrollArea>
      </Stack>
    </Card>
  );
}
