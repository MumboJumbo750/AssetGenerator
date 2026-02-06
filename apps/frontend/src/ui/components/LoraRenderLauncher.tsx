import React from "react";
import { Button, Group, NumberInput, Stack, Text } from "@mantine/core";

type LoraRenderLauncherProps = {
  limit: number;
  strengthModel: number;
  strengthClip: number;
  onLimitChange: (value: number) => void;
  onStrengthModelChange: (value: number) => void;
  onStrengthClipChange: (value: number) => void;
  onRun: () => void;
  busy?: boolean;
};

export function LoraRenderLauncher({
  limit,
  strengthModel,
  strengthClip,
  onLimitChange,
  onStrengthModelChange,
  onStrengthClipChange,
  onRun,
  busy,
}: LoraRenderLauncherProps) {
  return (
    <Stack gap="xs">
      <Text fw={600}>Render launcher</Text>
      <Group grow>
        <NumberInput label="Limit" min={1} max={200} value={limit} onChange={(v) => onLimitChange(Number(v ?? 20))} />
        <NumberInput
          label="Strength model"
          min={0}
          max={2}
          step={0.05}
          decimalScale={2}
          value={strengthModel}
          onChange={(v) => onStrengthModelChange(Number(v ?? 1))}
        />
        <NumberInput
          label="Strength clip"
          min={0}
          max={2}
          step={0.05}
          decimalScale={2}
          value={strengthClip}
          onChange={(v) => onStrengthClipChange(Number(v ?? 1))}
        />
      </Group>
      <Button variant="light" onClick={onRun} loading={busy}>
        Activate current + Render
      </Button>
    </Stack>
  );
}
