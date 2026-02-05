import React, { useEffect, useMemo, useState } from "react";
import { Button, Card, Group, Modal, ScrollArea, Stack, Text } from "@mantine/core";

import { setPrimaryVariant, updateAssetVariant, type Asset } from "../../api";

type AssetVersion = Asset["versions"][number];
type AssetVariant = Asset["versions"][number]["variants"][number];

type Props = {
  open: boolean;
  onClose: () => void;
  projectId: string;
  assetId: string;
  sequenceVersions: AssetVersion[];
  selectedSpec: {
    output?: { animation?: { fps?: number } };
  } | null;
  onRefresh: () => Promise<void>;
};

type DragPayload = { versionId: string; variantId: string };

function pickDefaultVariant(version: AssetVersion) {
  return (
    version.primaryVariantId ??
    version.variants.find((v) => v.status === "selected")?.id ??
    version.variants[0]?.id ??
    ""
  );
}

export function AnimationSequenceModal(props: Props) {
  const [selectionByVersionId, setSelectionByVersionId] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [animIndex, setAnimIndex] = useState(0);
  const [animPlaying, setAnimPlaying] = useState(true);
  const animFps = props.selectedSpec?.output?.animation?.fps ?? 8;

  useEffect(() => {
    if (!props.open) return;
    const next: Record<string, string> = {};
    for (const version of props.sequenceVersions) {
      next[version.id] = pickDefaultVariant(version);
    }
    setSelectionByVersionId(next);
    setAnimIndex(0);
  }, [props.open, props.sequenceVersions]);

  const orderedFrames = useMemo(() => props.sequenceVersions ?? [], [props.sequenceVersions]);

  const sequenceFramePaths = useMemo(() => {
    return orderedFrames
      .map((version) => {
        const chosenId = selectionByVersionId[version.id];
        const chosen =
          (chosenId && version.variants.find((v) => v.id === chosenId)) ??
          (version.primaryVariantId ? version.variants.find((v) => v.id === version.primaryVariantId) : null) ??
          version.variants.find((v) => v.status === "selected") ??
          version.variants[0] ??
          null;
        return chosen?.alphaPath ?? chosen?.originalPath ?? null;
      })
      .filter((path): path is string => Boolean(path));
  }, [orderedFrames, selectionByVersionId]);

  useEffect(() => {
    if (!props.open) return;
    if (!animPlaying || sequenceFramePaths.length < 2) return;
    const interval = Math.max(80, Math.round(1000 / animFps));
    const t = window.setInterval(() => {
      setAnimIndex((prev) => (prev + 1) % sequenceFramePaths.length);
    }, interval);
    return () => window.clearInterval(t);
  }, [props.open, animPlaying, sequenceFramePaths.length, animFps]);

  const onSelectVariant = (versionId: string, variantId: string) => {
    setSelectionByVersionId((prev) => ({ ...prev, [versionId]: variantId }));
  };

  const onDrop = (versionId: string, event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const raw = event.dataTransfer.getData("text/plain");
    if (!raw) return;
    try {
      const data = JSON.parse(raw) as DragPayload;
      if (data.versionId !== versionId) return;
      onSelectVariant(versionId, data.variantId);
    } catch {
      // ignore
    }
  };

  const onDragStart = (versionId: string, variant: AssetVariant) => (event: React.DragEvent) => {
    const payload: DragPayload = { versionId, variantId: variant.id };
    event.dataTransfer.setData("text/plain", JSON.stringify(payload));
    event.dataTransfer.effectAllowed = "move";
  };

  const handleSave = async () => {
    if (!props.projectId || !props.assetId) return;
    setSaving(true);
    try {
      for (const version of orderedFrames) {
        const chosenId = selectionByVersionId[version.id] ?? pickDefaultVariant(version);
        if (!chosenId) continue;
        await updateAssetVariant(props.projectId, props.assetId, version.id, chosenId, {
          status: "selected",
        });
        await setPrimaryVariant(props.projectId, props.assetId, version.id, chosenId);
      }
      await props.onRefresh();
      props.onClose();
    } catch {
      // ignore for now; errors surface in the global error banner
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal opened={props.open} onClose={props.onClose} title="Arrange animation frames" size="xl">
      <Stack gap="md">
        <Group justify="space-between">
          <Group gap="xs">
            <Button size="xs" variant="light" onClick={() => setAnimPlaying((v) => !v)}>
              {animPlaying ? "Pause" : "Play"}
            </Button>
            <Text size="xs" c="dimmed">
              Previewing {sequenceFramePaths.length > 0 ? animIndex + 1 : 0}/{sequenceFramePaths.length} @ {animFps}fps
            </Text>
          </Group>
          <Button onClick={handleSave} loading={saving}>
            Save & Apply
          </Button>
        </Group>

        {sequenceFramePaths.length > 0 && (
          <div className="ag-checkerboard ag-preview-surface">
            <img src={`/data/${sequenceFramePaths[animIndex]}`} className="ag-preview-image" alt="animation preview" />
          </div>
        )}

        <ScrollArea h={420} offsetScrollbars>
          <Stack gap="md">
            {orderedFrames.map((version, index) => {
              const chosenId = selectionByVersionId[version.id] ?? pickDefaultVariant(version);
              const chosen =
                (chosenId && version.variants.find((v) => v.id === chosenId)) ??
                (version.primaryVariantId ? version.variants.find((v) => v.id === version.primaryVariantId) : null) ??
                version.variants[0] ??
                null;
              const frameName = (version as any).generation?.frameName ?? `frame_${index + 1}`;
              return (
                <Card key={version.id} withBorder radius="md" p="md">
                  <Stack gap="sm">
                    <Group justify="space-between">
                      <Text fw={600}>
                        Frame {index + 1}: {frameName}
                      </Text>
                      <Text size="xs" c="dimmed">
                        variants: {version.variants.length}
                      </Text>
                    </Group>
                    <div
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => onDrop(version.id, event)}
                      className="ag-checkerboard ag-preview-surface"
                      style={{ height: 180 }}
                    >
                      {chosen?.alphaPath || chosen?.originalPath ? (
                        <img
                          src={`/data/${chosen?.alphaPath ?? chosen?.originalPath}`}
                          className="ag-preview-image"
                          alt="selected frame"
                        />
                      ) : (
                        <Text size="sm" c="dimmed">
                          Drop a variant here
                        </Text>
                      )}
                    </div>
                    <Group gap="xs" wrap="wrap">
                      {version.variants.map((variant) => {
                        const path = variant.alphaPath ?? variant.originalPath;
                        if (!path) return null;
                        const active = variant.id === chosenId;
                        return (
                          <Card
                            key={variant.id}
                            withBorder
                            radius="sm"
                            p={4}
                            style={{
                              cursor: "grab",
                              borderColor: active ? "#6d7cff" : undefined,
                              width: 72,
                              height: 72,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                            onClick={() => onSelectVariant(version.id, variant.id)}
                            draggable
                            onDragStart={onDragStart(version.id, variant)}
                          >
                            <img
                              src={`/data/${path}`}
                              alt="variant"
                              style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                            />
                          </Card>
                        );
                      })}
                    </Group>
                  </Stack>
                </Card>
              );
            })}
          </Stack>
        </ScrollArea>
      </Stack>
    </Modal>
  );
}
