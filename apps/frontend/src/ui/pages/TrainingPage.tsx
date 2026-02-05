import React, { useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Image,
  List,
  NumberInput,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
} from "@mantine/core";

import { HelpTip } from "../components/HelpTip";
import { useAppData } from "../context/AppDataContext";
import { useLoraEvalData } from "../hooks/useLoraEvalData";
import { updateProject, updateProjectLora, updateSharedLora } from "../api";
import { useAsyncAction } from "../hooks/useAsyncAction";

function toDataUrl(pathValue: unknown) {
  if (typeof pathValue !== "string" || !pathValue.trim()) return "";
  if (pathValue.startsWith("http")) return pathValue;
  if (pathValue.startsWith("/data/")) return pathValue;
  if (pathValue.startsWith("data/")) return `/${pathValue}`;
  return `/data/${pathValue}`;
}

export function TrainingPage() {
  const { selectedProjectId, projects, refreshProjectData } = useAppData();
  const [scope, setScope] = useState<"project" | "baseline">("project");

  const { loras, evals, loading, error, refresh } = useLoraEvalData({ projectId: selectedProjectId, scope });

  const [selectedLoraId, setSelectedLoraId] = useState("");
  const [selectedReleaseId, setSelectedReleaseId] = useState("");
  const [selectedEvalId, setSelectedEvalId] = useState("");
  const [comparisonMode, setComparisonMode] = useState<"single" | "compare">("single");
  const [leftReleaseId, setLeftReleaseId] = useState("");
  const [rightReleaseId, setRightReleaseId] = useState("");
  const [leftEvalId, setLeftEvalId] = useState("");
  const [rightEvalId, setRightEvalId] = useState("");
  const [promptFilter, setPromptFilter] = useState("");
  const [sortMode, setSortMode] = useState<"prompt" | "left_images" | "right_images" | "missing">("prompt");

  const currentProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );
  const loraPolicy = currentProject?.policies?.loraSelection;
  const [policyMode, setPolicyMode] = useState<
    "manual" | "baseline_then_project" | "project_then_baseline" | "baseline_only" | "project_only"
  >("baseline_then_project");
  const [policyPreferRecommended, setPolicyPreferRecommended] = useState(true);
  const [policyMaxActive, setPolicyMaxActive] = useState(2);
  const [policyReleasePolicy, setPolicyReleasePolicy] = useState<"active_or_latest_approved" | "active_only">(
    "active_or_latest_approved",
  );

  const policyAction = useAsyncAction(async () => {
    if (!selectedProjectId) return;
    await updateProject(selectedProjectId, {
      policies: {
        loraSelection: {
          mode: policyMode,
          preferRecommended: policyPreferRecommended,
          maxActiveLoras: policyMaxActive,
          releasePolicy: policyReleasePolicy,
        },
      },
    });
    await refreshProjectData(selectedProjectId);
  });

  const loraAction = useAsyncAction(async (patch: { loraId: string; patch: any }) => {
    if (!patch.loraId) return;
    if (scope === "baseline") {
      await updateSharedLora(patch.loraId, patch.patch);
    } else if (selectedProjectId) {
      await updateProjectLora(selectedProjectId, patch.loraId, patch.patch);
    }
    await refresh();
  });

  const loraOptions = useMemo(
    () => loras.map((lora) => ({ value: lora.id, label: `${lora.name} (${lora.id})` })),
    [loras],
  );

  const selectedLora = useMemo(() => loras.find((lora) => lora.id === selectedLoraId) ?? null, [loras, selectedLoraId]);

  const releaseOptions = useMemo(() => {
    return (selectedLora?.releases ?? []).map((release) => ({
      value: release.id,
      label: `${release.id} (${release.status})`,
    }));
  }, [selectedLora]);

  const selectedRelease = useMemo(
    () => selectedLora?.releases?.find((release) => release.id === selectedReleaseId) ?? null,
    [selectedLora, selectedReleaseId],
  );

  const releaseOptionsFor = (lora: typeof selectedLora | null) =>
    (lora?.releases ?? []).map((release) => ({ value: release.id, label: `${release.id} (${release.status})` }));

  const evalOptionsFor = (releaseId: string) =>
    evals
      .filter(
        (evalRecord) => evalRecord.loraId === selectedLoraId && (!releaseId || evalRecord.releaseId === releaseId),
      )
      .map((evalRecord) => ({
        value: evalRecord.id,
        label: `${evalRecord.id} (${evalRecord.status})`,
      }));

  const evalOptions = useMemo(() => {
    return evals
      .filter(
        (evalRecord) =>
          evalRecord.loraId === selectedLoraId && (!selectedReleaseId || evalRecord.releaseId === selectedReleaseId),
      )
      .map((evalRecord) => ({
        value: evalRecord.id,
        label: `${evalRecord.id} (${evalRecord.status})`,
      }));
  }, [evals, selectedLoraId, selectedReleaseId]);

  const selectedEval = useMemo(
    () => evals.find((evalRecord) => evalRecord.id === selectedEvalId) ?? null,
    [evals, selectedEvalId],
  );

  React.useEffect(() => {
    if (!selectedLoraId || !loras.some((lora) => lora.id === selectedLoraId)) {
      setSelectedLoraId(loras[0]?.id ?? "");
    }
  }, [loras, selectedLoraId]);

  React.useEffect(() => {
    if (!selectedLora) {
      setSelectedReleaseId("");
      setLeftReleaseId("");
      setRightReleaseId("");
      return;
    }
    if (!selectedReleaseId || !selectedLora.releases.some((release) => release.id === selectedReleaseId)) {
      setSelectedReleaseId(selectedLora.activeReleaseId ?? selectedLora.releases[0]?.id ?? "");
    }
    const releases = selectedLora.releases ?? [];
    if (!leftReleaseId || !releases.some((release) => release.id === leftReleaseId)) {
      setLeftReleaseId(selectedLora.activeReleaseId ?? releases[0]?.id ?? "");
    }
    if (!rightReleaseId || !releases.some((release) => release.id === rightReleaseId)) {
      setRightReleaseId(releases[1]?.id ?? selectedLora.activeReleaseId ?? releases[0]?.id ?? "");
    }
  }, [selectedLora, selectedReleaseId, leftReleaseId, rightReleaseId]);

  React.useEffect(() => {
    if (evalOptions.length === 0) {
      setSelectedEvalId("");
      return;
    }
    if (!selectedEvalId || !evalOptions.some((opt) => opt.value === selectedEvalId)) {
      setSelectedEvalId(evalOptions[0]?.value ?? "");
    }
  }, [evalOptions, selectedEvalId]);

  const leftEvalOptions = useMemo(() => evalOptionsFor(leftReleaseId), [leftReleaseId, evals, selectedLoraId]);
  const rightEvalOptions = useMemo(() => evalOptionsFor(rightReleaseId), [rightReleaseId, evals, selectedLoraId]);

  React.useEffect(() => {
    if (leftEvalOptions.length === 0) {
      setLeftEvalId("");
      return;
    }
    if (!leftEvalId || !leftEvalOptions.some((opt) => opt.value === leftEvalId)) {
      setLeftEvalId(leftEvalOptions[0]?.value ?? "");
    }
  }, [leftEvalOptions, leftEvalId]);

  React.useEffect(() => {
    if (rightEvalOptions.length === 0) {
      setRightEvalId("");
      return;
    }
    if (!rightEvalId || !rightEvalOptions.some((opt) => opt.value === rightEvalId)) {
      setRightEvalId(rightEvalOptions[0]?.value ?? "");
    }
  }, [rightEvalOptions, rightEvalId]);

  React.useEffect(() => {
    if (!selectedProjectId) return;
    setPolicyMode(loraPolicy?.mode ?? "baseline_then_project");
    setPolicyPreferRecommended(loraPolicy?.preferRecommended ?? true);
    setPolicyMaxActive(loraPolicy?.maxActiveLoras ?? 2);
    setPolicyReleasePolicy(loraPolicy?.releasePolicy ?? "active_or_latest_approved");
  }, [
    selectedProjectId,
    loraPolicy?.mode,
    loraPolicy?.preferRecommended,
    loraPolicy?.maxActiveLoras,
    loraPolicy?.releasePolicy,
  ]);

  const evalOutputs = Array.isArray(selectedEval?.outputs) ? selectedEval.outputs : [];

  function evalMetrics(evalRecord: typeof selectedEval | null) {
    if (!evalRecord) return null;
    const prompts = Array.isArray(evalRecord.prompts) ? evalRecord.prompts : [];
    const outputs = Array.isArray(evalRecord.outputs) ? evalRecord.outputs : [];
    const images = outputs.reduce((sum, output) => {
      const imgs = Array.isArray((output as any).images) ? (output as any).images.length : 0;
      return sum + imgs;
    }, 0);
    const coverage = prompts.length ? Math.min(1, outputs.length / prompts.length) : 0;
    return { prompts: prompts.length, outputs: outputs.length, images, coverage };
  }

  function outputMap(evalRecord: typeof selectedEval | null) {
    const map = new Map<string, string[]>();
    if (!evalRecord) return map;
    const outputs = Array.isArray(evalRecord.outputs) ? evalRecord.outputs : [];
    for (const output of outputs) {
      const prompt = typeof (output as any).prompt === "string" ? (output as any).prompt : "";
      if (!prompt) continue;
      const images = Array.isArray((output as any).images) ? (output as any).images : [];
      map.set(prompt, [...(map.get(prompt) ?? []), ...images.map(String)]);
    }
    return map;
  }

  function promptsFor(evalRecord: typeof selectedEval | null) {
    const prompts = Array.isArray(evalRecord?.prompts) ? evalRecord!.prompts : [];
    if (prompts.length) return prompts;
    const outputs = Array.isArray(evalRecord?.outputs) ? evalRecord!.outputs : [];
    return Array.from(new Set(outputs.map((o: any) => (typeof o.prompt === "string" ? o.prompt : "")).filter(Boolean)));
  }

  const leftEval = useMemo(() => evals.find((evalRecord) => evalRecord.id === leftEvalId) ?? null, [evals, leftEvalId]);
  const rightEval = useMemo(
    () => evals.find((evalRecord) => evalRecord.id === rightEvalId) ?? null,
    [evals, rightEvalId],
  );

  const comparisonRows = useMemo(() => {
    const leftPrompts = promptsFor(leftEval);
    const rightPrompts = promptsFor(rightEval);
    const promptSet = new Set([...leftPrompts, ...rightPrompts]);
    const prompts = Array.from(promptSet);
    const leftMap = outputMap(leftEval);
    const rightMap = outputMap(rightEval);
    const filter = promptFilter.trim().toLowerCase();
    let rows = prompts
      .map((prompt) => ({
        prompt,
        leftImages: leftMap.get(prompt) ?? [],
        rightImages: rightMap.get(prompt) ?? [],
      }))
      .filter((row) => (!filter ? true : row.prompt.toLowerCase().includes(filter)));

    rows = rows.sort((a, b) => {
      if (sortMode === "left_images") return b.leftImages.length - a.leftImages.length;
      if (sortMode === "right_images") return b.rightImages.length - a.rightImages.length;
      if (sortMode === "missing") {
        const aMissing = (a.leftImages.length === 0 ? 1 : 0) + (a.rightImages.length === 0 ? 1 : 0);
        const bMissing = (b.leftImages.length === 0 ? 1 : 0) + (b.rightImages.length === 0 ? 1 : 0);
        return bMissing - aMissing;
      }
      return a.prompt.localeCompare(b.prompt);
    });

    return rows;
  }, [leftEval, rightEval, promptFilter, sortMode]);

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={3}>Training eval comparison</Title>
        <Group>
          <HelpTip label="Compare LoRA eval prompts and outputs." topicId="training-basics" />
          <Badge variant="light" color="indigo">
            Checkpoint H
          </Badge>
        </Group>
      </Group>

      <Card withBorder radius="md" p="md">
        <Group justify="space-between">
          <Group>
            <SegmentedControl
              value={scope}
              onChange={(value) => setScope(value as "project" | "baseline")}
              data={[
                { label: "Project", value: "project" },
                { label: "Baseline", value: "baseline" },
              ]}
            />
            <Text size="sm" c="dimmed">
              {scope === "project" ? selectedProjectId || "No project selected" : "Shared baseline LoRAs"}
            </Text>
          </Group>
          <SegmentedControl
            value={comparisonMode}
            onChange={(value) => setComparisonMode(value as "single" | "compare")}
            data={[
              { label: "Single", value: "single" },
              { label: "Compare", value: "compare" },
            ]}
          />
          <Text size="sm" c="dimmed" onClick={() => refresh().catch(() => undefined)} style={{ cursor: "pointer" }}>
            {loading ? "Refreshing..." : "Refresh"}
          </Text>
        </Group>
        {error && (
          <Text mt="sm" size="sm" c="red">
            {error}
          </Text>
        )}
        {loraAction.error && (
          <Text mt="sm" size="sm" c="red">
            {loraAction.error}
          </Text>
        )}
      </Card>

      {scope === "project" && selectedProjectId && (
        <Card withBorder radius="md" p="md">
          <Stack gap="sm">
            <Group justify="space-between">
              <Text fw={600}>LoRA selection policy</Text>
              <Badge variant="light">Project policy</Badge>
            </Group>
            <SimpleGrid cols={{ base: 1, md: 4 }}>
              <Select
                label="Selection mode"
                data={[
                  { value: "manual", label: "Manual only" },
                  { value: "baseline_then_project", label: "Baseline then project" },
                  { value: "project_then_baseline", label: "Project then baseline" },
                  { value: "baseline_only", label: "Baseline only" },
                  { value: "project_only", label: "Project only" },
                ]}
                value={policyMode}
                onChange={(value) => setPolicyMode((value as typeof policyMode) ?? "baseline_then_project")}
              />
              <Select
                label="Release policy"
                data={[
                  { value: "active_or_latest_approved", label: "Active or latest approved" },
                  { value: "active_only", label: "Active only" },
                ]}
                value={policyReleasePolicy}
                onChange={(value) =>
                  setPolicyReleasePolicy((value as typeof policyReleasePolicy) ?? "active_or_latest_approved")
                }
              />
              <NumberInput
                label="Max active LoRAs"
                min={0}
                value={policyMaxActive}
                onChange={(value) => setPolicyMaxActive(Number(value ?? 0))}
              />
              <Switch
                label="Prefer recommended"
                checked={policyPreferRecommended}
                onChange={(event) => setPolicyPreferRecommended(event.currentTarget.checked)}
              />
            </SimpleGrid>
            <Group justify="flex-end">
              <Button
                size="xs"
                variant="light"
                loading={policyAction.loading}
                onClick={() => policyAction.run().catch(() => undefined)}
              >
                Save policy
              </Button>
            </Group>
            {policyAction.error && (
              <Text size="xs" c="red">
                {policyAction.error}
              </Text>
            )}
          </Stack>
        </Card>
      )}

      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
        <Card withBorder radius="md" p="md">
          <Stack gap="sm">
            <Text fw={600}>LoRA</Text>
            <Select
              placeholder={loras.length ? "Select LoRA" : "No LoRAs found"}
              data={loraOptions}
              value={selectedLoraId}
              onChange={(value) => setSelectedLoraId(value ?? "")}
              searchable
            />
            {selectedLora ? (
              <Stack gap={4}>
                <Text size="sm">
                  <strong>ID:</strong> {selectedLora.id}
                </Text>
                <Text size="sm">
                  <strong>Checkpoint:</strong> {selectedLora.checkpointId}
                </Text>
                <Text size="sm">
                  <strong>Asset types:</strong> {selectedLora.assetTypes.join(", ")}
                </Text>
                <Group gap="xs">
                  <Switch
                    label="Recommended"
                    checked={Boolean(selectedLora.recommended)}
                    onChange={(event) =>
                      loraAction
                        .run({ loraId: selectedLora.id, patch: { recommended: event.currentTarget.checked } })
                        .catch(() => undefined)
                    }
                  />
                </Group>
              </Stack>
            ) : (
              <Text size="sm" c="dimmed">
                Select a LoRA to view releases.
              </Text>
            )}
          </Stack>
        </Card>

        <Card withBorder radius="md" p="md">
          <Stack gap="sm">
            <Text fw={600}>Release</Text>
            <Select
              placeholder={selectedLora ? "Select release" : "Pick a LoRA first"}
              data={releaseOptions}
              value={selectedReleaseId}
              onChange={(value) => setSelectedReleaseId(value ?? "")}
            />
            {selectedRelease ? (
              <Stack gap={4}>
                <Group gap={6}>
                  <Badge variant="light">{selectedRelease.status}</Badge>
                  <Text size="xs" c="dimmed">
                    {selectedRelease.createdAt}
                  </Text>
                </Group>
                {selectedLora && (
                  <Group gap="xs">
                    {(["candidate", "approved", "deprecated"] as const).map((status) => (
                      <Button
                        key={status}
                        size="xs"
                        variant={selectedRelease.status === status ? "filled" : "light"}
                        onClick={() =>
                          loraAction
                            .run({
                              loraId: selectedLora.id,
                              patch: { releaseUpdates: [{ id: selectedRelease.id, status }] },
                            })
                            .catch(() => undefined)
                        }
                      >
                        {status}
                      </Button>
                    ))}
                  </Group>
                )}
                {selectedLora && (
                  <Select
                    label="Active release"
                    data={releaseOptionsFor(selectedLora)}
                    value={selectedLora.activeReleaseId ?? ""}
                    onChange={(value) =>
                      loraAction
                        .run({ loraId: selectedLora.id, patch: { activeReleaseId: value ?? null } })
                        .catch(() => undefined)
                    }
                    clearable
                  />
                )}
                {selectedRelease.notes && <Text size="sm">{selectedRelease.notes}</Text>}
                {selectedRelease.training && (
                  <Text size="sm" c="dimmed">
                    Training config recorded.
                  </Text>
                )}
              </Stack>
            ) : (
              <Text size="sm" c="dimmed">
                Select a release to compare evals.
              </Text>
            )}
          </Stack>
        </Card>

        <Card withBorder radius="md" p="md">
          <Stack gap="sm">
            <Text fw={600}>Eval</Text>
            {comparisonMode === "single" ? (
              <Select
                placeholder={selectedRelease ? "Select eval" : "Pick a release first"}
                data={evalOptions}
                value={selectedEvalId}
                onChange={(value) => setSelectedEvalId(value ?? "")}
              />
            ) : (
              <Stack gap="sm">
                <Select
                  label="Release A"
                  placeholder={selectedLora ? "Select release" : "Pick a LoRA first"}
                  data={releaseOptionsFor(selectedLora)}
                  value={leftReleaseId}
                  onChange={(value) => setLeftReleaseId(value ?? "")}
                />
                <Select
                  label="Eval A"
                  placeholder={leftReleaseId ? "Select eval" : "Pick a release first"}
                  data={evalOptionsFor(leftReleaseId)}
                  value={leftEvalId}
                  onChange={(value) => setLeftEvalId(value ?? "")}
                />
                <Select
                  label="Release B"
                  placeholder={selectedLora ? "Select release" : "Pick a LoRA first"}
                  data={releaseOptionsFor(selectedLora)}
                  value={rightReleaseId}
                  onChange={(value) => setRightReleaseId(value ?? "")}
                />
                <Select
                  label="Eval B"
                  placeholder={rightReleaseId ? "Select eval" : "Pick a release first"}
                  data={evalOptionsFor(rightReleaseId)}
                  value={rightEvalId}
                  onChange={(value) => setRightEvalId(value ?? "")}
                />
              </Stack>
            )}
            {selectedEval ? (
              <Stack gap="sm">
                <Group gap={6}>
                  <Badge variant="light">{selectedEval.status}</Badge>
                  <Text size="xs" c="dimmed">
                    {selectedEval.createdAt}
                  </Text>
                </Group>
                {selectedEval.prompts.length > 0 ? (
                  <List spacing="xs" size="sm">
                    {selectedEval.prompts.map((prompt) => (
                      <List.Item key={prompt}>{prompt}</List.Item>
                    ))}
                  </List>
                ) : (
                  <Text size="sm" c="dimmed">
                    No prompts recorded.
                  </Text>
                )}
                {evalOutputs.length > 0 ? (
                  <Stack gap="sm">
                    {evalOutputs.map((output, index) => {
                      const prompt = typeof output.prompt === "string" ? output.prompt : undefined;
                      const images = Array.isArray(output.images) ? output.images : [];
                      return (
                        <Card key={`${selectedEval.id}-${index}`} withBorder radius="sm" p="sm">
                          <Stack gap="xs">
                            {prompt && (
                              <Text size="sm" fw={600}>
                                {prompt}
                              </Text>
                            )}
                            {images.length > 0 ? (
                              <Group gap="sm">
                                {images.map((img) => (
                                  <Image key={img} src={toDataUrl(img)} w={96} h={96} radius="sm" />
                                ))}
                              </Group>
                            ) : (
                              <Text size="xs" c="dimmed">
                                No output images recorded.
                              </Text>
                            )}
                          </Stack>
                        </Card>
                      );
                    })}
                  </Stack>
                ) : (
                  <Text size="sm" c="dimmed">
                    No outputs recorded yet.
                  </Text>
                )}
              </Stack>
            ) : (
              <Text size="sm" c="dimmed">
                Select an eval to view prompts and outputs.
              </Text>
            )}
          </Stack>
        </Card>
      </SimpleGrid>

      <Card withBorder radius="md" p="md">
        <Stack gap="md">
          <Group justify="space-between">
            <Text fw={600}>Comparison insights</Text>
            <Group gap="xs">
              <TextInput
                placeholder="Filter prompts"
                value={promptFilter}
                onChange={(event) => setPromptFilter(event.currentTarget.value)}
              />
              {comparisonMode === "compare" && (
                <Select
                  data={[
                    { value: "prompt", label: "Sort: prompt" },
                    { value: "left_images", label: "Sort: left images" },
                    { value: "right_images", label: "Sort: right images" },
                    { value: "missing", label: "Sort: missing" },
                  ]}
                  value={sortMode}
                  onChange={(value) => setSortMode((value as any) ?? "prompt")}
                />
              )}
            </Group>
          </Group>

          {comparisonMode === "single" ? (
            <Stack gap="sm">
              {(() => {
                const metrics = evalMetrics(selectedEval);
                if (!metrics) {
                  return (
                    <Text size="sm" c="dimmed">
                      Select an eval to see metrics.
                    </Text>
                  );
                }
                return (
                  <SimpleGrid cols={{ base: 1, md: 3 }}>
                    <Card withBorder radius="sm" p="sm">
                      <Text size="xs" c="dimmed">
                        Prompts
                      </Text>
                      <Text fw={600}>{metrics.prompts}</Text>
                    </Card>
                    <Card withBorder radius="sm" p="sm">
                      <Text size="xs" c="dimmed">
                        Outputs
                      </Text>
                      <Text fw={600}>{metrics.outputs}</Text>
                    </Card>
                    <Card withBorder radius="sm" p="sm">
                      <Text size="xs" c="dimmed">
                        Images
                      </Text>
                      <Text fw={600}>{metrics.images}</Text>
                    </Card>
                  </SimpleGrid>
                );
              })()}
            </Stack>
          ) : (
            <Stack gap="md">
              <SimpleGrid cols={{ base: 1, md: 2 }}>
                {[
                  { label: "Eval A", evalRecord: leftEval },
                  { label: "Eval B", evalRecord: rightEval },
                ].map((slot) => {
                  const metrics = evalMetrics(slot.evalRecord);
                  return (
                    <Card key={slot.label} withBorder radius="sm" p="sm">
                      <Stack gap="xs">
                        <Text size="sm" fw={600}>
                          {slot.label}
                        </Text>
                        {metrics ? (
                          <Group gap="md">
                            <Text size="xs">Prompts: {metrics.prompts}</Text>
                            <Text size="xs">Outputs: {metrics.outputs}</Text>
                            <Text size="xs">Images: {metrics.images}</Text>
                            <Text size="xs">Coverage: {(metrics.coverage * 100).toFixed(0)}%</Text>
                          </Group>
                        ) : (
                          <Text size="xs" c="dimmed">
                            Select an eval.
                          </Text>
                        )}
                      </Stack>
                    </Card>
                  );
                })}
              </SimpleGrid>

              <Divider />

              {comparisonRows.length === 0 ? (
                <Text size="sm" c="dimmed">
                  Select two evals to compare.
                </Text>
              ) : (
                <Stack gap="sm">
                  {comparisonRows.map((row) => (
                    <Card key={row.prompt} withBorder radius="sm" p="sm">
                      <Stack gap="xs">
                        <Group justify="space-between">
                          <Text size="sm" fw={600}>
                            {row.prompt}
                          </Text>
                          <Group gap="xs">
                            <Badge variant="light">A: {row.leftImages.length}</Badge>
                            <Badge variant="light">B: {row.rightImages.length}</Badge>
                          </Group>
                        </Group>
                        <SimpleGrid cols={{ base: 1, md: 2 }}>
                          <Stack gap="xs">
                            <Text size="xs" c="dimmed">
                              Eval A
                            </Text>
                            {row.leftImages.length > 0 ? (
                              <Group gap="xs">
                                {row.leftImages.map((img) => (
                                  <Image key={img} src={toDataUrl(img)} w={88} h={88} radius="sm" />
                                ))}
                              </Group>
                            ) : (
                              <Text size="xs" c="dimmed">
                                No images.
                              </Text>
                            )}
                          </Stack>
                          <Stack gap="xs">
                            <Text size="xs" c="dimmed">
                              Eval B
                            </Text>
                            {row.rightImages.length > 0 ? (
                              <Group gap="xs">
                                {row.rightImages.map((img) => (
                                  <Image key={img} src={toDataUrl(img)} w={88} h={88} radius="sm" />
                                ))}
                              </Group>
                            ) : (
                              <Text size="xs" c="dimmed">
                                No images.
                              </Text>
                            )}
                          </Stack>
                        </SimpleGrid>
                      </Stack>
                    </Card>
                  ))}
                </Stack>
              )}
            </Stack>
          )}
        </Stack>
      </Card>
    </Stack>
  );
}
