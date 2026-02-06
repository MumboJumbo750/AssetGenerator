import fs from "node:fs/promises";
import path from "node:path";

import { ulid } from "ulid";

import { fileExists, readJson, writeJsonAtomic } from "../lib/json";
import type { SchemaRegistry } from "../lib/schemas";

export type AssetSpec = {
  id: string;
  projectId: string;
  specListId?: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  assetType: string;
  checkpointId?: string;
  checkpointProfileId?: string;
  checkpointProfileVersion?: number;
  loraIds?: string[];
  baselineProfileId?: string;
  loraPolicy?: {
    mode?: "manual" | "baseline_then_project" | "project_then_baseline" | "baseline_only" | "project_only";
    preferRecommended?: boolean;
    maxActiveLoras?: number;
    releasePolicy?: "active_or_latest_approved" | "active_only";
  };
  styleConsistency?: {
    mode?: "inherit_project" | "lock_to_spec_style" | "lock_to_anchor_set";
    anchorRefs?: string[];
  };
  qualityContract?: {
    backgroundPolicy?: "white_or_transparent" | "transparent_only" | "white_only" | "any";
    requiredStates?: string[];
    alignmentTolerancePx?: number;
    perspectiveMode?: "strict" | "allow_minor" | "any";
    silhouetteDriftTolerance?: number;
  };
  entityLink?: {
    entityId?: string;
    role?: "animation" | "pickup_icon" | "portrait" | "ui_card";
  };
  promptPolicy?: {
    compileMode?: "checkpoint_profile_default" | "spec_override";
    tagOrderMode?: "checkpoint_default" | "explicit";
    tagOrder?: string[];
    promptPresetId?: string;
  };
  seedPolicy?: {
    mode?: "fixed" | "derived" | "random_recorded";
    baseSeed?: number;
    deriveFrom?: string[];
    hashAlgo?: string;
  };
  output?: {
    kind?: "single_image" | "animation" | "ui_states" | "logo_set";
    background?: "transparent_required" | "any";
    animation?: { name?: string; fps?: number; loop?: boolean; frameCount?: number; frameNames?: string[] };
  };
  style: string;
  scenario: string;
  prompt: { positive: string; negative: string };
  generationParams?: Record<string, unknown>;
  status?: "draft" | "ready" | "deprecated";
};

function nowIso() {
  return new Date().toISOString();
}

async function readProjectPolicy(projectsRoot: string, projectId: string) {
  const filePath = path.join(projectsRoot, projectId, "project.json");
  if (!(await fileExists(filePath))) return {};
  return readJson<any>(filePath);
}

async function readBaselineProfile(projectsRoot: string, projectId: string, baselineProfileId: string) {
  const scopedPath = path.join(projectsRoot, projectId, "baseline-profiles", `${baselineProfileId}.json`);
  if (await fileExists(scopedPath)) return readJson<any>(scopedPath);
  const legacyPath = path.join(projectsRoot, projectId, "baseline-profile.json");
  if (!(await fileExists(legacyPath))) return null;
  const legacy = await readJson<any>(legacyPath);
  if (legacy?.id === baselineProfileId) return legacy;
  return null;
}

export async function enforceCheckpointCompatibility(opts: {
  projectsRoot: string;
  projectId: string;
  project?: any;
  checkpointId?: string;
  baselineProfileId?: string;
}) {
  if (!opts.checkpointId || !opts.baselineProfileId) return;
  const baseline = await readBaselineProfile(opts.projectsRoot, opts.projectId, opts.baselineProfileId);
  if (!baseline) throw new Error(`Baseline profile not found: ${opts.baselineProfileId}`);
  if (baseline.checkpointId && baseline.checkpointId !== opts.checkpointId) {
    throw new Error(
      `Baseline profile ${opts.baselineProfileId} is bound to checkpoint ${baseline.checkpointId}, not ${opts.checkpointId}`,
    );
  }
  const allowed =
    opts.project?.policies?.checkpointBaselineMap?.[opts.checkpointId]?.allowedBaselineProfileIds ??
    opts.project?.policies?.checkpointBaselineMap?.[opts.checkpointId]?.allowedProfileIds;
  if (Array.isArray(allowed) && allowed.length > 0 && !allowed.includes(opts.baselineProfileId)) {
    throw new Error(
      `Baseline profile ${opts.baselineProfileId} is not allowed for checkpoint ${opts.checkpointId} by project policy`,
    );
  }
}

function deriveCheckpointProfileFromPolicy(project: any, checkpointId?: string) {
  if (!checkpointId) return null;
  const profile = project?.policies?.checkpointProfiles?.[checkpointId];
  if (!profile || typeof profile !== "object") return null;
  const profileId = typeof profile.profileId === "string" ? profile.profileId : null;
  const version = Number(profile.version ?? 1);
  if (!profileId) return null;
  return { checkpointProfileId: profileId, checkpointProfileVersion: Number.isFinite(version) ? version : 1 };
}

export async function listSpecs(projectsRoot: string, projectId: string) {
  const root = path.join(projectsRoot, projectId, "specs");
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    const items: AssetSpec[] = [];
    for (const e of entries) {
      if (!e.isFile() || !e.name.endsWith(".json")) continue;
      items.push(await readJson<AssetSpec>(path.join(root, e.name)));
    }
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return items;
  } catch {
    return [];
  }
}

export async function getSpec(projectsRoot: string, projectId: string, specId: string) {
  const filePath = path.join(projectsRoot, projectId, "specs", `${specId}.json`);
  if (!(await fileExists(filePath))) return null;
  return readJson<AssetSpec>(filePath);
}

export async function createSpec(opts: {
  projectsRoot: string;
  schemas: SchemaRegistry;
  projectId: string;
  spec: Partial<AssetSpec>;
}) {
  const id = ulid();
  const createdAt = nowIso();
  const project = await readProjectPolicy(opts.projectsRoot, opts.projectId);
  await enforceCheckpointCompatibility({
    projectsRoot: opts.projectsRoot,
    projectId: opts.projectId,
    project,
    checkpointId: opts.spec?.checkpointId,
    baselineProfileId: opts.spec?.baselineProfileId,
  });
  const derivedProfile = deriveCheckpointProfileFromPolicy(project, opts.spec?.checkpointId);
  const spec: AssetSpec = {
    id,
    projectId: opts.projectId,
    specListId: opts.spec?.specListId,
    createdAt,
    updatedAt: createdAt,
    title: opts.spec?.title ?? `Spec ${id}`,
    assetType: opts.spec?.assetType ?? "ui_icon",
    checkpointId: opts.spec?.checkpointId,
    checkpointProfileId: opts.spec?.checkpointProfileId ?? derivedProfile?.checkpointProfileId,
    checkpointProfileVersion: opts.spec?.checkpointProfileVersion ?? derivedProfile?.checkpointProfileVersion,
    loraIds: Array.isArray(opts.spec?.loraIds) ? opts.spec?.loraIds : undefined,
    baselineProfileId: opts.spec?.baselineProfileId,
    loraPolicy: opts.spec?.loraPolicy,
    styleConsistency: opts.spec?.styleConsistency,
    qualityContract: opts.spec?.qualityContract,
    entityLink: opts.spec?.entityLink,
    promptPolicy: opts.spec?.promptPolicy,
    seedPolicy: opts.spec?.seedPolicy,
    style: opts.spec?.style ?? "cartoon",
    scenario: opts.spec?.scenario ?? "fantasy",
    prompt: {
      positive: opts.spec?.prompt?.positive ?? "",
      negative: opts.spec?.prompt?.negative ?? "",
    },
    generationParams: opts.spec?.generationParams ?? {},
    status: (opts.spec?.status ?? "draft") as AssetSpec["status"],
  };

  if (spec.status === "ready") {
    if (!spec.checkpointId) throw new Error("checkpointId is required when status=ready");
    if (!spec.checkpointProfileId) throw new Error("checkpointProfileId could not be resolved for ready spec");
    if (!spec.checkpointProfileVersion) spec.checkpointProfileVersion = 1;
  }

  opts.schemas.validateOrThrow("asset-spec.schema.json", spec);

  const filePath = path.join(opts.projectsRoot, opts.projectId, "specs", `${id}.json`);
  await writeJsonAtomic(filePath, spec);
  return spec;
}

export async function updateSpec(opts: {
  projectsRoot: string;
  schemas: SchemaRegistry;
  projectId: string;
  specId: string;
  patch: Partial<AssetSpec>;
}) {
  const filePath = path.join(opts.projectsRoot, opts.projectId, "specs", `${opts.specId}.json`);
  if (!(await fileExists(filePath))) return null;
  const spec = await readJson<AssetSpec>(filePath);
  const project = await readProjectPolicy(opts.projectsRoot, opts.projectId);

  if (typeof opts.patch?.title === "string") spec.title = opts.patch.title;
  if (typeof opts.patch?.assetType === "string") spec.assetType = opts.patch.assetType;
  if (typeof opts.patch?.checkpointId === "string") spec.checkpointId = opts.patch.checkpointId;
  if (typeof opts.patch?.checkpointProfileId === "string") spec.checkpointProfileId = opts.patch.checkpointProfileId;
  if (opts.patch?.checkpointProfileVersion !== undefined && Number.isFinite(opts.patch.checkpointProfileVersion))
    spec.checkpointProfileVersion = Number(opts.patch.checkpointProfileVersion);
  if (Array.isArray(opts.patch?.loraIds)) spec.loraIds = opts.patch.loraIds;
  if (typeof opts.patch?.baselineProfileId === "string") spec.baselineProfileId = opts.patch.baselineProfileId;
  if (opts.patch?.loraPolicy) spec.loraPolicy = opts.patch.loraPolicy;
  if (opts.patch?.styleConsistency) spec.styleConsistency = opts.patch.styleConsistency;
  if (opts.patch?.qualityContract) spec.qualityContract = opts.patch.qualityContract;
  if (opts.patch?.entityLink) spec.entityLink = opts.patch.entityLink;
  if (opts.patch?.promptPolicy) spec.promptPolicy = opts.patch.promptPolicy;
  if (opts.patch?.seedPolicy) spec.seedPolicy = opts.patch.seedPolicy;
  if (typeof opts.patch?.style === "string") spec.style = opts.patch.style;
  if (typeof opts.patch?.scenario === "string") spec.scenario = opts.patch.scenario;
  if (opts.patch?.prompt) spec.prompt = { ...spec.prompt, ...opts.patch.prompt };
  if (opts.patch?.generationParams) spec.generationParams = opts.patch.generationParams;
  if (typeof opts.patch?.status === "string") spec.status = opts.patch.status as any;
  if (opts.patch?.output) spec.output = opts.patch.output as any;

  await enforceCheckpointCompatibility({
    projectsRoot: opts.projectsRoot,
    projectId: opts.projectId,
    project,
    checkpointId: spec.checkpointId,
    baselineProfileId: spec.baselineProfileId,
  });

  if (spec.status === "ready") {
    if (!spec.checkpointId) throw new Error("checkpointId is required when status=ready");
    if (!spec.checkpointProfileId) {
      const derivedProfile = deriveCheckpointProfileFromPolicy(project, spec.checkpointId);
      spec.checkpointProfileId = derivedProfile?.checkpointProfileId;
      spec.checkpointProfileVersion = derivedProfile?.checkpointProfileVersion;
    }
    if (!spec.checkpointProfileId) throw new Error("checkpointProfileId could not be resolved for ready spec");
    if (!spec.checkpointProfileVersion) spec.checkpointProfileVersion = 1;
  }

  spec.updatedAt = nowIso();
  opts.schemas.validateOrThrow("asset-spec.schema.json", spec);
  await writeJsonAtomic(filePath, spec);
  return spec;
}
