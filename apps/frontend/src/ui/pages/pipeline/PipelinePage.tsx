import React, { useMemo } from "react";
import { Button, Card, Group, Select, Stack, Text, TextInput, Title } from "@mantine/core";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ulid } from "ulid";

import { cancelJob, createJob, type AssetSpec, type Job } from "../../api";
import { PipelineBoard, type PipelineBoardItem } from "../../components/PipelineBoard";
import { SpecWizard } from "../../components/SpecWizard";
import { useAppData } from "../../context/AppDataContext";

function latestForSpecJobs(jobs: Job[], specId: string, type?: Job["type"]) {
  return jobs
    .filter((job) => {
      const jobSpecId = typeof job.input?.specId === "string" ? (job.input.specId as string) : "";
      if (jobSpecId !== specId) return false;
      if (!type) return true;
      return job.type === type;
    })
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0];
}

function resolveStage(spec: AssetSpec, latestVersionStatus?: string, hasAlpha?: boolean, hasExport?: boolean) {
  if (hasExport) return "exported" as const;
  if (!latestVersionStatus) return "draft" as const;
  if (latestVersionStatus === "approved") {
    if (spec.output?.kind === "animation") return hasAlpha ? ("atlas" as const) : ("alpha" as const);
    return "alpha" as const;
  }
  return "review" as const;
}

function evidenceBadgeFromGeneration(generation: Record<string, unknown> | undefined) {
  if (!generation) return { label: "Evidence: none", color: "red" };
  const hasQuality = ["qualityScore", "quality", "score"].some((key) => typeof generation[key] === "number");
  const hasConfidence = ["confidence", "decisionConfidence"].some((key) => typeof generation[key] === "number");
  const hasRouting = ["routingDecision", "routing", "route"].some(
    (key) => typeof generation[key] === "string" && String(generation[key]).trim().length > 0,
  );
  const hasValidators = ["validators", "validation", "baselineValidation"].some(
    (key) => typeof generation[key] === "object" && generation[key] !== null,
  );

  const presentCount = [hasQuality, hasConfidence, hasRouting, hasValidators].filter(Boolean).length;
  if (presentCount === 0) return { label: "Evidence: none", color: "red" };
  if (presentCount < 4) return { label: `Evidence: ${presentCount}/4`, color: "yellow" };
  return { label: "Evidence: ready", color: "green" };
}

export function PipelinePage() {
  const { selectedProjectId, projects, specs, assets, jobs, assetTypeCatalog, refreshProjectData, setError } =
    useAppData();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [wizardOpened, setWizardOpened] = React.useState(false);
  const queryFilter = searchParams.get("q") ?? "";
  const loraModeFilter = searchParams.get("loraMode") ?? "all";
  const styleModeFilter = searchParams.get("styleConsistency") ?? searchParams.get("styleMode") ?? "all";
  const backgroundPolicyFilter = searchParams.get("backgroundPolicy") ?? "all";

  function setPipelineParam(key: string, value: string, defaultValue: string) {
    const next = new URLSearchParams(searchParams);
    if (key === "styleConsistency") next.delete("styleMode");
    if (!value || value === defaultValue) next.delete(key);
    else next.set(key, value);
    setSearchParams(next, { replace: true });
  }
  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId),
    [projects, selectedProjectId],
  );

  async function runPipelineForSpec(spec: AssetSpec) {
    if (!selectedProjectId) return;
    const checkpointName = String(spec.checkpointId ?? "").trim();
    if (!checkpointName) throw new Error(`Spec ${spec.id} is missing checkpointId.`);

    const shouldRunBgRemove = true;
    const frameNames = spec.output?.animation?.frameNames ?? [];
    const framePrompts = spec.output?.animation?.framePrompts ?? [];
    const frameCount = Number(spec.output?.animation?.frameCount ?? frameNames.length ?? 0);
    const isAnimation = spec.output?.kind === "animation" || frameCount > 1;

    const baseInput: Record<string, unknown> = {
      specId: spec.id,
      templateId: "txt2img",
      checkpointName,
      variants: 1,
      ...(!isAnimation && shouldRunBgRemove
        ? {
            nextJobs: [
              {
                type: "bg_remove" as const,
                input: {
                  originalPath: "$output.originalPath",
                  nextJobs: [
                    {
                      type: "atlas_pack" as const,
                      input: {
                        atlasId: "$input.specId",
                        framePaths: [{ key: "frame_1", path: "$output.alphaPath" }],
                        padding: 2,
                        maxSize: 2048,
                        trim: true,
                      },
                    },
                  ],
                },
              },
            ],
          }
        : {}),
    };

    if (isAnimation && frameCount > 1) {
      const sequenceId = ulid();
      for (let index = 0; index < frameCount; index += 1) {
        const alphaPath = `projects/$projectId/files/generated/$input.specId/sequences/$input.sequenceId/alpha/frame_${index}.png`;
        const nextJobs: Array<{ type: "bg_remove" | "atlas_pack"; input: Record<string, unknown> }> = shouldRunBgRemove
          ? [
              {
                type: "bg_remove",
                input: {
                  originalPath: "$output.originalPath",
                  alphaPath,
                },
              },
            ]
          : [];

        if (index === frameCount - 1) {
          nextJobs.push({
            type: "atlas_pack",
            input: {
              atlasId: "$input.specId",
              framePaths: Array.from({ length: frameCount }, (_, frameIdx) => ({
                key: frameNames[frameIdx] || `frame_${frameIdx + 1}`,
                path: `projects/$projectId/files/generated/$input.specId/sequences/$input.sequenceId/alpha/frame_${frameIdx}.png`,
              })),
              padding: 2,
              maxSize: 2048,
              trim: true,
            },
          });
        }

        const input: Record<string, unknown> = {
          ...baseInput,
          sequenceId,
          assetId: sequenceId,
          frameIndex: index,
          frameCount,
          ...(nextJobs.length > 0 ? { nextJobs } : {}),
        };
        if (frameNames[index]) input.frameName = frameNames[index];
        if (framePrompts[index]) input.framePrompt = framePrompts[index];
        await createJob(selectedProjectId, "generate", input);
      }
      return;
    }

    await createJob(selectedProjectId, "generate", baseInput);
  }

  const assetsBySpecId = useMemo(() => {
    const map = new Map<string, (typeof assets)[number]>();
    for (const asset of assets) map.set(asset.specId, asset);
    return map;
  }, [assets]);

  const boardItems = useMemo<PipelineBoardItem[]>(() => {
    return specs.map((spec) => {
      const asset = assetsBySpecId.get(spec.id);
      const latestVersion = asset?.versions?.[asset.versions.length - 1];
      const primaryVariant = latestVersion?.variants?.find((variant) => variant.id === latestVersion.primaryVariantId);
      const fallbackVariant = latestVersion?.variants?.[0];
      const activeVariant = primaryVariant ?? fallbackVariant;

      const latestGenerate = latestForSpecJobs(jobs, spec.id, "generate");
      const latestExport = latestForSpecJobs(jobs, spec.id, "export");
      const generating = latestGenerate && (latestGenerate.status === "queued" || latestGenerate.status === "running");

      const progressValueRaw = latestGenerate?.output?.progress;
      const progress = typeof progressValueRaw === "number" ? progressValueRaw : undefined;

      const stage = generating
        ? ("generating" as const)
        : resolveStage(
            spec,
            latestVersion?.status,
            Boolean(activeVariant?.alphaPath),
            latestExport?.status === "succeeded",
          );

      const primaryActionLabel =
        stage === "draft"
          ? "Run Pipeline"
          : stage === "generating"
            ? "Cancel"
            : stage === "review"
              ? "Review"
              : stage === "atlas"
                ? "Export"
                : stage === "exported"
                  ? "Open Export"
                  : undefined;

      const onPrimaryAction = async () => {
        if (!selectedProjectId) return;
        try {
          if (stage === "draft") {
            await runPipelineForSpec(spec);
            await refreshProjectData(selectedProjectId);
          } else if (stage === "generating" && latestGenerate) {
            await cancelJob(selectedProjectId, latestGenerate.id);
            await refreshProjectData(selectedProjectId);
          } else if (stage === "review") {
            navigate(`/review?assetId=${asset?.id ?? ""}`);
          } else if (stage === "atlas" || stage === "exported") {
            navigate("/export");
          }
        } catch (error: any) {
          setError(error?.message ?? String(error));
        }
      };

      return {
        id: spec.id,
        title: spec.title,
        assetType: spec.assetType,
        stage,
        thumbnailPath: activeVariant?.previewPath ?? activeVariant?.originalPath,
        variantCount: latestVersion?.variants?.length ?? 0,
        progress,
        meta: latestVersion?.status ? `Version: ${latestVersion.status}` : "No versions yet",
        policyBadges: [
          spec.baselineProfileId ? `Baseline:${spec.baselineProfileId}` : "Baseline:default",
          `LoRA:${spec.loraPolicy?.mode ?? selectedProject?.policies?.loraSelection?.mode ?? "project-default"}`,
          `Style:${spec.styleConsistency?.mode ?? "inherit_project"}`,
          `Quality:${spec.qualityContract?.backgroundPolicy ?? "white_or_transparent"}`,
        ],
        evidenceBadge: evidenceBadgeFromGeneration(latestVersion?.generation),
        primaryActionLabel,
        onPrimaryAction,
      };
    });
  }, [
    assetsBySpecId,
    jobs,
    navigate,
    refreshProjectData,
    runPipelineForSpec,
    selectedProject?.policies?.loraSelection?.mode,
    selectedProjectId,
    setError,
    specs,
  ]);

  const loraModeOptions = useMemo(() => {
    const values = Array.from(new Set(specs.map((spec) => spec.loraPolicy?.mode ?? "project-default"))).sort();
    return [{ value: "all", label: "All LoRA policies" }, ...values.map((value) => ({ value, label: value }))];
  }, [specs]);

  const styleModeOptions = useMemo(() => {
    const values = Array.from(new Set(specs.map((spec) => spec.styleConsistency?.mode ?? "inherit_project"))).sort();
    return [{ value: "all", label: "All style consistency" }, ...values.map((value) => ({ value, label: value }))];
  }, [specs]);

  const backgroundPolicyOptions = useMemo(() => {
    const values = Array.from(
      new Set(specs.map((spec) => spec.qualityContract?.backgroundPolicy ?? "white_or_transparent")),
    ).sort();
    return [{ value: "all", label: "All quality backgrounds" }, ...values.map((value) => ({ value, label: value }))];
  }, [specs]);

  const filteredBoardItems = useMemo(() => {
    const q = queryFilter.trim().toLowerCase();
    return boardItems.filter((item) => {
      const matchesQuery = !q || item.title.toLowerCase().includes(q) || item.id.toLowerCase().includes(q);
      const badges = item.policyBadges ?? [];
      const matchesLora = loraModeFilter === "all" || badges.includes(`LoRA:${loraModeFilter}`);
      const matchesStyle = styleModeFilter === "all" || badges.includes(`Style:${styleModeFilter}`);
      const matchesBackground =
        backgroundPolicyFilter === "all" || badges.includes(`Quality:${backgroundPolicyFilter}`);
      return matchesQuery && matchesLora && matchesStyle && matchesBackground;
    });
  }, [backgroundPolicyFilter, boardItems, loraModeFilter, queryFilter, styleModeFilter]);

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <div>
          <Title order={3}>Pipeline</Title>
          <Text c="dimmed">See every spec moving from draft to export.</Text>
        </div>
        <Group className="ag-page-actions">
          <Button onClick={() => setWizardOpened(true)}>New Spec (Wizard)</Button>
          <Button variant="light" onClick={() => navigate("/review/decision-sprint")}>
            Start Decision Sprint
          </Button>
          <Button variant="light" onClick={() => refreshProjectData().catch(() => undefined)}>
            Refresh board
          </Button>
        </Group>
      </Group>
      <Card withBorder radius="md" p="sm" className="ag-card-tier-1">
        <Group grow>
          <TextInput
            label="Search specs"
            placeholder="Title or id"
            value={queryFilter}
            onChange={(event) => setPipelineParam("q", event.currentTarget.value, "")}
          />
          <Select
            label="LoRA policy"
            data={loraModeOptions}
            value={loraModeFilter}
            onChange={(value) => setPipelineParam("loraMode", value ?? "all", "all")}
          />
          <Select
            label="Style consistency"
            data={styleModeOptions}
            value={styleModeFilter}
            onChange={(value) => setPipelineParam("styleConsistency", value ?? "all", "all")}
          />
          <Select
            label="Quality background"
            data={backgroundPolicyOptions}
            value={backgroundPolicyFilter}
            onChange={(value) => setPipelineParam("backgroundPolicy", value ?? "all", "all")}
          />
        </Group>
      </Card>
      <PipelineBoard items={filteredBoardItems} onStartDecisionSprint={() => navigate("/review/decision-sprint")} />
      <SpecWizard
        opened={wizardOpened}
        projectId={selectedProjectId}
        assetTypeOptions={assetTypeCatalog?.assetTypes?.map((item) => item.id) ?? []}
        projectLoraPolicy={selectedProject?.policies?.loraSelection}
        onClose={() => setWizardOpened(false)}
        onCreated={() => refreshProjectData().catch(() => undefined)}
        onError={setError}
      />
    </Stack>
  );
}
