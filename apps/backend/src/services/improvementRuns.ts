import fs from "node:fs/promises";
import path from "node:path";

import { ulid } from "ulid";

import { fileExists, readJson, writeJsonAtomic } from "../lib/json";
import type { SchemaRegistry } from "../lib/schemas";
import { appendProjectEvent } from "./events";

// ── Types ─────────────────────────────────────────────────────────────

export type CohortSelection = {
  selectionMethod: "by_asset_type" | "by_checkpoint" | "by_tag" | "by_entity_family" | "by_spec_ids" | "all";
  assetType?: string;
  checkpointId?: string;
  tag?: string;
  entityFamily?: string;
  specIds?: string[];
  resolvedSpecIds?: string[];
  resolvedCount?: number;
};

export type Intervention = {
  type:
    | "rule_change"
    | "baseline_update"
    | "checkpoint_switch"
    | "prompt_tweak"
    | "lora_swap"
    | "validator_threshold_change";
  ruleId?: string;
  baselineProfileId?: string;
  checkpointId?: string;
  description?: string;
  params?: Record<string, unknown>;
};

export type MetricSnapshot = {
  totalAssets?: number;
  approvedCount?: number;
  rejectedCount?: number;
  firstPassApprovalRate?: number;
  validatorPassRate?: number;
  avgValidatorScore?: number;
  escalationCount?: number;
  avgGenerationTimeMs?: number;
  cohesionScore?: number;
  driftScore?: number;
  sampledAt?: string;
};

export type MetricDelta = {
  firstPassApprovalRateDelta?: number;
  validatorPassRateDelta?: number;
  avgValidatorScoreDelta?: number;
  escalationCountDelta?: number;
  cohesionScoreDelta?: number;
  driftScoreDelta?: number;
  qualityLiftPct?: number;
};

export type ImprovementRun = {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  status: "draft" | "running" | "completed" | "failed" | "rolled_back";
  cohort: CohortSelection;
  intervention: Intervention;
  metrics?: {
    before?: MetricSnapshot;
    after?: MetricSnapshot;
    delta?: MetricDelta;
  };
  promotionDecision?: "pending" | "promoted" | "rolled_back" | "deferred";
  promotedAt?: string;
  rolledBackAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

function nowIso() {
  return new Date().toISOString();
}

// ── CRUD ──────────────────────────────────────────────────────────────

export async function listImprovementRuns(projectsRoot: string, projectId: string): Promise<ImprovementRun[]> {
  const dir = path.join(projectsRoot, projectId, "improvement-runs");
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const items: ImprovementRun[] = [];
    for (const e of entries) {
      if (!e.isFile() || !e.name.endsWith(".json")) continue;
      items.push(await readJson<ImprovementRun>(path.join(dir, e.name)));
    }
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return items;
  } catch {
    return [];
  }
}

export async function getImprovementRun(
  projectsRoot: string,
  projectId: string,
  runId: string,
): Promise<ImprovementRun | null> {
  const filePath = path.join(projectsRoot, projectId, "improvement-runs", `${runId}.json`);
  if (!(await fileExists(filePath))) return null;
  return readJson<ImprovementRun>(filePath);
}

export async function createImprovementRun(opts: {
  projectsRoot: string;
  schemas: SchemaRegistry;
  projectId: string;
  name: string;
  description?: string;
  cohort: CohortSelection;
  intervention: Intervention;
  notes?: string;
}): Promise<ImprovementRun> {
  const id = ulid();
  const now = nowIso();

  // Resolve cohort spec IDs based on selection method
  const resolvedSpecIds = await resolveCohortSpecIds(opts.projectsRoot, opts.projectId, opts.cohort);

  const run: ImprovementRun = {
    id,
    projectId: opts.projectId,
    name: opts.name,
    description: opts.description,
    status: "draft",
    cohort: {
      ...opts.cohort,
      resolvedSpecIds,
      resolvedCount: resolvedSpecIds.length,
    },
    intervention: opts.intervention,
    promotionDecision: "pending",
    notes: opts.notes,
    createdAt: now,
    updatedAt: now,
  };

  opts.schemas.validateOrThrow("improvement-run.schema.json", run);
  const filePath = path.join(opts.projectsRoot, opts.projectId, "improvement-runs", `${id}.json`);
  await writeJsonAtomic(filePath, run);

  await appendProjectEvent({
    projectsRoot: opts.projectsRoot,
    schemas: opts.schemas,
    event: {
      projectId: opts.projectId,
      type: "improvement_run_created",
      entityType: "improvement_run",
      entityId: id,
      idempotencyKey: `improvement_run:${id}:created`,
      payload: { name: run.name, cohortSize: resolvedSpecIds.length, interventionType: run.intervention.type },
    },
  }).catch(() => undefined);

  return run;
}

export async function updateImprovementRun(opts: {
  projectsRoot: string;
  schemas: SchemaRegistry;
  projectId: string;
  runId: string;
  patch: Partial<
    Pick<ImprovementRun, "status" | "metrics" | "promotionDecision" | "promotedAt" | "rolledBackAt" | "notes">
  >;
}): Promise<ImprovementRun | null> {
  const filePath = path.join(opts.projectsRoot, opts.projectId, "improvement-runs", `${opts.runId}.json`);
  if (!(await fileExists(filePath))) return null;
  const run = await readJson<ImprovementRun>(filePath);

  if (opts.patch.status !== undefined) run.status = opts.patch.status;
  if (opts.patch.metrics !== undefined) run.metrics = opts.patch.metrics;
  if (opts.patch.promotionDecision !== undefined) run.promotionDecision = opts.patch.promotionDecision;
  if (opts.patch.promotedAt !== undefined) run.promotedAt = opts.patch.promotedAt;
  if (opts.patch.rolledBackAt !== undefined) run.rolledBackAt = opts.patch.rolledBackAt;
  if (opts.patch.notes !== undefined) run.notes = opts.patch.notes;
  run.updatedAt = nowIso();

  opts.schemas.validateOrThrow("improvement-run.schema.json", run);
  await writeJsonAtomic(filePath, run);
  return run;
}

/**
 * Sample "before" metrics for the cohort by scanning assets and validation results.
 */
export async function sampleCohortMetrics(
  projectsRoot: string,
  projectId: string,
  specIds: string[],
): Promise<MetricSnapshot> {
  const assetsDir = path.join(projectsRoot, projectId, "assets");
  const validationDir = path.join(projectsRoot, projectId, "baseline-validation-results");

  let total = 0;
  let approved = 0;
  let rejected = 0;

  // Count assets linked to cohort specs
  try {
    const entries = await fs.readdir(assetsDir, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isFile() || !e.name.endsWith(".json")) continue;
      const asset = await readJson<{ specId?: string; versions?: Array<{ status?: string }> }>(
        path.join(assetsDir, e.name),
      );
      if (specIds.length > 0 && asset.specId && !specIds.includes(asset.specId)) continue;
      total++;
      const latestVersion = asset.versions?.[0];
      if (latestVersion?.status === "approved") approved++;
      if (latestVersion?.status === "rejected") rejected++;
    }
  } catch {
    // no assets yet
  }

  // Count validation results
  let validatorPass = 0;
  let validatorTotal = 0;
  let scoreSum = 0;
  let scoreCount = 0;
  try {
    const entries = await fs.readdir(validationDir, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isFile() || !e.name.endsWith(".json")) continue;
      const result = await readJson<{
        specId?: string;
        status?: string;
        checks?: Array<{ score?: number }>;
      }>(path.join(validationDir, e.name));
      if (specIds.length > 0 && result.specId && !specIds.includes(result.specId)) continue;
      validatorTotal++;
      if (result.status === "pass") validatorPass++;
      for (const check of result.checks ?? []) {
        if (check.score !== undefined) {
          scoreSum += check.score;
          scoreCount++;
        }
      }
    }
  } catch {
    // no validation results yet
  }

  return {
    totalAssets: total,
    approvedCount: approved,
    rejectedCount: rejected,
    firstPassApprovalRate: total > 0 ? approved / total : 0,
    validatorPassRate: validatorTotal > 0 ? validatorPass / validatorTotal : 0,
    avgValidatorScore: scoreCount > 0 ? scoreSum / scoreCount : 0,
    escalationCount: 0,
    sampledAt: nowIso(),
  };
}

/**
 * Compute delta between before and after snapshots.
 */
export function computeMetricDelta(before: MetricSnapshot, after: MetricSnapshot): MetricDelta {
  const fparBefore = before.firstPassApprovalRate ?? 0;
  const fparAfter = after.firstPassApprovalRate ?? 0;
  const vpBefore = before.validatorPassRate ?? 0;
  const vpAfter = after.validatorPassRate ?? 0;
  const avsBefore = before.avgValidatorScore ?? 0;
  const avsAfter = after.avgValidatorScore ?? 0;

  return {
    firstPassApprovalRateDelta: fparAfter - fparBefore,
    validatorPassRateDelta: vpAfter - vpBefore,
    avgValidatorScoreDelta: avsAfter - avsBefore,
    escalationCountDelta: (after.escalationCount ?? 0) - (before.escalationCount ?? 0),
    cohesionScoreDelta: (after.cohesionScore ?? 0) - (before.cohesionScore ?? 0),
    driftScoreDelta: (after.driftScore ?? 0) - (before.driftScore ?? 0),
    qualityLiftPct: fparBefore > 0 ? ((fparAfter - fparBefore) / fparBefore) * 100 : 0,
  };
}

/**
 * Promote an improvement run: marks it promoted with timestamp.
 * Only completed runs with pending promotion and positive quality lift can be promoted.
 */
export async function promoteImprovementRun(opts: {
  projectsRoot: string;
  schemas: SchemaRegistry;
  projectId: string;
  runId: string;
}): Promise<ImprovementRun | null> {
  const run = await getImprovementRun(opts.projectsRoot, opts.projectId, opts.runId);
  if (!run) return null;
  if (run.status !== "completed") {
    throw new Error(`Cannot promote run in '${run.status}' status — must be 'completed'`);
  }
  if (run.promotionDecision !== "pending" && run.promotionDecision !== "deferred") {
    throw new Error(`Run already has promotion decision '${run.promotionDecision}'`);
  }
  // Quality gate: block promotion if the intervention regressed quality
  const qualityLift = run.metrics?.delta?.qualityLiftPct;
  if (qualityLift !== undefined && qualityLift < 0) {
    throw new Error(
      `Quality gate failed: qualityLiftPct is ${qualityLift.toFixed(1)}% (must be >= 0 to promote). ` +
        `Consider rolling back instead.`,
    );
  }
  // Additional gate: first-pass approval must not regress
  const fparDelta = run.metrics?.delta?.firstPassApprovalRateDelta;
  if (fparDelta !== undefined && fparDelta < -0.05) {
    throw new Error(
      `Quality gate failed: first-pass approval rate dropped by ${(fparDelta * 100).toFixed(1)}%. ` +
        `Promotion blocked; consider rolling back.`,
    );
  }
  const updated = await updateImprovementRun({
    ...opts,
    patch: {
      status: "completed",
      promotionDecision: "promoted",
      promotedAt: nowIso(),
    },
  });
  await emitRunLifecycleEvent(opts, "improvement_run_promoted", {
    promotionDecision: "promoted",
    qualityLiftPct: qualityLift,
    interventionType: run.intervention.type,
  });
  return updated;
}

/**
 * Rollback an improvement run: marks it rolled back.
 * Cannot rollback a draft run that was never started.
 */
export async function rollbackImprovementRun(opts: {
  projectsRoot: string;
  schemas: SchemaRegistry;
  projectId: string;
  runId: string;
}): Promise<ImprovementRun | null> {
  const run = await getImprovementRun(opts.projectsRoot, opts.projectId, opts.runId);
  if (!run) return null;
  if (run.status === "draft") {
    throw new Error("Cannot rollback a draft run that was never started");
  }
  if (run.status === "rolled_back") {
    throw new Error("Run is already rolled back");
  }
  const updated = await updateImprovementRun({
    ...opts,
    patch: {
      status: "rolled_back",
      promotionDecision: "rolled_back",
      rolledBackAt: nowIso(),
    },
  });
  await emitRunLifecycleEvent(opts, "improvement_run_rolled_back", { promotionDecision: "rolled_back" });
  return updated;
}

// ── Lifecycle Events ──────────────────────────────────────────────────

/**
 * Emit a lifecycle event for start / complete / promote / rollback transitions.
 */
async function emitRunLifecycleEvent(
  opts: { projectsRoot: string; schemas: SchemaRegistry; projectId: string; runId: string },
  type: string,
  extra?: Record<string, unknown>,
): Promise<void> {
  await appendProjectEvent({
    projectsRoot: opts.projectsRoot,
    schemas: opts.schemas,
    event: {
      projectId: opts.projectId,
      type,
      entityType: "improvement_run",
      entityId: opts.runId,
      idempotencyKey: `improvement_run:${opts.runId}:${type}`,
      payload: { ...extra },
    },
  }).catch(() => undefined);
}

// ── Helpers ───────────────────────────────────────────────────────────

async function resolveCohortSpecIds(
  projectsRoot: string,
  projectId: string,
  cohort: CohortSelection,
): Promise<string[]> {
  if (cohort.selectionMethod === "by_spec_ids" && cohort.specIds) {
    return cohort.specIds;
  }

  const specsDir = path.join(projectsRoot, projectId, "specs");
  const specIds: string[] = [];
  try {
    const entries = await fs.readdir(specsDir, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isFile() || !e.name.endsWith(".json")) continue;
      const spec = await readJson<{
        id: string;
        assetType?: string;
        checkpointId?: string;
        tags?: string[];
        entityFamily?: string;
      }>(path.join(specsDir, e.name));

      if (cohort.selectionMethod === "all") {
        specIds.push(spec.id);
        continue;
      }
      if (cohort.selectionMethod === "by_asset_type" && spec.assetType === cohort.assetType) {
        specIds.push(spec.id);
        continue;
      }
      if (cohort.selectionMethod === "by_checkpoint" && spec.checkpointId === cohort.checkpointId) {
        specIds.push(spec.id);
        continue;
      }
      if (cohort.selectionMethod === "by_tag" && cohort.tag && spec.tags?.includes(cohort.tag)) {
        specIds.push(spec.id);
        continue;
      }
      if (cohort.selectionMethod === "by_entity_family" && spec.entityFamily === cohort.entityFamily) {
        specIds.push(spec.id);
        continue;
      }
    }
  } catch {
    // specs dir may not exist
  }
  return specIds;
}
