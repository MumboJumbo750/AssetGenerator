import React from "react";
import { Badge, Card, Group, Image, SimpleGrid, Stack, Text } from "@mantine/core";

export type ImageGridItem = {
  id: string;
  title: string;
  subtitle?: string;
  imagePath?: string;
  badges?: string[];
  meta?: string;
};

function toDataUrl(pathValue?: string) {
  if (!pathValue?.trim()) return "";
  if (pathValue.startsWith("http")) return pathValue;
  if (pathValue.startsWith("/data/")) return pathValue;
  if (pathValue.startsWith("data/")) return `/${pathValue}`;
  return `/data/${pathValue}`;
}

export function ImageGrid({ items, onSelect }: { items: ImageGridItem[]; onSelect: (itemId: string) => void }) {
  return (
    <SimpleGrid cols={{ base: 1, sm: 2, md: 3, xl: 4 }}>
      {items.map((item) => (
        <Card
          key={item.id}
          withBorder
          radius="md"
          p="sm"
          component="button"
          type="button"
          className="ag-library-card ag-card-tier-1"
          onClick={() => onSelect(item.id)}
          aria-label={`Open details for ${item.title}`}
          style={{ cursor: "pointer" }}
        >
          <Stack gap="xs">
            <div className="ag-library-thumb ag-image-first">
              {item.imagePath ? (
                <Image src={toDataUrl(item.imagePath)} alt={item.title} fit="cover" h={180} />
              ) : (
                <Text size="xs" c="dimmed">
                  No preview
                </Text>
              )}
              <div className="ag-image-overlay">
                <Text size="xs" className="ag-image-overlay-title">
                  {item.title}
                </Text>
                {item.subtitle && (
                  <Text size="xs" className="ag-image-overlay-subtitle">
                    {item.subtitle}
                  </Text>
                )}
              </div>
            </div>
            <Text fw={600} lineClamp={1}>
              {item.title}
            </Text>
            {item.subtitle && (
              <Text size="xs" c="dimmed" lineClamp={1}>
                {item.subtitle}
              </Text>
            )}
            <Group justify="space-between">
              <Group gap={6}>
                {(item.badges ?? []).map((badge) => (
                  <Badge key={badge} variant="light" size="sm">
                    {badge}
                  </Badge>
                ))}
              </Group>
              {item.meta && (
                <Text size="xs" c="dimmed">
                  {item.meta}
                </Text>
              )}
            </Group>
          </Stack>
        </Card>
      ))}
    </SimpleGrid>
  );
}
