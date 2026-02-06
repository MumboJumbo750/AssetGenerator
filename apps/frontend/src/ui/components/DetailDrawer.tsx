import React from "react";
import { Badge, Button, Drawer, Group, Image, Stack, Text } from "@mantine/core";

type DetailDrawerProps = {
  opened: boolean;
  title: string;
  subtitle?: string;
  imagePath?: string;
  badges?: string[];
  details?: Array<{ label: string; value: string }>;
  onClose: () => void;
  actionLabel?: string;
  onAction?: () => void;
  extraContent?: React.ReactNode;
};

function toDataUrl(pathValue?: string) {
  if (!pathValue?.trim()) return "";
  if (pathValue.startsWith("http")) return pathValue;
  if (pathValue.startsWith("/data/")) return pathValue;
  if (pathValue.startsWith("data/")) return `/${pathValue}`;
  return `/data/${pathValue}`;
}

export function DetailDrawer({
  opened,
  title,
  subtitle,
  imagePath,
  badges,
  details,
  onClose,
  actionLabel,
  onAction,
  extraContent,
}: DetailDrawerProps) {
  return (
    <Drawer opened={opened} onClose={onClose} position="right" title="Details" size="lg">
      <Stack>
        <Text fw={600}>{title}</Text>
        {subtitle && (
          <Text size="sm" c="dimmed">
            {subtitle}
          </Text>
        )}
        {imagePath && <Image src={toDataUrl(imagePath)} alt={title} fit="contain" />}
        <Group>
          {(badges ?? []).map((badge) => (
            <Badge key={badge} variant="light">
              {badge}
            </Badge>
          ))}
        </Group>
        <Stack gap={4}>
          {(details ?? []).map((entry) => (
            <Text key={entry.label} size="sm">
              <strong>{entry.label}:</strong> {entry.value}
            </Text>
          ))}
        </Stack>
        {extraContent}
        {actionLabel && onAction && <Button onClick={onAction}>{actionLabel}</Button>}
      </Stack>
    </Drawer>
  );
}
