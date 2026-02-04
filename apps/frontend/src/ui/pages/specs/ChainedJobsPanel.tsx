import React from "react";
import { Accordion, Button, Card, Checkbox, Group, Select, Stack, Text, Textarea } from "@mantine/core";

import { HelpTip } from "../../components/HelpTip";

type ChainedJob = { type: string; inputText: string };

type Props = {
  chainEnabled: boolean;
  nextJobs: ChainedJob[];
  chainError: string | null;
  onToggleEnabled: (value: boolean) => void;
  onUpdateJob: (idx: number, patch: Partial<ChainedJob>) => void;
  onRemoveJob: (idx: number) => void;
  onApplyPreset: () => void;
  onAddJob: () => void;
};

export function ChainedJobsPanel(props: Props) {
  return (
    <Card withBorder radius="md" p="md">
      <Stack gap="xs">
        <Group justify="space-between">
          <Group gap="xs">
            <Text fw={600}>Chained jobs</Text>
            <HelpTip
              label="Optionally enqueue follow-up jobs after generate. Supports placeholders like $output.assetId, $input.specId, $projectId, $jobId."
              topicId="chained-jobs"
            />
          </Group>
          <Checkbox checked={props.chainEnabled} onChange={(event: React.ChangeEvent<HTMLInputElement>) => props.onToggleEnabled(event.currentTarget.checked)} label="Enable" />
        </Group>
        {props.chainEnabled && (
          <Stack gap="xs">
            <Accordion variant="contained">
              <Accordion.Item value="placeholders">
                <Accordion.Control>Help & FAQ: placeholders</Accordion.Control>
                <Accordion.Panel>
                  <Stack gap="xs">
                    <Text size="sm">Placeholders let you reference the previous job output or input when chaining.</Text>
                    <Text size="xs" c="dimmed">
                      Supported: <code>$output.*</code> (e.g. <code>$output.assetId</code>), <code>$input.*</code>, <code>$projectId</code>,{" "}
                      <code>$jobId</code>.
                    </Text>
                    <Text size="xs" c="dimmed">
                      Example: <code>{"{\"assetIds\":[\"$output.assetId\"]}"}</code>
                    </Text>
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
            </Accordion>
            {props.nextJobs.map((job, idx) => (
              <Card key={`${job.type}-${idx}`} withBorder radius="sm" p="sm">
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Select
                      data={[
                        { value: "bg_remove", label: "bg_remove" },
                        { value: "atlas_pack", label: "atlas_pack" },
                        { value: "export", label: "export" }
                      ]}
                      value={job.type}
                      onChange={(value: string | null) => props.onUpdateJob(idx, { type: value ?? "bg_remove" })}
                    />
                    <Button variant="light" color="red" onClick={() => props.onRemoveJob(idx)}>
                      Remove
                    </Button>
                  </Group>
                  <Textarea
                    label={
                      <Group gap="xs">
                        <span>Chained job input (JSON)</span>
                        <HelpTip label="JSON object only. Use placeholders like $output.assetId." topicId="chained-jobs" />
                      </Group>
                    }
                    placeholder='{"assetIds":["$output.assetId"]}'
                    value={job.inputText}
                    onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => props.onUpdateJob(idx, { inputText: event.currentTarget.value })}
                    minRows={3}
                  />
                </Stack>
              </Card>
            ))}
            <Group>
              <Button variant="light" onClick={props.onApplyPreset}>
                Add generate → export preset
              </Button>
              <Button variant="light" onClick={props.onAddJob}>
                Add chained job
              </Button>
            </Group>
            {props.chainError && <Text size="xs">Chain error: {props.chainError}</Text>}
          </Stack>
        )}
      </Stack>
    </Card>
  );
}
