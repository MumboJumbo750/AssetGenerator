import fs from "node:fs/promises";
import path from "node:path";

import { ulid } from "ulid";

import { fileExists, readJson, writeJsonAtomic } from "../lib/json";
import type { SchemaRegistry } from "../lib/schemas";
import { createJob, type Job } from "./jobs";
import { getAsset, updateAssetVariant, updateAssetVersion } from "./assets";

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
  trigger: { type: "spec_refined" | "asset_approved" | "atlas_ready" | "schedule" | "manual"; schedule?: unknown };
  conditions?: Record<string, unknown>;
  actions: Array<{ type: "enqueue_job" | "run_eval_grid" | "apply_tags" | "set_status" | "export"; config?: unknown }>;
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
  checkpointId: string;
  assetTypes?: string[];
  releases?: Array<{ id: string }>;
};

async function loadLoraRecord(opts: { projectsRoot: string; dataRoot: string; projectId: string; loraId: string }) {
  const projectPath = path.join(opts.projectsRoot, opts.projectId, "loras", `${opts.loraId}.json`);
  if (await fileExists(projectPath)) return readJson<LoraRecord>(projectPath);
  const sharedPath = path.join(opts.dataRoot, "shared", "loras", `${opts.loraId}.json`);
  if (await fileExists(sharedPath)) return readJson<LoraRecord>(sharedPath);
  return null;
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
    Pick<AutomationRule, "name" | "description" | "enabled" | "trigger" | "actions" | "conditions" | "notes" | "lastRunAt">
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
  const matching = rules.filter(
    (rule) => rule.enabled && rule.trigger?.type === opts.event.type && matchesConditions(rule.conditions, payload),
  );

  const runs: AutomationRun[] = [];
  for (const rule of matching) {
    const run = await createAutomationRun({
      projectsRoot: opts.projectsRoot,
      schemas: opts.schemas,
      projectId: opts.projectId,
      ruleId: rule.id,
      dryRun: false,
      meta: { event: opts.event },
    });
    const executed = await executeAutomationRun({
      projectsRoot: opts.projectsRoot,
      schemas: opts.schemas,
      projectId: opts.projectId,
      runId: run.id,
    });
    if (executed) runs.push(executed);
  }
  return runs;
}

export async function listAutomationRuns(projectsRoot: string, projectId: string) {
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
  await writeJsonAtomic(
    path.join(opts.projectsRoot, opts.projectId, "automation-runs", `${opts.runId}.json`),
    nextRun,
  );

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
          step.id === stepId
            ? { ...step, status: "failed", endedAt: nowIso(), error: "Missing job type" }
            : step,
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
        step.id === stepId
          ? { ...step, status: "succeeded", endedAt: nowIso(), meta: { jobId: job.id } }
          : step,
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
        step.id === stepId
          ? { ...step, status: "succeeded", endedAt: nowIso(), meta: { jobId: job.id } }
          : step,
      );
      continue;
    }

    if (action.type === "run_eval_grid") {
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
      };

      if (!config.loraId || !config.releaseId) {
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
        loraId: config.loraId,
      });
      if (!lora) {
        nextRun.steps = nextRun.steps.map((step) =>
          step.id === stepId
            ? { ...step, status: "failed", endedAt: nowIso(), error: "LoRA not found" }
            : step,
        );
        nextRun.status = "failed";
        nextRun.endedAt = nowIso();
        break;
      }
      const release = (lora.releases ?? []).find((r) => r.id === config.releaseId);
      if (!release) {
        nextRun.steps = nextRun.steps.map((step) =>
          step.id === stepId
            ? { ...step, status: "failed", endedAt: nowIso(), error: "Release not found" }
            : step,
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
          step.id === stepId
            ? { ...step, status: "failed", endedAt: nowIso(), error: "No prompts provided" }
            : step,
        );
        nextRun.status = "failed";
        nextRun.endedAt = nowIso();
        break;
      }

      const evalId = config.evalId ?? ulid();
      const evalRecord = {
        id: evalId,
        loraId: config.loraId,
        releaseId: config.releaseId,
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
      const assetType =
        config.assetType || (Array.isArray(lora.assetTypes) && lora.assetTypes[0]) || "ui_icon";
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
          title: `Eval: ${config.loraId} (${i + 1})`,
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
        step.id === stepId
          ? { ...step, status: "succeeded", endedAt: nowIso(), meta: { tagCount: tags.size } }
          : step,
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
        step.id === stepId ? { ...step, status: "succeeded", endedAt: nowIso(), meta: { status: config.status } } : step,
      );
      continue;
    }

    nextRun.steps = nextRun.steps.map((step) =>
      step.id === stepId
        ? { ...step, status: "failed", endedAt: nowIso(), error: "Action not implemented" }
        : step,
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
