import React, { useEffect, useMemo, useState } from "react";
import { Badge, Button, Group, SegmentedControl, Stack, Text, Title } from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import { useSearchParams } from "react-router-dom";

import { updateAssetVariant, updateAssetVersion } from "../../api";
import { DecisionQueue } from "../../components/DecisionQueue";
import { ReviewLightbox, type ReviewDecision } from "../../components/ReviewLightbox";
import { useAppData } from "../../context/AppDataContext";
import { LoraActivationQueue } from "./LoraActivationQueue";

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

function evidenceFromGeneration(generation: Record<string, unknown> | undefined) {
  if (!generation) return [];
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
  if (qualityScore !== null) details.push({ label: "Quality", value: qualityScore.toFixed(2) });
  if (confidence !== null) details.push({ label: "Confidence", value: confidence.toFixed(2) });
  if (routing) details.push({ label: "Route", value: routing });
  if (validatorTotal > 0) details.push({ label: "Validators", value: `${validatorPasses}/${validatorTotal} pass` });
  const promptHash = readString(generation, ["promptPackageHash"]);
  if (promptHash) details.push({ label: "Prompt hash", value: promptHash.slice(0, 12) });

  const traceEntries = Array.isArray(generation.promptCompileTrace) ? generation.promptCompileTrace : [];
  if (traceEntries.length > 0) details.push({ label: "Prompt trace", value: `${traceEntries.length} layers` });

  const resolvedStack = Array.isArray(generation.resolvedModelStack)
    ? generation.resolvedModelStack
    : Array.isArray(generation.loras)
      ? generation.loras
      : [];
  if (resolvedStack.length > 0) details.push({ label: "Resolved stack", value: `${resolvedStack.length} models` });

  const resolverExplanation =
    typeof generation.resolverExplanation === "object" && generation.resolverExplanation
      ? (generation.resolverExplanation as Record<string, unknown>)
      : null;
  const resolverChosen = Array.isArray(resolverExplanation?.chosen) ? resolverExplanation.chosen.length : 0;
  const resolverSkipped = Array.isArray(resolverExplanation?.skipped) ? resolverExplanation.skipped.length : 0;
  const resolverBlocked = Array.isArray(resolverExplanation?.blocked) ? resolverExplanation.blocked.length : 0;
  if (resolverExplanation)
    details.push({ label: "Resolver", value: `${resolverChosen} chosen, ${resolverSkipped} skipped, ${resolverBlocked} blocked` });

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

export function ReviewPage() {
  const { selectedProjectId, assets, specs, jobs, refreshProjectData, setError } = useAppData();
  const [searchParams, setSearchParams] = useSearchParams();
  const sprintMode = searchParams.get("mode") === "sprint";

  const reviewQueue = useMemo(() => {
    const activeSpecs = new Set(specs.filter((spec) => spec.status !== "deprecated").map((spec) => spec.id));
    return assets.filter((asset) => {
      if (!activeSpecs.has(asset.specId)) return false;
      const latest = asset.versions[asset.versions.length - 1];
      return latest && latest.status !== "deprecated";
    });
  }, [assets, specs]);

  const requestedAssetId = searchParams.get("assetId") ?? "";
  const initialAssetIndex = useMemo(() => {
    if (!requestedAssetId) return 0;
    const index = reviewQueue.findIndex((asset) => asset.id === requestedAssetId);
    return index >= 0 ? index : 0;
  }, [requestedAssetId, reviewQueue]);

  const [assetIndex, setAssetIndex] = useState(initialAssetIndex);

  useEffect(() => {
    setAssetIndex(initialAssetIndex);
  }, [initialAssetIndex]);

  useEffect(() => {
    if (reviewQueue.length === 0) return;
    const clamped = Math.max(0, Math.min(reviewQueue.length - 1, assetIndex));
    const assetId = reviewQueue[clamped]?.id;
    const next = new URLSearchParams(searchParams);
    if (assetId) next.set("assetId", assetId);
    else next.delete("assetId");
    if (next.toString() === searchParams.toString()) return;
    setSearchParams(next, { replace: true });
  }, [assetIndex, reviewQueue, searchParams, setSearchParams]);

  const activeAsset = reviewQueue[Math.max(0, Math.min(reviewQueue.length - 1, assetIndex))];
  const activeSpec = specs.find((spec) => spec.id === activeAsset?.specId);
  const activeVersion = activeAsset?.versions[activeAsset.versions.length - 1];
  const [variantId, setVariantId] = useState(activeVersion?.primaryVariantId ?? activeVersion?.variants?.[0]?.id ?? "");

  useEffect(() => {
    setVariantId(activeVersion?.primaryVariantId ?? activeVersion?.variants?.[0]?.id ?? "");
  }, [activeVersion?.id, activeVersion?.primaryVariantId]);

  const goPrev = () => setAssetIndex((value) => Math.max(0, value - 1));
  const goNext = () => setAssetIndex((value) => Math.min(reviewQueue.length - 1, value + 1));

  async function applyDecision(decision: ReviewDecision) {
    if (!selectedProjectId || !activeAsset || !activeVersion || !variantId) return;
    try {
      await updateAssetVariant(selectedProjectId, activeAsset.id, activeVersion.id, variantId, {
        status: decision === "approve" ? "selected" : "rejected",
      });
      await updateAssetVersion(selectedProjectId, activeAsset.id, activeVersion.id, {
        status: decision === "approve" ? "approved" : "rejected",
      });
      await refreshProjectData(selectedProjectId);
      goNext();
    } catch (error: any) {
      setError(error?.message ?? String(error));
    }
  }

  async function applyRating(rating: number) {
    if (!selectedProjectId || !activeAsset || !activeVersion || !variantId) return;
    try {
      await updateAssetVariant(selectedProjectId, activeAsset.id, activeVersion.id, variantId, { rating });
      await refreshProjectData(selectedProjectId);
    } catch (error: any) {
      setError(error?.message ?? String(error));
    }
  }

  useHotkeys([
    ["ArrowLeft", () => goPrev()],
    ["ArrowRight", () => goNext()],
    ["KeyA", () => applyDecision("approve").catch(() => undefined)],
    ["KeyR", () => applyDecision("reject").catch(() => undefined)],
    ["Digit1", () => applyRating(1).catch(() => undefined)],
    ["Digit2", () => applyRating(2).catch(() => undefined)],
    ["Digit3", () => applyRating(3).catch(() => undefined)],
    ["Digit4", () => applyRating(4).catch(() => undefined)],
    ["Digit5", () => applyRating(5).catch(() => undefined)],
  ]);

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <div>
          <Title order={3}>{sprintMode ? "Decision Sprint" : "Review"}</Title>
          <Text c="dimmed">
            {sprintMode
              ? "Contract-driven binary review with keyboard flow and review tools."
              : "Fast decisions with keyboard shortcuts."}
          </Text>
        </div>
        <Group className="ag-page-actions">
          {!sprintMode && (
            <Button
              variant="light"
              onClick={() => setSearchParams({ ...Object.fromEntries(searchParams), mode: "sprint" })}
            >
              Start Decision Sprint
            </Button>
          )}
          {sprintMode && (
            <Button variant="light" onClick={() => setSearchParams({ assetId: searchParams.get("assetId") ?? "" })}>
              Exit Sprint
            </Button>
          )}
          <Text c="dimmed">Queue: {reviewQueue.length}</Text>
        </Group>
      </Group>

      <LoraActivationQueue jobs={jobs} onRefresh={() => refreshProjectData().catch(() => undefined)} />

      {/* Decision Sprint 2.0: contract-driven binary questions + review tools */}
      {sprintMode ? (
        <DecisionQueue assets={reviewQueue} />
      ) : !activeAsset || !activeVersion ? (
        <Text size="sm" c="dimmed">
          No assets currently need review.
        </Text>
      ) : (
        <ReviewLightbox
          asset={activeAsset}
          index={assetIndex}
          total={reviewQueue.length}
          theaterMode={sprintMode}
          policyBadges={[
            activeSpec?.baselineProfileId ? `Baseline:${activeSpec.baselineProfileId}` : "Baseline:default",
            `LoRA:${activeSpec?.loraPolicy?.mode ?? "project-default"}`,
            `Style:${activeSpec?.styleConsistency?.mode ?? "inherit_project"}`,
            `Quality:${activeSpec?.qualityContract?.backgroundPolicy ?? "white_or_transparent"}`,
          ]}
          evidenceDetails={evidenceFromGeneration(activeVersion?.generation)}
          selectedVariantId={variantId}
          onSelectVariant={setVariantId}
          onPrev={goPrev}
          onNext={goNext}
          onDecision={(decision) => applyDecision(decision).catch(() => undefined)}
          onSetRating={(rating) => applyRating(rating).catch(() => undefined)}
        />
      )}
    </Stack>
  );
}
