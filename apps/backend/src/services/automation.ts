import fs from "node:fs/promises";
import path from "node:path";

import { ulid } from "ulid";

import { fileExists, readJson, writeJsonAtomic } from "../lib/json";
import type { SchemaRegistry } from "../lib/schemas";
import { getAsset, listAssets, updateAssetVariant, updateAssetVersion } from "./assets";
import { createJob, type Job } from "./jobs";
import { getSpec, listSpecs } from "./specs";
import { appendProjectEvent } from "./events";
import { upsertAutomationRunIndexEntry } from "./indexes";
import { recordTriggerAndCheck } from "./circuitBreakers";

export type AutomationRule = {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string;
  notes?: string;
  trigger: {
    type: "spec_refined" | "asset_approved" | "atlas_ready" | "lora_release_activated" | "schedule" | "manual";
    schedule?: unknown;
  };
  conditions?: Record<string, unknown>;
  actions: Array<{
    type:
      | "enqueue_job"
      | "run_eval_grid"
      | "enqueue_lora_renders"
      | "apply_tags"
      | "set_status"
      | "export"
      | "auto_atlas_pack";
    config?: unknown;
  }>;
};

export type AutomationRun = {
  id: string;
  projectId: string;
  ruleId: string;
  status: "queued" | "running" | "succeeded" | "failed" | "canceled";
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  endedAt?: string;
  dryRun?: boolean;
  error?: string;
  meta?: Record<string, unknown>;
  steps?: Array<{
    id: string;
    type: string;
    status: "queued" | "running" | "succeeded" | "failed" | "canceled";
    startedAt?: string;
    endedAt?: string;
    error?: string;
    meta?: Record<string, unknown>;
  }>;
};

function nowIso() {
  return new Date().toISOString();
}

type AutomationEvent = {
  type: AutomationRule["trigger"]["type"];
  payload?: Record<string, unknown>;
};

type Condition = { field: string; equals?: unknown; in?: unknown[] };
type Conditions = { all?: Condition[]; any?: Condition[] } | Record<string, unknown>;

type LoraRecord = {
  id: string;
  name?: string;
  scope?: "baseline" | "project";
  checkpointId: string;
  activeReleaseId?: string;
  assetTypes?: string[];
  releases?: Array<{
    id: string;
    status?: "candidate" | "approved" | "deprecated";
    localPath?: string;
    weights?: { path?: string };
  }>;
};

async function loadLoraRecord(opts: { projectsRoot: string; dataRoot: string; projectId: string; loraId: string }) {
  const projectPath = path.join(opts.projectsRoot, opts.projectId, "loras", `${opts.loraId}.json`);
  if (await fileExists(projectPath)) return readJson<LoraRecord>(projectPath);
  const sharedPath = path.join(opts.dataRoot, "shared", "loras", `${opts.loraId}.json`);
  if (await fileExists(sharedPath)) return readJson<LoraRecord>(sharedPath);
  return null;
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => (typeof item === "string" ? item.trim() : "")).filter((item) => item.length > 0);
}

function normalizePathLike(value: string) {
  return value.replace(/\\/g, "/");
}

function resolveLoraWeightPath(release: { localPath?: string; weights?: { path?: string } }) {
  const weightPath = typeof release.weights?.path === "string" ? release.weights.path.trim() : "";
  if (weightPath) return normalizePathLike(weightPath);
  const localPath = typeof release.localPath === "string" ? release.localPath.trim() : "";
  if (localPath) return normalizePathLike(localPath);
  return "";
}

async function ensureDir(root: string) {
  await fs.mkdir(root, { recursive: true });
}

export async function listAutomationRules(projectsRoot: string, projectId: string) {
  const root = path.join(projectsRoot, projectId, "automation-rules");
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    const items: AutomationRule[] = [];
    for (const e of entries) {
      if (!e.isFile() || !e.name.endsWith(".json")) continue;
      items.push(await readJson<AutomationRule>(path.join(root, e.name)));
    }
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return items;
  } catch {
    return [];
  }
}

export async function getAutomationRule(projectsRoot: string, projectId: string, ruleId: string) {
  const filePath = path.join(projectsRoot, projectId, "automation-rules", `${ruleId}.json`);
  if (!(await fileExists(filePath))) return null;
  return readJson<AutomationRule>(filePath);
}

export async function createAutomationRule(opts: {
  projectsRoot: string;
  schemas: SchemaRegistry;
  projectId: string;
  name: string;
  description?: string;
  enabled?: boolean;
  trigger: AutomationRule["trigger"];
  actions: AutomationRule["actions"];
  conditions?: Record<string, unknown>;
  notes?: string;
}) {
  const id = ulid();
  const createdAt = nowIso();
  const rule: AutomationRule = {
    id,
    projectId: opts.projectId,
    name: opts.name,
    description: opts.description,
    enabled: opts.enabled ?? true,
    createdAt,
    updatedAt: createdAt,
    trigger: opts.trigger,
    actions: opts.actions,
    conditions: opts.conditions,
    notes: opts.notes,
  };

  opts.schemas.validateOrThrow("automation-rule.schema.json", rule);

  const root = path.join(opts.projectsRoot, opts.projectId, "automation-rules");
  await ensureDir(root);
  const filePath = path.join(root, `${id}.json`);
  await writeJsonAtomic(filePath, rule);
  return rule;
}

export async function updateAutomationRule(opts: {
  projectsRoot: string;
  schemas: SchemaRegistry;
  projectId: string;
  ruleId: string;
  patch: Partial<
    Pick<
      AutomationRule,
      "name" | "description" | "enabled" | "trigger" | "actions" | "conditions" | "notes" | "lastRunAt"
    >
  >;
}) {
  const filePath = path.join(opts.projectsRoot, opts.projectId, "automation-rules", `${opts.ruleId}.json`);
  if (!(await fileExists(filePath))) return null;
  const current = await readJson<AutomationRule>(filePath);
  const next: AutomationRule = {
    ...current,
    ...opts.patch,
    updatedAt: nowIso(),
  };

  opts.schemas.validateOrThrow("automation-rule.schema.json", next);
  await writeJsonAtomic(filePath, next);
  return next;
}

function matchesCondition(condition: Condition, payload: Record<string, unknown>) {
  const value = payload?.[condition.field];
  if (condition.equals !== undefined) return value === condition.equals;
  if (Array.isArray(condition.in)) return condition.in.includes(value);
  return false;
}

function matchesConditions(conditions: Conditions | undefined, payload: Record<string, unknown>) {
  if (!conditions) return true;
  if ("all" in conditions || "any" in conditions) {
    const all = Array.isArray((conditions as any).all) ? ((conditions as any).all as Condition[]) : [];
    const any = Array.isArray((conditions as any).any) ? ((conditions as any).any as Condition[]) : [];
    const allOk = all.length === 0 ? true : all.every((cond) => matchesCondition(cond, payload));
    const anyOk = any.length === 0 ? true : any.some((cond) => matchesCondition(cond, payload));
    return allOk && anyOk;
  }
  return Object.entries(conditions).every(([key, value]) => payload?.[key] === value);
}

export async function triggerAutomationEvent(opts: {
  projectsRoot: string;
  schemas: SchemaRegistry;
  projectId: string;
  event: AutomationEvent;
}) {
  const rules = await listAutomationRules(opts.projectsRoot, opts.projectId);
  const payload = opts.event.payload ?? {};
  const causalDepth = Number(payload.causalDepth ?? 0);
  const visitedRuleIds = Array.isArray(payload.visitedRuleIds)
    ? payload.visitedRuleIds.map((item) => String(item))
    : [];
  if (causalDepth > 8) {
    await appendProjectEvent({
      projectsRoot: opts.projectsRoot,
      schemas: opts.schemas,
      event: {
        projectId: opts.projectId,
        type: "automation_loop_guard_triggered",
        entityType: "automation_event",
        entityId: opts.event.type,
        idempotencyKey: `automation_loop_guard:${opts.event.type}:${causalDepth}`,
        payload: { causalDepth, visitedRuleIds },
      },
    }).catch(() => undefined);
    return [];
  }
  const matching = rules.filter(
    (rule) =>
      rule.enabled &&
      rule.trigger?.type === opts.event.type &&
      !visitedRuleIds.includes(rule.id) &&
      matchesConditions(rule.conditions, payload),
  );

  const runs: AutomationRun[] = [];
  await appendProjectEvent({
    projectsRoot: opts.projectsRoot,
    schemas: opts.schemas,
    event: {
      projectId: opts.projectId,
      type: "automation_event_received",
      entityType: "automation_event",
      entityId: opts.event.type,
      idempotencyKey: `automation_event:${opts.event.type}:${JSON.stringify(payload)}`,
      payload,
    },
  }).catch(() => undefined);
  for (const rule of matching) {
    // Circuit breaker check: skip rule if breaker is open
    const breakerResult = await recordTriggerAndCheck({
      projectsRoot: opts.projectsRoot,
      schemas: opts.schemas,
      projectId: opts.projectId,
      ruleId: rule.id,
    }).catch((): { allowed: boolean; reason?: string; breakerId?: string } => ({ allowed: true }));

    if (!breakerResult.allowed) {
      await appendProjectEvent({
        projectsRoot: opts.projectsRoot,
        schemas: opts.schemas,
        event: {
          projectId: opts.projectId,
          type: "circuit_breaker_blocked",
          entityType: "automation_rule",
          entityId: rule.id,
          idempotencyKey: `circuit_breaker:${rule.id}:${Date.now()}`,
          payload: { reason: breakerResult.reason, breakerId: breakerResult.breakerId },
        },
      }).catch(() => undefined);
      continue;
    }

    const run = await createAutomationRun({
      projectsRoot: opts.projectsRoot,
      schemas: opts.schemas,
      projectId: opts.projectId,
      ruleId: rule.id,
      dryRun: false,
      meta: {
        event: {
          ...opts.event,
          payload: { ...payload, causalDepth: causalDepth + 1, visitedRuleIds: [...visitedRuleIds, rule.id] },
        },
      },
    });
    runs.push(run);
  }
  return runs;
}

export async function listAutomationRuns(projectsRoot: string, projectId: string) {
  const indexPath = path.join(projectsRoot, projectId, "automation-runs-index.json");
  if (await fileExists(indexPath)) {
    try {
      const index = await readJson<{ items?: Array<{ id: string }> }>(indexPath);
      const ids = Array.isArray(index.items) ? index.items.map((item) => item.id).filter(Boolean) : [];
      const fromIndex: AutomationRun[] = [];
      for (const id of ids) {
        const filePath = path.join(projectsRoot, projectId, "automation-runs", `${id}.json`);
        if (!(await fileExists(filePath))) continue;
        fromIndex.push(await readJson<AutomationRun>(filePath));
      }
      if (fromIndex.length > 0) return fromIndex;
    } catch {
      // fall back to full scan
    }
  }

  const root = path.join(projectsRoot, projectId, "automation-runs");
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    const items: AutomationRun[] = [];
    for (const e of entries) {
      if (!e.isFile() || !e.name.endsWith(".json")) continue;
      items.push(await readJson<AutomationRun>(path.join(root, e.name)));
    }
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return items;
  } catch {
    return [];
  }
}

export async function createAutomationRun(opts: {
  projectsRoot: string;
  schemas: SchemaRegistry;
  projectId: string;
  ruleId: string;
  dryRun?: boolean;
  meta?: Record<string, unknown>;
}) {
  const id = ulid();
  const createdAt = nowIso();
  const run: AutomationRun = {
    id,
    projectId: opts.projectId,
    ruleId: opts.ruleId,
    status: "queued",
    createdAt,
    updatedAt: createdAt,
    dryRun: opts.dryRun,
    meta: opts.meta,
  };

  opts.schemas.validateOrThrow("automation-run.schema.json", run);

  const root = path.join(opts.projectsRoot, opts.projectId, "automation-runs");
  await ensureDir(root);
  const filePath = path.join(root, `${id}.json`);
  await writeJsonAtomic(filePath, run);
  await upsertAutomationRunIndexEntry({
    projectsRoot: opts.projectsRoot,
    projectId: opts.projectId,
    entry: { id: run.id, ruleId: run.ruleId, status: run.status, createdAt: run.createdAt, updatedAt: run.updatedAt },
  }).catch(() => undefined);
  await appendProjectEvent({
    projectsRoot: opts.projectsRoot,
    schemas: opts.schemas,
    event: {
      projectId: opts.projectId,
      type: "automation_run_queued",
      entityType: "automation_run",
      entityId: run.id,
      idempotencyKey: `automation_run:${run.id}:queued`,
      payload: { ruleId: run.ruleId, status: run.status, dryRun: Boolean(run.dryRun) },
    },
  }).catch(() => undefined);
  return run;
}

export async function getAutomationRun(projectsRoot: string, projectId: string, runId: string) {
  const filePath = path.join(projectsRoot, projectId, "automation-runs", `${runId}.json`);
  if (!(await fileExists(filePath))) return null;
  return readJson<AutomationRun>(filePath);
}

export async function updateAutomationRun(opts: {
  projectsRoot: string;
  schemas: SchemaRegistry;
  projectId: string;
  runId: string;
  patch: Partial<AutomationRun>;
}) {
  const filePath = path.join(opts.projectsRoot, opts.projectId, "automation-runs", `${opts.runId}.json`);
  if (!(await fileExists(filePath))) return null;
  const current = await readJson<AutomationRun>(filePath);
  const next: AutomationRun = {
    ...current,
    ...opts.patch,
    updatedAt: nowIso(),
  };
  opts.schemas.validateOrThrow("automation-run.schema.json", next);
  await writeJsonAtomic(filePath, next);
  await upsertAutomationRunIndexEntry({
    projectsRoot: opts.projectsRoot,
    projectId: opts.projectId,
    entry: {
      id: next.id,
      ruleId: next.ruleId,
      status: next.status,
      createdAt: next.createdAt,
      updatedAt: next.updatedAt,
    },
  }).catch(() => undefined);
  if (current.status !== next.status) {
    await appendProjectEvent({
      projectsRoot: opts.projectsRoot,
      schemas: opts.schemas,
      event: {
        projectId: opts.projectId,
        type: `automation_run_${next.status}`,
        entityType: "automation_run",
        entityId: next.id,
        idempotencyKey: `automation_run:${next.id}:status:${next.status}:${next.updatedAt}`,
        payload: { ruleId: next.ruleId, from: current.status, to: next.status },
      },
    }).catch(() => undefined);
  }
  return next;
}

export async function executeAutomationRun(opts: {
  projectsRoot: string;
  schemas: SchemaRegistry;
  projectId: string;
  runId: string;
}) {
  const run = await getAutomationRun(opts.projectsRoot, opts.projectId, opts.runId);
  const dataRoot = path.join(opts.projectsRoot, "..");
  if (!run) return null;
  const rule = await getAutomationRule(opts.projectsRoot, opts.projectId, run.ruleId);
  if (!rule) {
    return updateAutomationRun({
      projectsRoot: opts.projectsRoot,
      schemas: opts.schemas,
      projectId: opts.projectId,
      runId: opts.runId,
      patch: { status: "failed", error: "Rule not found", endedAt: nowIso() },
    });
  }

  const startedAt = nowIso();
  let nextRun: AutomationRun = {
    ...run,
    status: "running",
    startedAt,
    steps: run.steps ?? [],
  };
  opts.schemas.validateOrThrow("automation-run.schema.json", nextRun);
  await writeJsonAtomic(path.join(opts.projectsRoot, opts.projectId, "automation-runs", `${opts.runId}.json`), nextRun);
  await appendProjectEvent({
    projectsRoot: opts.projectsRoot,
    schemas: opts.schemas,
    event: {
      projectId: opts.projectId,
      type: "automation_run_running",
      entityType: "automation_run",
      entityId: nextRun.id,
      idempotencyKey: `automation_run:${nextRun.id}:running`,
      payload: { ruleId: nextRun.ruleId, status: nextRun.status },
    },
  }).catch(() => undefined);

  for (const action of rule.actions) {
    const stepId = ulid();
    const stepBase = {
      id: stepId,
      type: action.type,
      status: "running" as const,
      startedAt: nowIso(),
    };
    nextRun.steps = [...(nextRun.steps ?? []), stepBase];

    if (run.dryRun) {
      nextRun.steps = nextRun.steps.map((step) =>
        step.id === stepId ? { ...step, status: "succeeded", endedAt: nowIso(), meta: { dryRun: true } } : step,
      );
      continue;
    }

    if (action.type === "enqueue_job") {
      const config = (action.config ?? {}) as { type?: Job["type"]; input?: Record<string, unknown> };
      if (!config.type) {
        nextRun.steps = nextRun.steps.map((step) =>
          step.id === stepId ? { ...step, status: "failed", endedAt: nowIso(), error: "Missing job type" } : step,
        );
        nextRun.status = "failed";
        nextRun.endedAt = nowIso();
        break;
      }
      const job = await createJob({
        projectsRoot: opts.projectsRoot,
        schemas: opts.schemas,
        projectId: opts.projectId,
        type: config.type,
        input: config.input ?? {},
      });
      nextRun.steps = nextRun.steps.map((step) =>
        step.id === stepId ? { ...step, status: "succeeded", endedAt: nowIso(), meta: { jobId: job.id } } : step,
      );
      continue;
    }

    if (action.type === "export") {
      const config = (action.config ?? {}) as {
        assetIds?: string[];
        atlasIds?: string[];
        profileId?: string;
        profileSnapshot?: Record<string, unknown>;
        animations?: Record<string, unknown>[];
        ui?: Record<string, unknown>[];
      };
      const job = await createJob({
        projectsRoot: opts.projectsRoot,
        schemas: opts.schemas,
        projectId: opts.projectId,
        type: "export",
        input: {
          assetIds: Array.isArray(config.assetIds) ? config.assetIds : [],
          atlasIds: Array.isArray(config.atlasIds) ? config.atlasIds : [],
          profileId: config.profileId,
          profileSnapshot: config.profileSnapshot,
          animations: Array.isArray(config.animations) ? config.animations : [],
          ui: Array.isArray(config.ui) ? config.ui : [],
        },
      });
      nextRun.steps = nextRun.steps.map((step) =>
        step.id === stepId ? { ...step, status: "succeeded", endedAt: nowIso(), meta: { jobId: job.id } } : step,
      );
      continue;
    }

    if (action.type === "run_eval_grid") {
      const eventPayload = ((run.meta as any)?.event?.payload ?? {}) as Record<string, unknown>;
      const config = (action.config ?? {}) as {
        loraId?: string;
        releaseId?: string;
        evalId?: string;
        prompts?: string[] | string;
        checkpointId?: string;
        templateId?: string;
        assetType?: string;
        width?: number;
        height?: number;
        variants?: number;
        autoCleanup?: boolean;
        strengthModel?: number;
        strengthClip?: number;
      };
      const loraId = String(config.loraId ?? eventPayload.loraId ?? "");
      const releaseId = String(config.releaseId ?? eventPayload.releaseId ?? "");
      if (!loraId || !releaseId) {
        nextRun.steps = nextRun.steps.map((step) =>
          step.id === stepId
            ? { ...step, status: "failed", endedAt: nowIso(), error: "Missing loraId/releaseId" }
            : step,
        );
        nextRun.status = "failed";
        nextRun.endedAt = nowIso();
        break;
      }

      const lora = await loadLoraRecord({
        projectsRoot: opts.projectsRoot,
        dataRoot,
        projectId: opts.projectId,
        loraId,
      });
      if (!lora) {
        nextRun.steps = nextRun.steps.map((step) =>
          step.id === stepId ? { ...step, status: "failed", endedAt: nowIso(), error: "LoRA not found" } : step,
        );
        nextRun.status = "failed";
        nextRun.endedAt = nowIso();
        break;
      }
      const release = (lora.releases ?? []).find((r) => r.id === releaseId);
      if (!release) {
        nextRun.steps = nextRun.steps.map((step) =>
          step.id === stepId ? { ...step, status: "failed", endedAt: nowIso(), error: "Release not found" } : step,
        );
        nextRun.status = "failed";
        nextRun.endedAt = nowIso();
        break;
      }

      const promptsList = Array.isArray(config.prompts)
        ? config.prompts
        : String(config.prompts ?? "")
            .split("|")
            .map((p) => p.trim())
            .filter(Boolean);
      if (!promptsList.length) {
        nextRun.steps = nextRun.steps.map((step) =>
          step.id === stepId ? { ...step, status: "failed", endedAt: nowIso(), error: "No prompts provided" } : step,
        );
        nextRun.status = "failed";
        nextRun.endedAt = nowIso();
        break;
      }

      const evalId = config.evalId ?? ulid();
      const evalRecord = {
        id: evalId,
        loraId,
        releaseId,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        status: "running",
        prompts: promptsList,
        outputs: [],
        autoCleanup: Boolean(config.autoCleanup),
      };
      opts.schemas.validateOrThrow("eval.schema.json", evalRecord);
      const evalPath = path.join(opts.projectsRoot, opts.projectId, "evals", `${evalId}.json`);
      await writeJsonAtomic(evalPath, evalRecord);

      const checkpointId = config.checkpointId || lora.checkpointId;
      const assetType = config.assetType || (Array.isArray(lora.assetTypes) && lora.assetTypes[0]) || "ui_icon";
      const templateId = config.templateId || "txt2img";

      const createdJobs: string[] = [];
      for (let i = 0; i < promptsList.length; i += 1) {
        const prompt = promptsList[i];
        const specId = `eval_${evalId}_${i + 1}`;
        const spec = {
          id: specId,
          projectId: opts.projectId,
          createdAt: nowIso(),
          updatedAt: nowIso(),
          title: `Eval: ${loraId} (${i + 1})`,
          assetType,
          checkpointId,
          style: "default",
          scenario: "default",
          prompt: { positive: prompt, negative: "" },
          generationParams: {
            ...(config.width ? { width: config.width } : {}),
            ...(config.height ? { height: config.height } : {}),
            ...(config.variants ? { variants: config.variants } : {}),
          },
          status: "ready",
        };
        opts.schemas.validateOrThrow("asset-spec.schema.json", spec);
        await writeJsonAtomic(path.join(opts.projectsRoot, opts.projectId, "specs", `${specId}.json`), spec);

        const loraPath = resolveLoraWeightPath(release);
        const strengthModel = Number(config.strengthModel ?? 1);
        const strengthClip = Number(config.strengthClip ?? strengthModel);

        const job = await createJob({
          projectsRoot: opts.projectsRoot,
          schemas: opts.schemas,
          projectId: opts.projectId,
          type: "generate",
          input: {
            specId,
            templateId,
            checkpointName: checkpointId,
            eval: { evalId, prompt },
            loras: [
              {
                loraId,
                releaseId,
                loraName: loraPath || loraId,
                strengthModel: Number.isFinite(strengthModel) ? strengthModel : 1,
                strengthClip: Number.isFinite(strengthClip) ? strengthClip : 1,
              },
            ],
            loraSelection: { mode: "automation_eval", loraId, releaseId },
          },
        });
        createdJobs.push(job.id);
      }

      nextRun.steps = nextRun.steps.map((step) =>
        step.id === stepId
          ? { ...step, status: "succeeded", endedAt: nowIso(), meta: { evalId, jobs: createdJobs.length } }
          : step,
      );
      continue;
    }

    if (action.type === "enqueue_lora_renders") {
      const eventPayload = ((run.meta as any)?.event?.payload ?? {}) as Record<string, unknown>;
      const config = (action.config ?? {}) as {
        loraId?: string;
        releaseId?: string;
        templateId?: string;
        checkpointId?: string;
        assetTypes?: string[];
        statuses?: Array<"draft" | "ready" | "deprecated">;
        limit?: number;
        strengthModel?: number;
        strengthClip?: number;
        requireApproved?: boolean;
      };

      const loraId = String(config.loraId ?? eventPayload.loraId ?? "");
      if (!loraId) {
        nextRun.steps = nextRun.steps.map((step) =>
          step.id === stepId ? { ...step, status: "failed", endedAt: nowIso(), error: "Missing loraId" } : step,
        );
        nextRun.status = "failed";
        nextRun.endedAt = nowIso();
        break;
      }

      const lora = await loadLoraRecord({
        projectsRoot: opts.projectsRoot,
        dataRoot,
        projectId: opts.projectId,
        loraId,
      });
      if (!lora) {
        nextRun.steps = nextRun.steps.map((step) =>
          step.id === stepId ? { ...step, status: "failed", endedAt: nowIso(), error: "LoRA not found" } : step,
        );
        nextRun.status = "failed";
        nextRun.endedAt = nowIso();
        break;
      }

      const releaseId = String(config.releaseId ?? eventPayload.releaseId ?? lora.activeReleaseId ?? "");
      const release = (lora.releases ?? []).find((item) => item.id === releaseId);
      if (!release) {
        nextRun.steps = nextRun.steps.map((step) =>
          step.id === stepId ? { ...step, status: "failed", endedAt: nowIso(), error: "Release not found" } : step,
        );
        nextRun.status = "failed";
        nextRun.endedAt = nowIso();
        break;
      }

      const requireApproved = config.requireApproved ?? true;
      if (requireApproved && release.status !== "approved") {
        nextRun.steps = nextRun.steps.map((step) =>
          step.id === stepId
            ? {
                ...step,
                status: "succeeded",
                endedAt: nowIso(),
                meta: { skipped: true, reason: "release_not_approved", releaseStatus: release.status ?? null },
              }
            : step,
        );
        continue;
      }

      const allowedAssetTypes = Array.from(
        new Set([
          ...asStringArray(config.assetTypes),
          ...asStringArray(eventPayload.assetTypes),
          ...asStringArray(lora.assetTypes),
        ]),
      );
      const checkpointId = String(config.checkpointId ?? eventPayload.checkpointId ?? lora.checkpointId ?? "");
      const statuses = asStringArray(config.statuses).length ? asStringArray(config.statuses) : ["draft", "ready"];
      const templateId = String(config.templateId ?? "txt2img");
      const limitRaw = Number(config.limit ?? 20);
      const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.floor(limitRaw)) : 20;
      const strengthModel = Number(config.strengthModel ?? 1);
      const strengthClip = Number(config.strengthClip ?? strengthModel);
      const loraPath = resolveLoraWeightPath(release);

      const specs = await listSpecs(opts.projectsRoot, opts.projectId);
      const compatible = specs
        .filter((spec) => {
          const status = String(spec.status ?? "draft");
          if (!statuses.includes(status)) return false;
          if (allowedAssetTypes.length > 0 && !allowedAssetTypes.includes(spec.assetType)) return false;
          if (checkpointId && spec.checkpointId && spec.checkpointId !== checkpointId) return false;
          return true;
        })
        .slice(0, limit);

      const createdJobs: string[] = [];
      const queuedSpecIds: string[] = [];
      for (const spec of compatible) {
        const checkpointName = String(spec.checkpointId ?? checkpointId);
        if (!checkpointName) continue;

        const job = await createJob({
          projectsRoot: opts.projectsRoot,
          schemas: opts.schemas,
          projectId: opts.projectId,
          type: "generate",
          input: {
            specId: spec.id,
            templateId,
            checkpointName,
            loras: [
              {
                loraId,
                releaseId,
                loraName: loraPath || loraId,
                strengthModel: Number.isFinite(strengthModel) ? strengthModel : 1,
                strengthClip: Number.isFinite(strengthClip) ? strengthClip : 1,
              },
            ],
            loraSelection: { mode: "automation_release_activation", loraId, releaseId, ruleId: rule.id },
          },
        });
        createdJobs.push(job.id);
        queuedSpecIds.push(spec.id);
      }

      nextRun.steps = nextRun.steps.map((step) =>
        step.id === stepId
          ? {
              ...step,
              status: "succeeded",
              endedAt: nowIso(),
              meta: {
                loraId,
                releaseId,
                templateId,
                checkpointId,
                queuedJobs: createdJobs.length,
                queuedSpecs: queuedSpecIds.length,
                skippedSpecs: compatible.length - queuedSpecIds.length,
              },
            }
          : step,
      );
      continue;
    }

    if (action.type === "apply_tags") {
      const config = (action.config ?? {}) as {
        assetId?: string;
        versionId?: string;
        variantId?: string;
        set?: string[];
        add?: string[];
        remove?: string[];
      };
      if (!config.assetId || !config.versionId || !config.variantId) {
        nextRun.steps = nextRun.steps.map((step) =>
          step.id === stepId
            ? { ...step, status: "failed", endedAt: nowIso(), error: "Missing assetId/versionId/variantId" }
            : step,
        );
        nextRun.status = "failed";
        nextRun.endedAt = nowIso();
        break;
      }
      const asset = await getAsset(opts.projectsRoot, opts.projectId, config.assetId);
      const version = asset?.versions.find((v) => v.id === config.versionId);
      const variant = version?.variants.find((v) => v.id === config.variantId);
      if (!asset || !version || !variant) {
        nextRun.steps = nextRun.steps.map((step) =>
          step.id === stepId
            ? { ...step, status: "failed", endedAt: nowIso(), error: "Asset/version/variant not found" }
            : step,
        );
        nextRun.status = "failed";
        nextRun.endedAt = nowIso();
        break;
      }

      let tags = new Set<string>(variant.tags ?? []);
      if (Array.isArray(config.set)) tags = new Set<string>(config.set);
      if (Array.isArray(config.add)) config.add.forEach((t) => tags.add(t));
      if (Array.isArray(config.remove)) config.remove.forEach((t) => tags.delete(t));

      await updateAssetVariant({
        projectsRoot: opts.projectsRoot,
        schemas: opts.schemas,
        projectId: opts.projectId,
        assetId: config.assetId,
        versionId: config.versionId,
        variantId: config.variantId,
        patch: { tags: Array.from(tags) },
      });

      nextRun.steps = nextRun.steps.map((step) =>
        step.id === stepId ? { ...step, status: "succeeded", endedAt: nowIso(), meta: { tagCount: tags.size } } : step,
      );
      continue;
    }

    if (action.type === "set_status") {
      const config = (action.config ?? {}) as {
        assetId?: string;
        versionId?: string;
        variantId?: string;
        status?: string;
      };
      if (!config.assetId || !config.versionId || !config.status) {
        nextRun.steps = nextRun.steps.map((step) =>
          step.id === stepId
            ? { ...step, status: "failed", endedAt: nowIso(), error: "Missing assetId/versionId/status" }
            : step,
        );
        nextRun.status = "failed";
        nextRun.endedAt = nowIso();
        break;
      }

      if (config.variantId) {
        await updateAssetVariant({
          projectsRoot: opts.projectsRoot,
          schemas: opts.schemas,
          projectId: opts.projectId,
          assetId: config.assetId,
          versionId: config.versionId,
          variantId: config.variantId,
          patch: { status: config.status },
        });
      } else {
        await updateAssetVersion({
          projectsRoot: opts.projectsRoot,
          schemas: opts.schemas,
          projectId: opts.projectId,
          assetId: config.assetId,
          versionId: config.versionId,
          patch: { status: config.status },
        });
      }

      nextRun.steps = nextRun.steps.map((step) =>
        step.id === stepId
          ? { ...step, status: "succeeded", endedAt: nowIso(), meta: { status: config.status } }
          : step,
      );
      continue;
    }

    if (action.type === "auto_atlas_pack") {
      // When an asset is approved, check if it belongs to an animation spec
      // and whether ALL frames for that spec are now approved. If so,
      // collect the frame image paths in order and enqueue an atlas_pack job.
      const eventPayload = (run.meta as any)?.event?.payload ?? {};
      const assetId = (action.config as any)?.assetId ?? eventPayload.assetId;
      if (!assetId) {
        nextRun.steps = nextRun.steps.map((step) =>
          step.id === stepId
            ? { ...step, status: "failed", endedAt: nowIso(), error: "Missing assetId in event payload" }
            : step,
        );
        nextRun.status = "failed";
        nextRun.endedAt = nowIso();
        break;
      }

      const asset = await getAsset(opts.projectsRoot, opts.projectId, assetId);
      if (!asset) {
        nextRun.steps = nextRun.steps.map((step) =>
          step.id === stepId ? { ...step, status: "failed", endedAt: nowIso(), error: "Asset not found" } : step,
        );
        nextRun.status = "failed";
        nextRun.endedAt = nowIso();
        break;
      }

      const spec = await getSpec(opts.projectsRoot, opts.projectId, asset.specId);
      if (!spec || spec.output?.kind !== "animation") {
        // Not an animation spec — nothing to do, succeed silently.
        nextRun.steps = nextRun.steps.map((step) =>
          step.id === stepId
            ? { ...step, status: "succeeded", endedAt: nowIso(), meta: { skipped: true, reason: "not_animation_spec" } }
            : step,
        );
        continue;
      }

      const expectedFrameCount = spec.output.animation?.frameCount ?? spec.output.animation?.frameNames?.length ?? 0;
      if (expectedFrameCount <= 0) {
        nextRun.steps = nextRun.steps.map((step) =>
          step.id === stepId
            ? { ...step, status: "succeeded", endedAt: nowIso(), meta: { skipped: true, reason: "no_frame_count" } }
            : step,
        );
        continue;
      }

      // Gather all assets that share the same specId.
      const allAssets = await listAssets(opts.projectsRoot, opts.projectId);
      const specAssets = allAssets.filter((a) => a.specId === spec.id);

      // For each asset, find the latest approved version and extract the
      // frame index from its generation metadata.
      type FrameInfo = { frameIndex: number; frameName: string; imagePath: string };
      const frames: FrameInfo[] = [];
      for (const sa of specAssets) {
        const approvedVersion = [...sa.versions].reverse().find((v) => v.status === "approved");
        if (!approvedVersion) continue;

        const generation = (approvedVersion as any).generation as Record<string, any> | undefined;
        const frameIndex = typeof generation?.frameIndex === "number" ? generation.frameIndex : -1;
        const frameName = typeof generation?.frameName === "string" ? generation.frameName : `frame_${frameIndex}`;

        // Prefer alphaPath (bg-removed), fall back to originalPath.
        const variant = approvedVersion.primaryVariantId
          ? approvedVersion.variants.find((v) => v.id === approvedVersion.primaryVariantId)
          : approvedVersion.variants[0];
        if (!variant) continue;

        const imagePath = variant.alphaPath ?? variant.originalPath;
        if (!imagePath) continue;

        frames.push({ frameIndex, frameName, imagePath });
      }

      if (frames.length < expectedFrameCount) {
        // Not all frames approved yet — succeed silently (will fire again on next approval).
        nextRun.steps = nextRun.steps.map((step) =>
          step.id === stepId
            ? {
                ...step,
                status: "succeeded",
                endedAt: nowIso(),
                meta: { skipped: true, reason: "incomplete", approved: frames.length, expected: expectedFrameCount },
              }
            : step,
        );
        continue;
      }

      // Sort by frameIndex and build the atlas_pack input.
      frames.sort((a, b) => a.frameIndex - b.frameIndex);

      const packConfig = (action.config ?? {}) as Record<string, unknown>;
      const atlasId = String(packConfig.atlasId ?? `${spec.id}_atlas`);
      const framePaths = frames.map((f) => ({ key: f.frameName, path: f.imagePath }));

      const job = await createJob({
        projectsRoot: opts.projectsRoot,
        schemas: opts.schemas,
        projectId: opts.projectId,
        type: "atlas_pack",
        input: {
          atlasId,
          framePaths,
          ...(packConfig.padding != null ? { padding: Number(packConfig.padding) } : {}),
          ...(packConfig.maxSize != null ? { maxSize: Number(packConfig.maxSize) } : {}),
          ...(packConfig.powerOfTwo != null ? { powerOfTwo: Boolean(packConfig.powerOfTwo) } : {}),
          ...(packConfig.trim != null ? { trim: Boolean(packConfig.trim) } : {}),
          ...(packConfig.extrude != null ? { extrude: Number(packConfig.extrude) } : {}),
          ...(packConfig.sort != null ? { sort: String(packConfig.sort) } : {}),
        },
      });

      nextRun.steps = nextRun.steps.map((step) =>
        step.id === stepId
          ? {
              ...step,
              status: "succeeded",
              endedAt: nowIso(),
              meta: { jobId: job.id, atlasId, frames: frames.length, specId: spec.id },
            }
          : step,
      );
      continue;
    }

    nextRun.steps = nextRun.steps.map((step) =>
      step.id === stepId ? { ...step, status: "failed", endedAt: nowIso(), error: "Action not implemented" } : step,
    );
    nextRun.status = "failed";
    nextRun.endedAt = nowIso();
    break;
  }

  if (nextRun.status === "running") {
    nextRun.status = "succeeded";
    nextRun.endedAt = nowIso();
  }

  await updateAutomationRun({
    projectsRoot: opts.projectsRoot,
    schemas: opts.schemas,
    projectId: opts.projectId,
    runId: opts.runId,
    patch: nextRun,
  });

  await updateAutomationRule({
    projectsRoot: opts.projectsRoot,
    schemas: opts.schemas,
    projectId: opts.projectId,
    ruleId: rule.id,
    patch: { lastRunAt: nowIso() },
  });

  return getAutomationRun(opts.projectsRoot, opts.projectId, opts.runId);
}
