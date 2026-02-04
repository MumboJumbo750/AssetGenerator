import React from "react";
import { Button, Card, Group, NumberInput, ScrollArea, Select, Stack, Text, TextInput } from "@mantine/core";

import { HelpTip } from "../../components/HelpTip";
import type { AtlasRecord } from "../../api";

type Props = {
  selectedAtlas: AtlasRecord | null;
  animationName: string;
  animationFps: number;
  animationLoop: boolean;
  animationFrames: string[];
  animationSpecId: string;
  specs: Array<{ id: string; title: string }>;
  onAnimationNameChange: (value: string) => void;
  onAnimationFpsChange: (value: number) => void;
  onAnimationLoopChange: (value: boolean) => void;
  onAddFrame: (frameId: string) => void;
  onClearFrames: () => void;
  onMoveFrame: (index: number, dir: -1 | 1) => void;
  onRemoveFrame: (index: number) => void;
  onAnimationSpecIdChange: (value: string) => void;
  onSaveAnimation: () => void;
  onUpdatePivot: (frameId: string, axis: "x" | "y", value: number) => void;
  onSavePivots: () => void;
  animationCanvasRef: React.RefObject<HTMLCanvasElement>;
};

export function AnimationPanel(props: Props) {
  return (
    <Card withBorder radius="md" p="md">
      <Stack gap="md">
        <Text fw={600}>Animation metadata</Text>
        {props.selectedAtlas && (
          <>
            <Card withBorder radius="md" p="md">
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text fw={600}>Frame pivots</Text>
                  <HelpTip label="Set per-frame pivot/origin for animation alignment." topicId="atlas-and-animation" />
                </Group>
                <ScrollArea h={160}>
                  <Stack gap="xs">
                    {props.selectedAtlas.frames.map((frame) => (
                      <Group key={frame.id} justify="space-between">
                        <Text size="sm">{frame.id}</Text>
                        <Group gap="xs">
                          <NumberInput
                            label="X"
                            value={frame.pivot?.x ?? 0.5}
                            onChange={(value) => props.onUpdatePivot(frame.id, "x", Number(value) || 0)}
                            min={0}
                            max={1}
                            step={0.05}
                            w={90}
                          />
                          <NumberInput
                            label="Y"
                            value={frame.pivot?.y ?? 0.5}
                            onChange={(value) => props.onUpdatePivot(frame.id, "y", Number(value) || 0)}
                            min={0}
                            max={1}
                            step={0.05}
                            w={90}
                          />
                        </Group>
                      </Group>
                    ))}
                  </Stack>
                </ScrollArea>
                <Text size="xs" c="dimmed">
                  Pivot coordinates are normalized (0–1) within each frame.
                </Text>
                <Group>
                  <Button variant="light" onClick={props.onSavePivots}>
                    Save pivots
                  </Button>
                </Group>
              </Stack>
            </Card>
            <Group grow>
              <TextInput label="Animation name" value={props.animationName} onChange={(event) => props.onAnimationNameChange(event.currentTarget.value)} />
              <NumberInput label="FPS" value={props.animationFps} onChange={(value) => props.onAnimationFpsChange(Number(value) || 1)} min={1} />
              <Select
                label="Loop"
                data={[
                  { value: "true", label: "loop" },
                  { value: "false", label: "once" }
                ]}
                value={props.animationLoop ? "true" : "false"}
                onChange={(value: string | null) => props.onAnimationLoopChange(value !== "false")}
              />
            </Group>
            <Group>
              <Select
                label="Add frame"
                placeholder="Select frame id"
                data={props.selectedAtlas.frames.map((frame) => ({ value: frame.id, label: frame.id }))}
                value=""
                onChange={(value: string | null) => {
                  if (!value) return;
                  props.onAddFrame(value);
                }}
              />
              <Button variant="light" onClick={props.onClearFrames}>
                Clear frames
              </Button>
            </Group>
            <ScrollArea h={160}>
              <Stack gap="xs">
                {props.animationFrames.map((frameId, index) => (
                  <Group key={`${frameId}-${index}`} justify="space-between">
                    <Text size="sm">{frameId}</Text>
                    <Group>
                      <Button size="xs" variant="light" onClick={() => props.onMoveFrame(index, -1)}>
                        Up
                      </Button>
                      <Button size="xs" variant="light" onClick={() => props.onMoveFrame(index, 1)}>
                        Down
                      </Button>
                      <Button size="xs" variant="light" color="red" onClick={() => props.onRemoveFrame(index)}>
                        Remove
                      </Button>
                    </Group>
                  </Group>
                ))}
                {props.animationFrames.length === 0 && <Text size="sm">Add frame ids in the order you want them played.</Text>}
              </Stack>
            </ScrollArea>
            <Group>
              <Select
                label="Link to AssetSpec"
                placeholder="Select spec"
                data={props.specs.map((spec) => ({ value: spec.id, label: spec.title }))}
                value={props.animationSpecId}
                onChange={(value: string | null) => props.onAnimationSpecIdChange(value ?? "")}
              />
              <Button onClick={props.onSaveAnimation} disabled={!props.animationSpecId || props.animationFrames.length === 0}>
                Save to spec
              </Button>
            </Group>
            <Card withBorder radius="md" p="md">
              <Text fw={600} mb="xs">
                Playback
              </Text>
              <canvas ref={props.animationCanvasRef} style={{ width: "100%", background: "rgba(0,0,0,0.25)" }} />
            </Card>
          </>
        )}
        {!props.selectedAtlas && <Text size="sm">Select an atlas to define animations.</Text>}
      </Stack>
    </Card>
  );
}
