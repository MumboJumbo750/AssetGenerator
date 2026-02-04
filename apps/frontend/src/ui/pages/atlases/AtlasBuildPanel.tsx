import React from "react";
import { Badge, Button, Card, Group, Image, NumberInput, ScrollArea, Select, Stack, Text, TextInput } from "@mantine/core";

import type { AtlasRecord } from "../../api";

type FrameEntry = {
  key: string;
  path: string;
  assetId: string;
  versionId: string;
  variantId: string;
};

type Props = {
  approvedCandidates: Array<{ assetId: string; versionId: string; variantId: string; path: string }>;
  frames: FrameEntry[];
  atlasId: string;
  padding: number;
  maxSize: number;
  powerOfTwo: boolean;
  trim: boolean;
  extrude: number;
  sort: string;
  atlases: AtlasRecord[];
  onAddFrame: (candidate: { assetId: string; versionId: string; variantId: string; path: string }) => void;
  onUpdateFrameKey: (index: number, value: string) => void;
  onMoveFrame: (index: number, dir: -1 | 1) => void;
  onRemoveFrame: (index: number) => void;
  onAtlasIdChange: (value: string) => void;
  onPaddingChange: (value: number) => void;
  onMaxSizeChange: (value: number) => void;
  onPowerOfTwoChange: (value: boolean) => void;
  onTrimChange: (value: boolean) => void;
  onExtrudeChange: (value: number) => void;
  onSortChange: (value: string) => void;
  onCreateAtlas: () => void;
};

export function AtlasBuildPanel(props: Props) {
  return (
    <Card withBorder radius="md" p="md">
      <Stack gap="md">
        <Group justify="space-between">
          <Text fw={600}>Approved variants</Text>
          <Badge variant="light">{props.approvedCandidates.length}</Badge>
        </Group>
        <ScrollArea h={260}>
          <Stack gap="xs">
            {props.approvedCandidates.map((candidate) => (
              <Card key={`${candidate.assetId}-${candidate.variantId}`} withBorder radius="sm" p="sm">
                <Group justify="space-between">
                  <Group>
                    <Image src={`/data/${candidate.path}`} w={48} h={48} fit="contain" radius="sm" />
                    <div>
                      <Text size="sm" fw={600}>
                        {candidate.assetId}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {candidate.variantId}
                      </Text>
                    </div>
                  </Group>
                  <Button size="xs" variant="light" onClick={() => props.onAddFrame(candidate)}>
                    Add frame
                  </Button>
                </Group>
              </Card>
            ))}
            {props.approvedCandidates.length === 0 && <Text size="sm">Approve variants to enable atlas packing.</Text>}
          </Stack>
        </ScrollArea>
        <Group gap="xs">
          <NumberInput label="Padding" value={props.padding} onChange={(value) => props.onPaddingChange(Number(value) || 0)} min={0} max={32} />
          <NumberInput label="Max size" value={props.maxSize} onChange={(value) => props.onMaxSizeChange(Number(value) || 512)} min={256} step={256} />
        </Group>
        <Group gap="xs">
          <Select
            label="POT"
            data={[
              { value: "true", label: "on" },
              { value: "false", label: "off" }
            ]}
            value={props.powerOfTwo ? "true" : "false"}
            onChange={(value: string | null) => props.onPowerOfTwoChange(value !== "false")}
          />
          <Select
            label="Trim"
            data={[
              { value: "true", label: "on" },
              { value: "false", label: "off" }
            ]}
            value={props.trim ? "true" : "false"}
            onChange={(value: string | null) => props.onTrimChange(value !== "false")}
          />
          <NumberInput label="Extrude" value={props.extrude} onChange={(value) => props.onExtrudeChange(Number(value) || 0)} min={0} max={8} />
          <Select
            label="Sort"
            data={[
              { value: "area", label: "area" },
              { value: "maxside", label: "max side" },
              { value: "w", label: "width" },
              { value: "h", label: "height" },
              { value: "name", label: "name" },
              { value: "none", label: "none" }
            ]}
            value={props.sort}
            onChange={(value: string | null) => props.onSortChange(value ?? "area")}
          />
        </Group>
        <Text size="xs" c="dimmed">
          Use smaller padding for tighter packing; enable trim/extrude for cleaner edges; increase max size if the atlas overflows.
        </Text>
        <TextInput
          label="Atlas ID (optional)"
          placeholder="leave blank for auto"
          value={props.atlasId}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => props.onAtlasIdChange(event.currentTarget.value)}
        />
        <Group>
          <Button onClick={props.onCreateAtlas} disabled={props.frames.length === 0}>
            Create atlas
          </Button>
        </Group>
        <Card withBorder radius="md" p="md">
          <Stack gap="md">
            <Group justify="space-between">
              <Text fw={600}>Frames in atlas</Text>
              <Badge variant="light">{props.frames.length}</Badge>
            </Group>
            <ScrollArea h={260}>
              <Stack gap="xs">
                {props.frames.map((frame, index) => (
                  <Card key={`${frame.assetId}-${frame.variantId}`} withBorder radius="sm" p="sm">
                    <Group justify="space-between">
                      <Group>
                        <Image src={`/data/${frame.path}`} w={48} h={48} fit="contain" radius="sm" />
                        <TextInput value={frame.key} onChange={(event: React.ChangeEvent<HTMLInputElement>) => props.onUpdateFrameKey(index, event.currentTarget.value)} />
                      </Group>
                      <Group>
                        <Button size="xs" variant="light" onClick={() => props.onMoveFrame(index, -1)}>
                          Up
                        </Button>
                        <Button size="xs" variant="light" onClick={() => props.onMoveFrame(index, 1)}>
                          Down
                        </Button>
                        <Button size="xs" color="red" variant="light" onClick={() => props.onRemoveFrame(index)}>
                          Remove
                        </Button>
                      </Group>
                    </Group>
                  </Card>
                ))}
                {props.frames.length === 0 && <Text size="sm">Add frames from approved variants.</Text>}
              </Stack>
            </ScrollArea>
          </Stack>
        </Card>
      </Stack>
    </Card>
  );
}
