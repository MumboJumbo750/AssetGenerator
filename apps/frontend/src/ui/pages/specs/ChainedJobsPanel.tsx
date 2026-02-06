import React from "react";
import {
  Accordion,
  Button,
  Card,
  Checkbox,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";

import { HelpTip } from "../../components/HelpTip";

type ChainedJob = {
  type: "bg_remove" | "atlas_pack" | "export";
  bgRemoveOriginalPath: string;
  bgRemoveThreshold: number;
  bgRemoveFeather: number;
  bgRemoveErode: number;
  atlasFramePathsCsv: string;
  atlasPadding: number;
  atlasMaxSize: number;
  atlasPowerOfTwo: boolean;
  atlasTrim: boolean;
  atlasExtrude: number;
  atlasSort: string;
  exportAssetIdsCsv: string;
  exportAtlasIdsCsv: string;
  exportProfileId: string;
};

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
          <Checkbox
            checked={props.chainEnabled}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              props.onToggleEnabled(event.currentTarget.checked)
            }
            label="Enable"
          />
        </Group>
        {props.chainEnabled && (
          <Stack gap="xs">
            <Accordion variant="contained">
              <Accordion.Item value="placeholders">
                <Accordion.Control>Help & FAQ: placeholders</Accordion.Control>
                <Accordion.Panel>
                  <Stack gap="xs">
                    <Text size="sm">
                      Placeholders let you reference the previous job output or input when chaining.
                    </Text>
                    <Text size="xs" c="dimmed">
                      Supported: <code>$output.*</code> (e.g. <code>$output.assetId</code>), <code>$input.*</code>,{" "}
                      <code>$projectId</code>, <code>$jobId</code>.
                    </Text>
                    <Text size="xs" c="dimmed">
                      Example: <code>{'{"assetIds":["$output.assetId"]}'}</code>
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
                        { value: "export", label: "export" },
                      ]}
                      value={job.type}
                      onChange={(value: string | null) =>
                        props.onUpdateJob(idx, { type: (value as ChainedJob["type"]) ?? "bg_remove" })
                      }
                    />
                    <Button variant="light" color="red" onClick={() => props.onRemoveJob(idx)}>
                      Remove
                    </Button>
                  </Group>
                  {job.type === "bg_remove" && (
                    <SimpleGrid cols={{ base: 1, md: 2 }}>
                      <TextInput
                        label={
                          <Group gap="xs">
                            <span>Original path</span>
                            <HelpTip
                              label="Data-relative image path. Placeholder values like $output.originalPath are supported."
                              topicId="chained-jobs"
                            />
                          </Group>
                        }
                        placeholder="$output.originalPath"
                        value={job.bgRemoveOriginalPath}
                        onChange={(event) =>
                          props.onUpdateJob(idx, { bgRemoveOriginalPath: event.currentTarget.value })
                        }
                      />
                      <NumberInput
                        label="Threshold"
                        value={job.bgRemoveThreshold}
                        min={0}
                        max={255}
                        onChange={(value) => props.onUpdateJob(idx, { bgRemoveThreshold: Number(value ?? 245) })}
                      />
                      <NumberInput
                        label="Feather"
                        value={job.bgRemoveFeather}
                        min={0}
                        max={32}
                        onChange={(value) => props.onUpdateJob(idx, { bgRemoveFeather: Number(value ?? 1) })}
                      />
                      <NumberInput
                        label="Erode"
                        value={job.bgRemoveErode}
                        min={0}
                        max={16}
                        onChange={(value) => props.onUpdateJob(idx, { bgRemoveErode: Number(value ?? 0) })}
                      />
                    </SimpleGrid>
                  )}
                  {job.type === "atlas_pack" && (
                    <SimpleGrid cols={{ base: 1, md: 2 }}>
                      <TextInput
                        label={
                          <Group gap="xs">
                            <span>Frame paths (csv)</span>
                            <HelpTip
                              label="Data-relative frame paths. Use placeholders like $output.alphaPath for single-frame flows."
                              topicId="chained-jobs"
                            />
                          </Group>
                        }
                        placeholder="$output.alphaPath"
                        value={job.atlasFramePathsCsv}
                        onChange={(event) => props.onUpdateJob(idx, { atlasFramePathsCsv: event.currentTarget.value })}
                      />
                      <NumberInput
                        label="Padding"
                        value={job.atlasPadding}
                        min={0}
                        onChange={(value) => props.onUpdateJob(idx, { atlasPadding: Number(value ?? 2) })}
                      />
                      <NumberInput
                        label="Max size"
                        value={job.atlasMaxSize}
                        min={64}
                        step={64}
                        onChange={(value) => props.onUpdateJob(idx, { atlasMaxSize: Number(value ?? 2048) })}
                      />
                      <NumberInput
                        label="Extrude"
                        value={job.atlasExtrude}
                        min={0}
                        onChange={(value) => props.onUpdateJob(idx, { atlasExtrude: Number(value ?? 0) })}
                      />
                      <TextInput
                        label="Sort"
                        value={job.atlasSort}
                        onChange={(event) => props.onUpdateJob(idx, { atlasSort: event.currentTarget.value })}
                      />
                      <Group>
                        <Checkbox
                          label="Power of two"
                          checked={job.atlasPowerOfTwo}
                          onChange={(event) => props.onUpdateJob(idx, { atlasPowerOfTwo: event.currentTarget.checked })}
                        />
                        <Checkbox
                          label="Trim"
                          checked={job.atlasTrim}
                          onChange={(event) => props.onUpdateJob(idx, { atlasTrim: event.currentTarget.checked })}
                        />
                      </Group>
                    </SimpleGrid>
                  )}
                  {job.type === "export" && (
                    <SimpleGrid cols={{ base: 1, md: 2 }}>
                      <TextInput
                        label={
                          <Group gap="xs">
                            <span>Asset IDs (csv)</span>
                            <HelpTip label="Use placeholders like $output.assetId." topicId="chained-jobs" />
                          </Group>
                        }
                        placeholder="$output.assetId"
                        value={job.exportAssetIdsCsv}
                        onChange={(event) => props.onUpdateJob(idx, { exportAssetIdsCsv: event.currentTarget.value })}
                      />
                      <TextInput
                        label="Atlas IDs (csv)"
                        placeholder="$output.atlasId"
                        value={job.exportAtlasIdsCsv}
                        onChange={(event) => props.onUpdateJob(idx, { exportAtlasIdsCsv: event.currentTarget.value })}
                      />
                      <TextInput
                        label="Profile ID"
                        value={job.exportProfileId}
                        onChange={(event) => props.onUpdateJob(idx, { exportProfileId: event.currentTarget.value })}
                      />
                    </SimpleGrid>
                  )}
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
