import React from "react";
import { Button, Card, Checkbox, Group, Image, ScrollArea, Stack, Text } from "@mantine/core";
import { Link } from "react-router-dom";

import type { AssetListItem } from "../../types/viewModels";

type Props = {
  assets: AssetListItem[];
  assetsTotal: number;
  filteredTotal: number;
  selectedAssetId: string;
  onSelectAsset: (id: string) => void;
  isSelected: (id: string) => boolean;
  onToggleSelection: (id: string) => void;
  onClearFilters: () => void;
};

export function AssetListPanel(props: Props) {
  return (
    <Card withBorder radius="md" p="md">
      <Stack gap="md">
        {props.assetsTotal === 0 && (
          <Card withBorder radius="md" p="md">
            <Stack gap="xs">
              <Text fw={600}>No assets yet</Text>
              <Text size="sm" c="dimmed">
                Create specs and queue generation jobs to populate this list.
              </Text>
              <Group>
                <Button component={Link} to="/specs">
                  Go to Specs
                </Button>
                <Button component={Link} to="/jobs" variant="light">
                  View jobs
                </Button>
              </Group>
            </Stack>
          </Card>
        )}
        {props.assetsTotal > 0 && props.filteredTotal === 0 && (
          <Card withBorder radius="md" p="md">
            <Stack gap="xs">
              <Text fw={600}>No matches</Text>
              <Text size="sm" c="dimmed">
                Try clearing filters or searching by asset id.
              </Text>
              <Group>
                <Button variant="light" onClick={props.onClearFilters}>
                  Clear filters
                </Button>
              </Group>
            </Stack>
          </Card>
        )}
        <ScrollArea h={520}>
          <Stack gap="xs">
            {props.assets.map((asset) => (
              <Card
                key={asset.id}
                withBorder
                radius="sm"
                p="sm"
                style={{
                  cursor: "pointer",
                  borderColor: asset.id === props.selectedAssetId ? "#6d7cff" : undefined,
                  background: props.isSelected(asset.id) ? "rgba(124, 77, 255, 0.12)" : undefined,
                }}
                onClick={() => props.onSelectAsset(asset.id)}
              >
                <Group justify="space-between" wrap="nowrap">
                  <Checkbox
                    checked={props.isSelected(asset.id)}
                    onChange={() => props.onToggleSelection(asset.id)}
                    onClick={(event: React.MouseEvent<HTMLInputElement>) => event.stopPropagation()}
                  />
                  <div>
                    <Text fw={600}>{asset.id}</Text>
                    <Text size="xs" c="dimmed">
                      versions={asset.versionsCount} · {asset.assetType ?? "n/a"} · {asset.latestStatus ?? "n/a"}
                    </Text>
                  </div>
                  {asset.thumbnailPath && (
                    <Image src={`/data/${asset.thumbnailPath}`} w={64} h={64} fit="contain" radius="sm" />
                  )}
                </Group>
              </Card>
            ))}
            {props.assetsTotal === 0 && (
              <Text size="sm">Assets are created by the worker after generation jobs finish.</Text>
            )}
          </Stack>
        </ScrollArea>
      </Stack>
    </Card>
  );
}
