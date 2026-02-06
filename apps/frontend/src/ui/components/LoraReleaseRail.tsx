import React from "react";
import { Badge, Button, Card, Group, Stack, Text } from "@mantine/core";

import type { LoraRelease } from "../api";

type LoraReleaseRailProps = {
  releases: LoraRelease[];
  activeReleaseId?: string;
  onSetStatus: (releaseId: string, status: LoraRelease["status"]) => void;
  onActivateRender: (releaseId: string) => void;
  busy?: boolean;
};

export function LoraReleaseRail({
  releases,
  activeReleaseId,
  onSetStatus,
  onActivateRender,
  busy,
}: LoraReleaseRailProps) {
  const sorted = [...releases].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

  return (
    <Stack gap="xs">
      <Text fw={600}>Release rail</Text>
      {sorted.length === 0 && (
        <Text size="sm" c="dimmed">
          No releases.
        </Text>
      )}
      {sorted.map((release) => {
        const isActive = release.id === activeReleaseId;
        return (
          <Card key={release.id} withBorder radius="sm" p="sm">
            <Stack gap="xs">
              <Group justify="space-between">
                <Group gap="xs">
                  <Text fw={600}>{release.id}</Text>
                  <Badge variant="light" color={release.status === "approved" ? "green" : "gray"}>
                    {release.status}
                  </Badge>
                  {isActive && (
                    <Badge variant="light" color="blue">
                      active
                    </Badge>
                  )}
                </Group>
                <Text size="xs" c="dimmed">
                  {release.createdAt.slice(0, 10)}
                </Text>
              </Group>
              <Group>
                {(["candidate", "approved", "deprecated"] as const).map((status) => (
                  <Button
                    key={status}
                    size="compact-xs"
                    variant={release.status === status ? "filled" : "light"}
                    onClick={() => onSetStatus(release.id, status)}
                    disabled={busy}
                  >
                    {status}
                  </Button>
                ))}
                <Button
                  size="compact-sm"
                  color="green"
                  onClick={() => onActivateRender(release.id)}
                  disabled={busy || release.status !== "approved"}
                >
                  Activate + Render
                </Button>
              </Group>
            </Stack>
          </Card>
        );
      })}
    </Stack>
  );
}
