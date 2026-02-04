import React from "react";
import { Badge, Button, Card, Group, ScrollArea, SimpleGrid, Stack, Text } from "@mantine/core";

import type { AtlasRecord } from "../../api";

type ExportableAsset = {
  id: string;
  title: string;
  previewPath: string;
};

type Props = {
  exportableAssets: ExportableAsset[];
  atlases: AtlasRecord[];
  atlasError: string | null;
  isAssetSelected: (id: string) => boolean;
  onToggleAsset: (id: string) => void;
  onSelectAllAssets: () => void;
  onClearAssets: () => void;
  isAtlasSelected: (id: string) => boolean;
  onToggleAtlas: (id: string) => void;
  onSelectAllAtlases: () => void;
  onClearAtlases: () => void;
};

export function ExportSelectionPanel(props: Props) {
  return (
    <SimpleGrid cols={{ base: 1, lg: 2 }}>
      <Card withBorder radius="md" p="md">
        <Stack gap="md">
          <Group justify="space-between">
            <Text fw={600}>Assets to export</Text>
            <Badge variant="light">{props.exportableAssets.length}</Badge>
          </Group>
          <Group>
            <Button size="xs" variant="light" onClick={props.onSelectAllAssets}>
              Select all
            </Button>
            <Button size="xs" variant="light" onClick={props.onClearAssets}>
              Clear
            </Button>
          </Group>
          <ScrollArea h={280}>
            <Stack gap="xs">
              {props.exportableAssets.map((asset) => (
                <Card key={asset.id} withBorder radius="sm" p="sm">
                  <Group justify="space-between">
                    <Group>
                      <img src={`/data/${asset.previewPath}`} style={{ width: 40, height: 40, objectFit: "contain", borderRadius: 8 }} />
                      <div>
                        <Text size="sm" fw={600}>
                          {asset.title}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {asset.id}
                        </Text>
                      </div>
                    </Group>
                    <Button size="xs" variant={props.isAssetSelected(asset.id) ? "filled" : "light"} onClick={() => props.onToggleAsset(asset.id)}>
                      {props.isAssetSelected(asset.id) ? "Selected" : "Select"}
                    </Button>
                  </Group>
                </Card>
              ))}
              {props.exportableAssets.length === 0 && <Text size="sm">Approve assets to enable exports.</Text>}
            </Stack>
          </ScrollArea>
        </Stack>
      </Card>

      <Card withBorder radius="md" p="md">
        <Stack gap="md">
          <Group justify="space-between">
            <Text fw={600}>Atlases to export</Text>
            <Badge variant="light">{props.atlases.length}</Badge>
          </Group>
          {props.atlasError && <Text size="xs">Atlas error: {props.atlasError}</Text>}
          <Group>
            <Button size="xs" variant="light" onClick={props.onSelectAllAtlases}>
              Select all
            </Button>
            <Button size="xs" variant="light" onClick={props.onClearAtlases}>
              Clear
            </Button>
          </Group>
          <ScrollArea h={280}>
            <Stack gap="xs">
              {props.atlases.map((atlas) => (
                <Card key={atlas.id} withBorder radius="sm" p="sm">
                  <Group justify="space-between">
                    <Group>
                      <img src={`/data/${atlas.imagePath}`} style={{ width: 40, height: 40, objectFit: "contain", borderRadius: 8 }} />
                      <div>
                        <Text size="sm" fw={600}>
                          {atlas.id}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {atlas.frames.length} frames
                        </Text>
                      </div>
                    </Group>
                    <Button size="xs" variant={props.isAtlasSelected(atlas.id) ? "filled" : "light"} onClick={() => props.onToggleAtlas(atlas.id)}>
                      {props.isAtlasSelected(atlas.id) ? "Selected" : "Select"}
                    </Button>
                  </Group>
                </Card>
              ))}
              {props.atlases.length === 0 && <Text size="sm">Create atlases to export animations or UI states.</Text>}
            </Stack>
          </ScrollArea>
        </Stack>
      </Card>
    </SimpleGrid>
  );
}
