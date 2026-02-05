import React from "react";
import { Badge, Button, Card, Group, Stack, Text } from "@mantine/core";

import { HelpTip } from "../../components/HelpTip";
import type { ComfyUiVerify } from "../../services/systemService";

type Props = {
  verify: ComfyUiVerify | null;
  verifyError: string | null;
  verifyLoading: boolean;
  onVerify: () => void;
};

export function ComfyVerifyPanel(props: Props) {
  return (
    <Card withBorder radius="md" p="md">
      <Stack gap="xs">
        <Group justify="space-between">
          <Group gap="xs">
            <Text fw={600}>ComfyUI verification</Text>
            <HelpTip
              label="Verify ComfyUI reachability, workflow files, and model weight paths."
              topicId="system-status"
            />
          </Group>
          <Button variant="light" onClick={props.onVerify} loading={props.verifyLoading}>
            Run verify
          </Button>
        </Group>
        {props.verifyError && <Text size="sm">Error: {props.verifyError}</Text>}
        {!props.verify && !props.verifyError && (
          <Text size="sm" c="dimmed">
            Run verification to confirm ComfyUI and model paths are ready.
          </Text>
        )}
        {props.verify && (
          <Stack gap="xs">
            <Group gap="xs">
              <Badge color={props.verify.comfyui.ok ? "green" : "red"} variant="light">
                ComfyUI {props.verify.comfyui.ok ? "OK" : "Down"}
              </Badge>
              {props.verify.comfyui.error && (
                <Text size="xs" c="dimmed">
                  {props.verify.comfyui.error}
                </Text>
              )}
            </Group>
            <Group gap="xs" wrap="wrap">
              <Badge color={props.verify.manifest.exists ? "green" : "yellow"} variant="light">
                Manifest {props.verify.manifest.exists ? "found" : "missing"}
              </Badge>
              <Badge color={props.verify.objectInfo.ok ? "green" : "yellow"} variant="light">
                Nodes {props.verify.objectInfo.ok ? "checked" : "unknown"}
              </Badge>
              <Badge color={props.verify.python.ok ? "green" : "yellow"} variant="light">
                Python {props.verify.python.ok ? "checked" : "unknown"}
              </Badge>
              <Badge color={props.verify.workflowFiles.every((f) => f.exists) ? "green" : "yellow"} variant="light">
                Workflows {props.verify.workflowFiles.every((f) => f.exists) ? "ready" : "missing"}
              </Badge>
              <Badge color={props.verify.localConfig.missingRoots.length === 0 ? "green" : "yellow"} variant="light">
                Paths {props.verify.localConfig.missingRoots.length === 0 ? "set" : "missing"}
              </Badge>
            </Group>
            {props.verify.localConfig.missingRoots.length > 0 && (
              <Text size="xs" c="dimmed">
                Missing roots: {props.verify.localConfig.missingRoots.join(", ")}
              </Text>
            )}
            <Group gap="xs" wrap="wrap">
              <Badge color={props.verify.checkpoints.every((c) => c.exists) ? "green" : "yellow"} variant="light">
                Checkpoints {props.verify.checkpoints.filter((c) => c.exists).length}/{props.verify.checkpoints.length}
              </Badge>
              <Badge color={props.verify.loras.every((l) => l.exists) ? "green" : "yellow"} variant="light">
                LoRAs {props.verify.loras.filter((l) => l.exists).length}/{props.verify.loras.length}
              </Badge>
            </Group>
            {props.verify.checkpoints.some((c) => !c.exists) && (
              <Text size="xs" c="dimmed">
                Missing checkpoints:{" "}
                {props.verify.checkpoints
                  .filter((c) => !c.exists)
                  .map((c) => c.id)
                  .join(", ")}
              </Text>
            )}
            {props.verify.checkpoints.some((c) => c.hashExpected && c.hashMatch === false) && (
              <Text size="xs" c="dimmed">
                Checkpoint hash mismatch:{" "}
                {props.verify.checkpoints
                  .filter((c) => c.hashExpected && c.hashMatch === false)
                  .map((c) => c.id)
                  .join(", ")}
              </Text>
            )}
            {props.verify.loras.some((l) => !l.exists) && (
              <Text size="xs" c="dimmed">
                Missing LoRAs:{" "}
                {props.verify.loras
                  .filter((l) => !l.exists)
                  .map((l) => l.id)
                  .join(", ")}
              </Text>
            )}
            {props.verify.loras.some((l) => l.hashExpected && l.hashMatch === false) && (
              <Text size="xs" c="dimmed">
                LoRA hash mismatch:{" "}
                {props.verify.loras
                  .filter((l) => l.hashExpected && l.hashMatch === false)
                  .map((l) => l.id)
                  .join(", ")}
              </Text>
            )}
            {props.verify.manifestIssues.length > 0 && (
              <Text size="xs" c="dimmed">
                Manifest issues: {props.verify.manifestIssues.join("; ")}
              </Text>
            )}
            {props.verify.customNodes.length > 0 && props.verify.customNodes.some((n) => !n.matched) && (
              <Text size="xs" c="dimmed">
                Missing custom nodes:{" "}
                {props.verify.customNodes
                  .filter((n) => !n.matched)
                  .map((n) => n.name)
                  .join(", ")}
              </Text>
            )}
            {props.verify.pythonRequirements.length > 0 &&
              props.verify.pythonRequirements.some((p) => !p.installed) && (
                <Text size="xs" c="dimmed">
                  Missing python packages:{" "}
                  {props.verify.pythonRequirements
                    .filter((p) => !p.installed)
                    .map((p) => p.package)
                    .join(", ")}
                </Text>
              )}
          </Stack>
        )}
      </Stack>
    </Card>
  );
}
