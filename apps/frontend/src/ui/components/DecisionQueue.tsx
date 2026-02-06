import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, Group, Image, Progress, Stack, Text, Title } from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";

import { updateAssetVariant, updateAssetVersion, type Asset, type AssetSpec } from "../api";
import { useAppData } from "../context/AppDataContext";
import { BinaryQuestionCard } from "./BinaryQuestionCard";
import { ReviewToolHost } from "./review-tools/ReviewToolHost";
import { useDecisionSession, type QuestionAnswer } from "../hooks/useDecisionSession";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function toDataUrl(pathValue?: string) {
  if (!pathValue?.trim()) return "";
  if (pathValue.startsWith("http")) return pathValue;
  if (pathValue.startsWith("/data/")) return pathValue;
  if (pathValue.startsWith("data/")) return `/${pathValue}`;
  return `/data/${pathValue}`;
}

function latestImageUrl(asset: Asset) {
  const version = asset.versions[asset.versions.length - 1];
  const variant = version?.variants.find((v) => v.id === version.primaryVariantId) ?? version?.variants[0];
  return toDataUrl(variant?.previewPath ?? variant?.alphaPath ?? variant?.originalPath);
}

/* ------------------------------------------------------------------ */
/*  DecisionQueue                                                      */
/* ------------------------------------------------------------------ */

type DecisionQueueProps = {
  /** Pre-filtered list of assets needing decision sprint review */
  assets?: Asset[];
};

export function DecisionQueue({ assets: overrideAssets }: DecisionQueueProps) {
  const { selectedProjectId, assets: allAssets, specs, refreshProjectData, setError } = useAppData();

  const specsById = useMemo(() => new Map(specs.map((s) => [s.id, s])), [specs]);

  /** Filter to items routed to decision sprint or with uncertain/failing validator */
  const queuedAssets = useMemo(() => {
    if (overrideAssets) return overrideAssets;

    return allAssets.filter((asset) => {
      const version = asset.versions[asset.versions.length - 1];
      if (!version || version.status === "approved" || version.status === "rejected" || version.status === "deprecated")
        return false;
      const gen = version.generation as Record<string, unknown> | undefined;
      if (!gen) return false;

      // Check routing decision
      const routing =
        typeof gen.routingDecision === "string"
          ? gen.routingDecision
          : typeof (gen.routingResult as any)?.decision === "string"
            ? (gen.routingResult as any).decision
            : "";
      if (routing === "queue_decision_sprint" || routing === "manual_review") return true;

      // Check validator status
      const report = gen.validatorReport as Record<string, unknown> | undefined;
      const status = report?.status;
      if (status === "warn" || status === "fail") return true;

      return false;
    });
  }, [overrideAssets, allAssets]);

  const session = useDecisionSession();
  const {
    state,
    currentItem,
    currentQuestion,
    isComplete,
    summary,
    approvedAssetIds,
    rejectedAssetIds,
    unsureAssetIds,
    answer,
    skipItem,
    undo,
    loadItems,
    reset,
  } = session;

  // Load items when queue changes
  useEffect(() => {
    loadItems(queuedAssets, specsById);
  }, [queuedAssets, specsById, loadItems]);

  // Resolve helper tool metadata from asset tags
  const currentAssetTags = useMemo(() => {
    if (!currentItem) return [];
    const spec = currentItem.spec;
    const gen = currentItem.asset.versions[currentItem.asset.versions.length - 1]?.generation as
      | Record<string, unknown>
      | undefined;
    const tags: string[] = [];
    if (spec?.assetType) tags.push(`assetType:${spec.assetType}`);
    if (Array.isArray((spec as any)?.tags)) tags.push(...(spec as any).tags);
    if (Array.isArray(gen?.tags)) tags.push(...(gen.tags as string[]));
    return tags;
  }, [currentItem]);

  const currentHelperTools = currentQuestion?.helperTools ?? [];

  // Apply-to-similar: track pending similar-item prompt
  const [applyToSimilarPending, setApplyToSimilarPending] = useState<{
    sourceAssetType: string;
    similarItemIndexes: number[];
  } | null>(null);

  /**
   * Find unanswered items with the same assetType as the current item.
   * Called after a user completes all questions for an item with all "yes" answers.
   */
  const findSimilarUnanswered = useCallback(
    (completedItem: typeof currentItem) => {
      if (!completedItem?.spec?.assetType) return [];
      const assetType = completedItem.spec.assetType;
      const indexes: number[] = [];
      for (let i = 0; i < state.items.length; i++) {
        const item = state.items[i];
        if (item === completedItem) continue;
        if (item.answers.length >= item.questions.length) continue; // already answered
        if (item.spec?.assetType !== assetType) continue;
        indexes.push(i);
      }
      return indexes;
    },
    [state.items],
  );

  /**
   * Wrap the answer function to detect completed-all-yes and trigger apply-to-similar prompt.
   */
  const answerWithSimilarCheck = useCallback(
    (value: QuestionAnswer) => {
      // Dismiss any pending prompt on new answer
      setApplyToSimilarPending(null);

      // Check if this answer will complete the current item with all-yes
      if (value === "yes" && currentItem) {
        const willComplete = state.currentQuestionIndex + 1 >= currentItem.questions.length;
        const allPreviousYes =
          currentItem.answers.length === state.currentQuestionIndex &&
          currentItem.answers.every((a) => a.answer === "yes");
        if (willComplete && allPreviousYes) {
          const similarIndexes = findSimilarUnanswered(currentItem);
          if (similarIndexes.length > 0 && currentItem.spec?.assetType) {
            // Dispatch the answer first, then show prompt
            answer(value);
            setApplyToSimilarPending({
              sourceAssetType: currentItem.spec.assetType,
              similarItemIndexes: similarIndexes,
            });
            return;
          }
        }
      }
      answer(value);
    },
    [answer, currentItem, state.currentQuestionIndex, findSimilarUnanswered],
  );

  /** Apply all-yes to similar items */
  const applyToSimilar = useCallback(() => {
    if (!applyToSimilarPending) return;
    for (const idx of applyToSimilarPending.similarItemIndexes) {
      const item = state.items[idx];
      if (!item || item.answers.length >= item.questions.length) continue;
      // Answer all remaining questions "yes" via goToItem + answer sequence
      // We use dispatch directly through the session's goToItem & answer helpers
      session.goToItem(idx);
      for (let q = 0; q < item.questions.length; q++) {
        session.answer("yes");
      }
    }
    setApplyToSimilarPending(null);
  }, [applyToSimilarPending, state.items, session]);

  const dismissSimilar = useCallback(() => {
    setApplyToSimilarPending(null);
  }, []);

  // Apply batch decisions to API
  const applyBatchDecisions = useCallback(async () => {
    if (!selectedProjectId) return;
    try {
      for (const assetId of approvedAssetIds) {
        const asset = queuedAssets.find((a) => a.id === assetId);
        if (!asset) continue;
        const version = asset.versions[asset.versions.length - 1];
        const variantId = version?.primaryVariantId ?? version?.variants[0]?.id;
        if (!version || !variantId) continue;
        await updateAssetVariant(selectedProjectId, asset.id, version.id, variantId, { status: "selected" });
        await updateAssetVersion(selectedProjectId, asset.id, version.id, { status: "approved" });
      }
      for (const assetId of rejectedAssetIds) {
        const asset = queuedAssets.find((a) => a.id === assetId);
        if (!asset) continue;
        const version = asset.versions[asset.versions.length - 1];
        const variantId = version?.primaryVariantId ?? version?.variants[0]?.id;
        if (!version || !variantId) continue;
        await updateAssetVariant(selectedProjectId, asset.id, version.id, variantId, { status: "rejected" });
        await updateAssetVersion(selectedProjectId, asset.id, version.id, { status: "rejected" });
      }
      // Route "unsure" items to exception inbox — tag in generation metadata
      for (const assetId of unsureAssetIds) {
        const asset = queuedAssets.find((a) => a.id === assetId);
        if (!asset) continue;
        const version = asset.versions[asset.versions.length - 1];
        if (!version) continue;
        await updateAssetVersion(selectedProjectId, asset.id, version.id, {
          status: "review",
          generationPatch: { escalatedTo: "exception_inbox", escalationReason: "decision_sprint_unsure" },
        });
      }
      await refreshProjectData(selectedProjectId);
      reset();
    } catch (err: any) {
      setError(err?.message ?? String(err));
    }
  }, [
    selectedProjectId,
    approvedAssetIds,
    rejectedAssetIds,
    unsureAssetIds,
    queuedAssets,
    refreshProjectData,
    reset,
    setError,
  ]);

  // Keyboard shortcuts
  useHotkeys([
    ["KeyY", () => answerWithSimilarCheck("yes")],
    ["KeyN", () => answerWithSimilarCheck("no")],
    ["KeyU", () => answerWithSimilarCheck("unsure")],
    ["KeyS", () => skipItem()],
    ["KeyZ", () => undo()],
  ]);

  // Get image URL for current asset
  const currentImageUrl = currentItem ? latestImageUrl(currentItem.asset) : "";
  const currentVersion = currentItem?.asset.versions[currentItem.asset.versions.length - 1];
  const currentVariant =
    currentVersion?.variants.find((v) => v.id === currentVersion.primaryVariantId) ?? currentVersion?.variants[0];

  /* ---------------------------------------------------------------- */
  /*  Empty state                                                      */
  /* ---------------------------------------------------------------- */
  if (queuedAssets.length === 0) {
    return (
      <Card withBorder radius="md" p="xl" className="ag-card-tier-1">
        <Stack align="center" gap="md">
          <Title order={4}>Decision Sprint Queue</Title>
          <Text c="dimmed">No assets currently need decision sprint review.</Text>
          <Text size="xs" c="dimmed">
            Assets routed here by validators with uncertain or failing results will appear automatically.
          </Text>
        </Stack>
      </Card>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Completed state                                                  */
  /* ---------------------------------------------------------------- */
  if (isComplete) {
    return (
      <Card withBorder radius="md" p="xl" className="ag-card-tier-2">
        <Stack align="center" gap="lg">
          <Title order={3}>Sprint Complete</Title>
          <Group gap="lg">
            <Badge size="lg" color="green" variant="light">
              {summary.yesCount} approved
            </Badge>
            <Badge size="lg" color="red" variant="light">
              {summary.noCount} rejected
            </Badge>
            <Badge size="lg" color="yellow" variant="light">
              {summary.unsureCount} unsure → exception
            </Badge>
            <Badge size="lg" color="gray" variant="light">
              {summary.skipCount} skipped
            </Badge>
          </Group>
          <Group gap="sm">
            <Button color="green" onClick={applyBatchDecisions}>
              Apply All Decisions
            </Button>
            <Button variant="light" onClick={reset}>
              Reset
            </Button>
          </Group>
        </Stack>
      </Card>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Active sprint                                                    */
  /* ---------------------------------------------------------------- */
  const progress =
    state.items.length > 0 ? ((state.completedCount + state.skippedCount) / state.items.length) * 100 : 0;

  return (
    <Stack gap="md" className="ag-decision-queue">
      {/* Progress bar */}
      <Group justify="space-between" align="center">
        <Title order={4}>Decision Sprint</Title>
        <Group gap="xs">
          <Badge variant="light">
            {summary.completed + summary.skipped} / {summary.total}
          </Badge>
          <Badge variant="light" color="green">
            {summary.yesCount} yes
          </Badge>
          <Badge variant="light" color="red">
            {summary.noCount} no
          </Badge>
        </Group>
      </Group>
      <Progress value={progress} size="sm" radius="xl" color="cyan" />

      {/* Main stage */}
      <div className="ag-decision-stage">
        {/* Image side */}
        <div className="ag-decision-image-panel">
          <div className="ag-review-stage ag-decision-image-container">
            {currentImageUrl ? (
              <ReviewToolHost
                imageUrl={currentImageUrl}
                activeTools={currentHelperTools}
                asset={currentItem?.asset ?? null}
                tags={currentAssetTags}
              />
            ) : (
              <Text c="dimmed">No image available</Text>
            )}
          </div>
          {/* Spec info */}
          {currentItem?.spec && (
            <Group gap={6} mt="xs">
              <Badge size="xs" variant="outline">
                {currentItem.spec.assetType}
              </Badge>
              <Text size="xs" c="dimmed" lineClamp={1}>
                {currentItem.spec.title}
              </Text>
            </Group>
          )}
        </div>

        {/* Question side */}
        <div className="ag-decision-question-panel">
          {currentQuestion && (
            <BinaryQuestionCard
              question={currentQuestion}
              questionIndex={state.currentQuestionIndex}
              totalQuestions={currentItem?.questions.length ?? 0}
              onAnswer={answerWithSimilarCheck}
              onUndo={undo}
              canUndo={state.undoStack.length > 0}
            />
          )}

          {/* Apply-to-similar prompt */}
          {applyToSimilarPending && (
            <Card
              withBorder
              radius="sm"
              p="md"
              mt="sm"
              className="ag-card-tier-2"
              style={{ borderColor: "var(--mantine-color-cyan-7)" }}
            >
              <Stack gap="sm">
                <Text size="sm" fw={600}>
                  Apply to similar assets?
                </Text>
                <Text size="xs" c="dimmed">
                  {applyToSimilarPending.similarItemIndexes.length} other{" "}
                  <Badge size="xs" variant="outline">
                    {applyToSimilarPending.sourceAssetType}
                  </Badge>{" "}
                  asset(s) in the queue can be auto-approved with the same decision.
                </Text>
                <Group gap="sm">
                  <Button size="xs" color="cyan" onClick={applyToSimilar}>
                    Yes, approve similar
                  </Button>
                  <Button size="xs" variant="subtle" color="gray" onClick={dismissSimilar}>
                    No, review individually
                  </Button>
                </Group>
              </Stack>
            </Card>
          )}

          {/* Upcoming questions for this item */}
          {currentItem && currentItem.questions.length > 1 && (
            <Card withBorder radius="sm" p="sm" mt="sm" className="ag-card-tier-1">
              <Text size="xs" fw={600} mb={4}>
                Remaining questions
              </Text>
              <Stack gap={4}>
                {currentItem.questions.slice(state.currentQuestionIndex + 1).map((q, i) => (
                  <Group key={q.id} gap="xs">
                    <Text size="xs" c="dimmed">
                      {state.currentQuestionIndex + 2 + i}.
                    </Text>
                    <Text size="xs" c="dimmed" lineClamp={1}>
                      {q.text}
                    </Text>
                  </Group>
                ))}
              </Stack>
            </Card>
          )}

          <Text size="xs" c="dimmed" mt="sm">
            Keyboard: Y = yes, N = no, U = unsure, S = skip item, Z = undo
          </Text>
        </div>
      </div>
    </Stack>
  );
}
