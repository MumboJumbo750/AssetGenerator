import React, { useEffect, useMemo, useState } from "react";
import { Badge, Group, Stack, Tabs, Text, Title } from "@mantine/core";
import { useNavigate } from "react-router-dom";

import {
  activateProjectLoraReleaseRender,
  listAtlases,
  listProjectEvals,
  listProjectLoras,
  listSharedEvals,
  listSharedLoras,
  updateProjectLora,
  type AtlasRecord,
  type LoraEval,
  type LoraRelease,
  type LoraRecord,
} from "../../api";
import { DetailDrawer } from "../../components/DetailDrawer";
import { FilterBar } from "../../components/FilterBar";
import { LoraReleaseRail } from "../../components/LoraReleaseRail";
import { LoraRenderLauncher } from "../../components/LoraRenderLauncher";
import { useAppData } from "../../context/AppDataContext";
import { useFilterState, type LibraryTab } from "../../hooks/useFilterState";
import { AssetsTab } from "./AssetsTab";
import { AtlasesTab } from "./AtlasesTab";
import { ExportsHistoryTab } from "./ExportsHistoryTab";
import { LorasTab } from "./LorasTab";

type DrawerItem =
  | { type: "asset"; id: string }
  | { type: "atlas"; id: string }
  | { type: "lora"; id: string }
  | { type: "export"; id: string }
  | null;

type LoraWithScope = LoraRecord & { scopeLabel: "project" | "baseline" };

function readNumber(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function readString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function generationEvidenceDetails(generation: Record<string, unknown> | undefined) {
  if (!generation) return [] as Array<{ label: string; value: string }>;
  const qualityScore = readNumber(generation, ["qualityScore", "quality", "score"]);
  const confidence = readNumber(generation, ["confidence", "decisionConfidence"]);
  const routing = readString(generation, ["routingDecision", "routing", "route"]);

  const validatorBag =
    (typeof generation.validators === "object" && generation.validators
      ? (generation.validators as Record<string, unknown>)
      : null) ||
    (typeof generation.validation === "object" && generation.validation
      ? (generation.validation as Record<string, unknown>)
      : null) ||
    (typeof generation.baselineValidation === "object" && generation.baselineValidation
      ? (generation.baselineValidation as Record<string, unknown>)
      : null);

  const validatorPasses =
    validatorBag &&
    Object.values(validatorBag).filter((entry) => {
      if (typeof entry === "boolean") return entry;
      if (typeof entry === "object" && entry && "passed" in entry) return Boolean((entry as any).passed);
      return false;
    }).length;
  const validatorTotal = validatorBag ? Object.keys(validatorBag).length : 0;

  const details: Array<{ label: string; value: string }> = [];
  if (qualityScore !== null) details.push({ label: "Quality score", value: qualityScore.toFixed(2) });
  if (confidence !== null) details.push({ label: "Decision confidence", value: confidence.toFixed(2) });
  if (routing) details.push({ label: "Routing", value: routing });
  if (validatorTotal > 0) details.push({ label: "Validators", value: `${validatorPasses}/${validatorTotal} pass` });
  const promptHash = readString(generation, ["promptPackageHash"]);
  if (promptHash) details.push({ label: "Prompt hash", value: promptHash.slice(0, 12) });
  const traceEntries = Array.isArray(generation.promptCompileTrace) ? generation.promptCompileTrace.length : 0;
  if (traceEntries > 0) details.push({ label: "Prompt trace", value: `${traceEntries} layers` });
  const resolvedStack = Array.isArray(generation.resolvedModelStack)
    ? generation.resolvedModelStack.length
    : Array.isArray(generation.loras)
      ? generation.loras.length
      : 0;
  if (resolvedStack > 0) details.push({ label: "Resolved stack", value: `${resolvedStack} models` });
  const resolverExplanation =
    typeof generation.resolverExplanation === "object" && generation.resolverExplanation
      ? (generation.resolverExplanation as Record<string, unknown>)
      : null;
  if (resolverExplanation) {
    const chosen = Array.isArray(resolverExplanation.chosen) ? resolverExplanation.chosen.length : 0;
    const skipped = Array.isArray(resolverExplanation.skipped) ? resolverExplanation.skipped.length : 0;
    const blocked = Array.isArray(resolverExplanation.blocked) ? resolverExplanation.blocked.length : 0;
    details.push({ label: "Resolver", value: `${chosen} chosen, ${skipped} skipped, ${blocked} blocked` });
  }
  const validatorReport =
    typeof generation.validatorReport === "object" && generation.validatorReport
      ? (generation.validatorReport as Record<string, unknown>)
      : null;
  const validatorStatus = validatorReport && typeof validatorReport.status === "string" ? validatorReport.status : "";
  const validatorScore = validatorReport && typeof validatorReport.score === "number" ? validatorReport.score : null;
  if (validatorStatus) {
    details.push({
      label: "Validator status",
      value: validatorScore !== null ? `${validatorStatus} (${validatorScore.toFixed(2)})` : validatorStatus,
    });
  }
  return details;
}

export function LibraryPage() {
  const { selectedProjectId, assets, specs, jobs, setError } = useAppData();
  const navigate = useNavigate();
  const {
    state,
    setTab,
    setQuery,
    setStatus,
    setAssetType,
    setStage,
    setLoraMode,
    setStyleConsistency,
    setBackgroundPolicy,
    setSelected,
  } = useFilterState();

  const [atlases, setAtlases] = useState<AtlasRecord[]>([]);
  const [loras, setLoras] = useState<LoraWithScope[]>([]);
  const [evals, setEvals] = useState<LoraEval[]>([]);
  const [renderLimit, setRenderLimit] = useState(20);
  const [renderStrengthModel, setRenderStrengthModel] = useState(1);
  const [renderStrengthClip, setRenderStrengthClip] = useState(1);
  const [loraActionBusy, setLoraActionBusy] = useState(false);
  const [loraActionError, setLoraActionError] = useState<string | null>(null);

  const drawerItem = useMemo<DrawerItem>(() => {
    if (!state.selected) return null;
    if (state.tab === "assets") return { type: "asset", id: state.selected };
    if (state.tab === "atlases") return { type: "atlas", id: state.selected };
    if (state.tab === "loras") return { type: "lora", id: state.selected };
    return { type: "export", id: state.selected };
  }, [state.selected, state.tab]);

  useEffect(() => {
    if (!selectedProjectId) {
      setAtlases([]);
      setLoras([]);
      setEvals([]);
      return;
    }

    Promise.all([
      listAtlases(selectedProjectId),
      listProjectLoras(selectedProjectId),
      listSharedLoras(),
      listProjectEvals(selectedProjectId),
      listSharedEvals(),
    ])
      .then(([atlasResult, projectLoras, sharedLoras, projectEvals, sharedEvals]) => {
        setAtlases(atlasResult.atlases ?? []);
        setLoras([
          ...(projectLoras.loras ?? []).map((lora) => ({ ...lora, scopeLabel: "project" as const })),
          ...(sharedLoras.loras ?? []).map((lora) => ({ ...lora, scopeLabel: "baseline" as const })),
        ]);
        setEvals([...(projectEvals.evals ?? []), ...(sharedEvals.evals ?? [])]);
      })
      .catch((error: any) => setError(error?.message ?? String(error)));
  }, [selectedProjectId, setError]);

  async function refreshLoraData(projectId: string) {
    const [projectLoras, sharedLoras, projectEvals, sharedEvals] = await Promise.all([
      listProjectLoras(projectId),
      listSharedLoras(),
      listProjectEvals(projectId),
      listSharedEvals(),
    ]);
    setLoras([
      ...(projectLoras.loras ?? []).map((lora) => ({ ...lora, scopeLabel: "project" as const })),
      ...(sharedLoras.loras ?? []).map((lora) => ({ ...lora, scopeLabel: "baseline" as const })),
    ]);
    setEvals([...(projectEvals.evals ?? []), ...(sharedEvals.evals ?? [])]);
  }

  async function onLoraSetStatus(lora: LoraWithScope, releaseId: string, status: LoraRelease["status"]) {
    if (!selectedProjectId || lora.scopeLabel !== "project") return;
    setLoraActionError(null);
    setLoraActionBusy(true);
    try {
      await updateProjectLora(selectedProjectId, lora.id, {
        releaseUpdates: [{ id: releaseId, status }],
      });
      await refreshLoraData(selectedProjectId);
    } catch (error: any) {
      const message = error?.message ?? String(error);
      setLoraActionError(message);
      setError(message);
    } finally {
      setLoraActionBusy(false);
    }
  }

  async function onLoraActivateRender(lora: LoraWithScope, releaseId?: string) {
    if (!selectedProjectId || lora.scopeLabel !== "project") return;
    setLoraActionError(null);
    setLoraActionBusy(true);
    try {
      await activateProjectLoraReleaseRender(selectedProjectId, lora.id, {
        ...(releaseId ? { releaseId } : {}),
        limit: renderLimit,
        strengthModel: renderStrengthModel,
        strengthClip: renderStrengthClip,
      });
      await refreshLoraData(selectedProjectId);
    } catch (error: any) {
      const message = error?.message ?? String(error);
      setLoraActionError(message);
      setError(message);
    } finally {
      setLoraActionBusy(false);
    }
  }

  const exportedSpecIds = useMemo(() => {
    return new Set(
      jobs
        .filter((job) => job.type === "export" && job.status === "succeeded" && typeof job.input?.specId === "string")
        .map((job) => job.input.specId as string),
    );
  }, [jobs]);

  const assetTypes = useMemo(() => Array.from(new Set(specs.map((spec) => spec.assetType))).sort(), [specs]);

  const statusOptions = useMemo(
    () => [
      { value: "all", label: "All statuses" },
      { value: "draft", label: "Draft" },
      { value: "review", label: "Review" },
      { value: "approved", label: "Approved" },
      { value: "rejected", label: "Rejected" },
      { value: "queued", label: "Queued" },
      { value: "running", label: "Running" },
      { value: "succeeded", label: "Succeeded" },
      { value: "failed", label: "Failed" },
      { value: "canceled", label: "Canceled" },
    ],
    [],
  );

  const assetTypeOptions = useMemo(
    () => [{ value: "all", label: "All asset types" }, ...assetTypes.map((value) => ({ value, label: value }))],
    [assetTypes],
  );

  const stageOptions = useMemo(
    () => [
      { value: "all", label: "All stages" },
      { value: "draft", label: "Draft" },
      { value: "generating", label: "Generating" },
      { value: "review", label: "Review" },
      { value: "alpha", label: "Alpha" },
      { value: "atlas", label: "Atlas" },
      { value: "exported", label: "Exported" },
    ],
    [],
  );

  const loraModeOptions = useMemo(() => {
    const values = Array.from(new Set(specs.map((spec) => spec.loraPolicy?.mode ?? "project-default"))).sort();
    return [{ value: "all", label: "All LoRA policies" }, ...values.map((value) => ({ value, label: value }))];
  }, [specs]);

  const styleConsistencyOptions = useMemo(() => {
    const values = Array.from(new Set(specs.map((spec) => spec.styleConsistency?.mode ?? "inherit_project"))).sort();
    return [{ value: "all", label: "All style consistency" }, ...values.map((value) => ({ value, label: value }))];
  }, [specs]);

  const backgroundPolicyOptions = useMemo(() => {
    const values = Array.from(
      new Set(specs.map((spec) => spec.qualityContract?.backgroundPolicy ?? "white_or_transparent")),
    ).sort();
    return [{ value: "all", label: "All quality backgrounds" }, ...values.map((value) => ({ value, label: value }))];
  }, [specs]);

  const drawerContent = useMemo(() => {
    if (!drawerItem) return null;
    if (drawerItem.type === "asset") {
      const asset = assets.find((entry) => entry.id === drawerItem.id);
      const spec = specs.find((entry) => entry.id === asset?.specId);
      const version = asset?.versions[asset.versions.length - 1];
      const variant = version?.variants.find((entry) => entry.id === version.primaryVariantId) ?? version?.variants[0];
      if (!asset) return null;
      return {
        title: spec?.title ?? asset.id,
        subtitle: asset.id,
        imagePath: variant?.previewPath ?? variant?.alphaPath ?? variant?.originalPath,
        badges: [spec?.assetType ?? "unknown", version?.status ?? "unknown"],
        details: [
          { label: "Variants", value: String(version?.variants.length ?? 0) },
          { label: "Baseline profile", value: spec?.baselineProfileId ?? "default" },
          { label: "LoRA policy", value: spec?.loraPolicy?.mode ?? "project-default" },
          { label: "Style consistency", value: spec?.styleConsistency?.mode ?? "inherit_project" },
          { label: "Quality background", value: spec?.qualityContract?.backgroundPolicy ?? "white_or_transparent" },
          ...(version?.generation ? generationEvidenceDetails(version.generation as Record<string, unknown>) : []),
          {
            label: "Resolved LoRA",
            value:
              Array.isArray((version as any)?.generation?.loras) && (version as any).generation.loras[0]
                ? `${String((version as any).generation.loras[0].loraId ?? "manual")}:${String(
                    (version as any).generation.loras[0].releaseId ?? "n/a",
                  )}`
                : "none",
          },
          { label: "Updated", value: asset.updatedAt },
        ],
        actionLabel: "Review this asset",
        onAction: () => navigate(`/review?assetId=${asset.id}`),
      };
    }
    if (drawerItem.type === "atlas") {
      const atlas = atlases.find((entry) => entry.id === drawerItem.id);
      if (!atlas) return null;
      return {
        title: atlas.id,
        subtitle: "Atlas",
        imagePath: atlas.imagePath,
        badges: ["atlas"],
        details: [
          { label: "Frames", value: String(atlas.frames.length) },
          { label: "Updated", value: atlas.updatedAt },
        ],
        actionLabel: "Open classic Atlases",
        onAction: () => navigate("/classic/atlases"),
      };
    }
    if (drawerItem.type === "lora") {
      const lora = loras.find((entry) => entry.id === drawerItem.id);
      if (!lora) return null;
      const loraEvals = evals.filter((entry) => entry.loraId === lora.id);
      return {
        title: lora.name,
        subtitle: lora.id,
        badges: [lora.scopeLabel, lora.checkpointId],
        details: [
          { label: "Asset types", value: lora.assetTypes.join(", ") },
          { label: "Releases", value: String(lora.releases.length) },
          { label: "Evals", value: String(loraEvals.length) },
          { label: "Active release", value: lora.activeReleaseId ?? "none" },
          {
            label: "Latest eval",
            value:
              loraEvals.slice().sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0]?.createdAt ??
              "none",
          },
        ],
        extraContent:
          lora.scopeLabel === "project" ? (
            <Stack gap="sm">
              <LoraReleaseRail
                releases={lora.releases}
                activeReleaseId={lora.activeReleaseId}
                onSetStatus={(releaseId, status) => onLoraSetStatus(lora, releaseId, status).catch(() => undefined)}
                onActivateRender={(releaseId) => onLoraActivateRender(lora, releaseId).catch(() => undefined)}
                busy={loraActionBusy}
              />
              <LoraRenderLauncher
                limit={renderLimit}
                strengthModel={renderStrengthModel}
                strengthClip={renderStrengthClip}
                onLimitChange={setRenderLimit}
                onStrengthModelChange={setRenderStrengthModel}
                onStrengthClipChange={setRenderStrengthClip}
                onRun={() => onLoraActivateRender(lora).catch(() => undefined)}
                busy={loraActionBusy}
              />
              {loraActionError && (
                <Text size="sm" c="red">
                  {loraActionError}
                </Text>
              )}
            </Stack>
          ) : (
            <Text size="sm" c="dimmed">
              Baseline LoRAs are read-only here.
            </Text>
          ),
      };
    }
    const exportJob = jobs.find((entry) => entry.id === drawerItem.id && entry.type === "export");
    if (!exportJob) return null;
    return {
      title: `Export ${exportJob.id}`,
      subtitle: typeof exportJob.input?.exportId === "string" ? (exportJob.input.exportId as string) : undefined,
      badges: [exportJob.status],
      details: [
        { label: "Created", value: exportJob.createdAt },
        { label: "Updated", value: exportJob.updatedAt },
      ],
      actionLabel: "Open Export zone",
      onAction: () => navigate("/export"),
    };
  }, [
    assets,
    atlases,
    drawerItem,
    evals,
    jobs,
    loraActionBusy,
    loraActionError,
    loras,
    navigate,
    renderLimit,
    renderStrengthClip,
    renderStrengthModel,
    specs,
  ]);

  const activeTabCount = useMemo(() => {
    if (state.tab === "assets") return assets.length;
    if (state.tab === "atlases") return atlases.length;
    if (state.tab === "loras") return loras.length;
    return jobs.filter((job) => job.type === "export").length;
  }, [assets.length, atlases.length, jobs, loras.length, state.tab]);

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <div>
          <Title order={3}>Library</Title>
          <Text c="dimmed">Visual grid browse with URL-synced facets.</Text>
        </div>
        <Badge variant="light">{activeTabCount} items</Badge>
      </Group>

      <FilterBar
        query={state.q}
        status={state.status}
        assetType={state.assetType}
        stage={state.stage}
        loraMode={state.loraMode}
        styleConsistency={state.styleConsistency}
        backgroundPolicy={state.backgroundPolicy}
        statusOptions={statusOptions}
        assetTypeOptions={assetTypeOptions}
        stageOptions={stageOptions}
        loraModeOptions={state.tab === "assets" ? loraModeOptions : undefined}
        styleConsistencyOptions={state.tab === "assets" ? styleConsistencyOptions : undefined}
        backgroundPolicyOptions={state.tab === "assets" ? backgroundPolicyOptions : undefined}
        onQueryChange={setQuery}
        onStatusChange={setStatus}
        onAssetTypeChange={setAssetType}
        onStageChange={setStage}
        onLoraModeChange={state.tab === "assets" ? setLoraMode : undefined}
        onStyleConsistencyChange={state.tab === "assets" ? setStyleConsistency : undefined}
        onBackgroundPolicyChange={state.tab === "assets" ? setBackgroundPolicy : undefined}
      />

      <Tabs
        value={state.tab}
        onChange={(value) => {
          setTab((value as LibraryTab) ?? "assets");
          setSelected("");
        }}
      >
        <Tabs.List className="ag-library-tabs">
          <Tabs.Tab value="assets">Assets</Tabs.Tab>
          <Tabs.Tab value="atlases">Atlases</Tabs.Tab>
          <Tabs.Tab value="loras">LoRAs</Tabs.Tab>
          <Tabs.Tab value="exports">Exports</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="assets" pt="md">
          <AssetsTab
            assets={assets}
            specs={specs}
            query={state.q}
            status={state.status}
            assetType={state.assetType}
            stage={state.stage}
            loraMode={state.loraMode}
            styleConsistency={state.styleConsistency}
            backgroundPolicy={state.backgroundPolicy}
            exportedSpecIds={exportedSpecIds}
            onSelectItem={(itemId) => setSelected(itemId)}
          />
        </Tabs.Panel>

        <Tabs.Panel value="atlases" pt="md">
          <AtlasesTab
            atlases={atlases}
            query={state.q}
            stage={state.stage}
            onSelectItem={(itemId) => setSelected(itemId)}
          />
        </Tabs.Panel>

        <Tabs.Panel value="loras" pt="md">
          <LorasTab
            loras={loras}
            evals={evals}
            query={state.q}
            stage={state.stage}
            onSelectItem={(itemId) => setSelected(itemId)}
          />
        </Tabs.Panel>

        <Tabs.Panel value="exports" pt="md">
          <ExportsHistoryTab
            jobs={jobs}
            query={state.q}
            status={state.status}
            stage={state.stage}
            onSelectItem={(itemId) => setSelected(itemId)}
          />
        </Tabs.Panel>
      </Tabs>

      <DetailDrawer
        opened={Boolean(drawerItem && drawerContent)}
        onClose={() => setSelected("")}
        title={drawerContent?.title ?? ""}
        subtitle={drawerContent?.subtitle}
        imagePath={drawerContent?.imagePath}
        badges={drawerContent?.badges}
        details={drawerContent?.details}
        actionLabel={drawerContent?.actionLabel}
        onAction={drawerContent?.onAction}
        extraContent={drawerContent?.extraContent}
      />
    </Stack>
  );
}
