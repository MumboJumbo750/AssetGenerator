export type Project = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  defaults: { style: string; scenario: string };
  policies?: {
    loraSelection?: {
      mode?: "manual" | "baseline_then_project" | "project_then_baseline" | "baseline_only" | "project_only";
      preferRecommended?: boolean;
      maxActiveLoras?: number;
      releasePolicy?: "active_or_latest_approved" | "active_only";
    };
  };
  notes?: string;
};

export type SpecList = {
  id: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  text: string;
  status: "draft" | "refined" | "archived";
  derivedSpecIds?: string[];
  notes?: string;
};

export type Job = {
  id: string;
  projectId: string;
  type: "generate" | "bg_remove" | "atlas_pack" | "export";
  status: "queued" | "running" | "succeeded" | "failed" | "canceled";
  createdAt: string;
  updatedAt: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  logPath?: string;
};

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

export type CheckpointRecord = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  localPath?: string;
  weights?: Record<string, unknown>;
  supportedAssetTypes: string[];
  promptTemplates?: Record<string, unknown>;
  defaultGenerationParams?: Record<string, unknown>;
};

export type ExportProfile = {
  id: string;
  projectId: string;
  name: string;
  type: "pixi_kit";
  createdAt: string;
  updatedAt: string;
  options: {
    scale?: number;
    trim?: boolean;
    padding?: number;
    namePrefix?: string;
    nameSuffix?: string;
  };
};

export type LoraRelease = {
  id: string;
  createdAt: string;
  status: "candidate" | "approved" | "deprecated";
  weights?: Record<string, unknown>;
  notes?: string;
  training?: Record<string, unknown>;
  evaluation?: Record<string, unknown>;
};

export type LoraRecord = {
  id: string;
  name: string;
  scope: "baseline" | "project";
  projectId?: string;
  checkpointId: string;
  assetTypes: string[];
  recommended?: boolean;
  activeReleaseId?: string;
  releases: LoraRelease[];
  createdAt: string;
  updatedAt: string;
};

export type LoraUpdatePatch = {
  recommended?: boolean;
  activeReleaseId?: string | null;
  releaseUpdates?: Array<{ id: string; status?: LoraRelease["status"]; notes?: string | null }>;
};

export type LoraEval = {
  id: string;
  loraId: string;
  releaseId: string;
  createdAt: string;
  status: "pending" | "running" | "complete";
  prompts: string[];
  outputs: Array<Record<string, unknown>>;
  notes?: string;
};

async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as T;
}

async function apiText(method: string, path: string): Promise<string> {
  const res = await fetch(path, { method });
  if (!res.ok) throw new Error(await res.text());
  return await res.text();
}

export async function listProjects() {
  return api<{ projects: Project[] }>("GET", "/api/projects");
}

export async function createProject(name: string) {
  return api<Project>("POST", "/api/projects", { name });
}

export async function updateProject(projectId: string, patch: Partial<Pick<Project, "policies" | "notes">>) {
  return api<Project>("PATCH", `/api/projects/${projectId}`, patch);
}

export async function listSpecLists(projectId: string) {
  return api<{ specLists: SpecList[] }>("GET", `/api/projects/${projectId}/spec-lists`);
}

export async function createSpecList(projectId: string, title: string, text: string) {
  return api<SpecList>("POST", `/api/projects/${projectId}/spec-lists`, { title, text });
}

export async function updateSpecList(
  projectId: string,
  specListId: string,
  patch: Partial<Pick<SpecList, "status" | "derivedSpecIds" | "notes">>,
) {
  return api<SpecList>("PATCH", `/api/projects/${projectId}/spec-lists/${specListId}`, patch);
}

export async function listJobs(projectId: string) {
  return api<{ jobs: Job[] }>("GET", `/api/projects/${projectId}/jobs`);
}

export async function createJob(projectId: string, type: Job["type"], input: Record<string, unknown>) {
  return api<Job>("POST", `/api/projects/${projectId}/jobs`, { type, input });
}

export async function cancelJob(projectId: string, jobId: string) {
  return api<{ job: Job }>("POST", `/api/projects/${projectId}/jobs/${jobId}/cancel`);
}

export async function retryJob(projectId: string, jobId: string) {
  return api<{ job: Job }>("POST", `/api/projects/${projectId}/jobs/${jobId}/retry`);
}

export async function listAutomationRules(projectId: string) {
  return api<{ rules: AutomationRule[] }>("GET", `/api/projects/${projectId}/automation/rules`);
}

export async function createAutomationRule(projectId: string, body: Partial<AutomationRule>) {
  return api<{ rule: AutomationRule }>("POST", `/api/projects/${projectId}/automation/rules`, body);
}

export async function updateAutomationRule(projectId: string, ruleId: string, patch: Partial<AutomationRule>) {
  return api<{ rule: AutomationRule }>("PUT", `/api/projects/${projectId}/automation/rules/${ruleId}`, patch);
}

export async function listAutomationRuns(projectId: string) {
  return api<{ runs: AutomationRun[] }>("GET", `/api/projects/${projectId}/automation/runs`);
}

export async function createAutomationRun(
  projectId: string,
  body: { ruleId: string; dryRun?: boolean; meta?: Record<string, unknown> },
) {
  return api<{ run: AutomationRun }>("POST", `/api/projects/${projectId}/automation/runs`, body);
}

export async function executeAutomationRun(
  projectId: string,
  body: { ruleId: string; dryRun?: boolean; meta?: Record<string, unknown> },
) {
  return api<{ run: AutomationRun }>("POST", `/api/projects/${projectId}/automation/runs/execute`, body);
}

export async function listCheckpoints(projectId: string) {
  return api<{ checkpoints: CheckpointRecord[] }>("GET", `/api/projects/${projectId}/checkpoints`);
}

export async function createCheckpoint(projectId: string, body: Partial<CheckpointRecord>) {
  return api<CheckpointRecord>("POST", `/api/projects/${projectId}/checkpoints`, body);
}

export async function updateCheckpoint(projectId: string, checkpointId: string, patch: Partial<CheckpointRecord>) {
  return api<CheckpointRecord>("PATCH", `/api/projects/${projectId}/checkpoints/${checkpointId}`, patch);
}

export async function listExportProfiles(projectId: string) {
  return api<{ profiles: ExportProfile[] }>("GET", `/api/projects/${projectId}/export-profiles`);
}

export async function createExportProfile(projectId: string, body: Partial<ExportProfile>) {
  return api<ExportProfile>("POST", `/api/projects/${projectId}/export-profiles`, body);
}

export async function updateExportProfile(projectId: string, profileId: string, patch: Partial<ExportProfile>) {
  return api<ExportProfile>("PATCH", `/api/projects/${projectId}/export-profiles/${profileId}`, patch);
}

export async function listProjectLoras(projectId: string) {
  return api<{ loras: LoraRecord[] }>("GET", `/api/projects/${projectId}/loras`);
}

export async function listSharedLoras() {
  return api<{ loras: LoraRecord[] }>("GET", "/api/shared/loras");
}

export async function updateProjectLora(projectId: string, loraId: string, patch: LoraUpdatePatch) {
  return api<LoraRecord>("PATCH", `/api/projects/${projectId}/loras/${loraId}`, patch);
}

export async function updateSharedLora(loraId: string, patch: LoraUpdatePatch) {
  return api<LoraRecord>("PATCH", `/api/shared/loras/${loraId}`, patch);
}

export async function listProjectEvals(projectId: string) {
  return api<{ evals: LoraEval[] }>("GET", `/api/projects/${projectId}/evals`);
}

export async function listSharedEvals() {
  return api<{ evals: LoraEval[] }>("GET", "/api/shared/evals");
}

export async function getJobLog(projectId: string, jobId: string, opts: { tailBytes?: number } = {}) {
  const tailBytes = opts.tailBytes ?? 50_000;
  const qs = new URLSearchParams({ tailBytes: String(tailBytes) });
  return apiText("GET", `/api/projects/${projectId}/jobs/${jobId}/log?${qs.toString()}`);
}

export async function getSystemLog(service: "backend" | "worker", opts: { tailBytes?: number } = {}) {
  const tailBytes = opts.tailBytes ?? 50_000;
  const qs = new URLSearchParams({ tailBytes: String(tailBytes) });
  return apiText("GET", `/api/system/logs/${service}?${qs.toString()}`);
}

export type SystemStatus = {
  now: string;
  dataRoot: string;
  projects: { count: number; ids: string[] };
  seeded: { astroduckDemo: boolean };
  worker: { ok: boolean; ageMs: number | null; heartbeatPath: string; heartbeat: any };
  comfyui: { baseUrl: string; probeUrl: string; ok: boolean; status: number | null; error: string | null };
};

export async function getSystemStatus() {
  return api<SystemStatus>("GET", "/api/system/status");
}

export type ComfyUiVerify = {
  now: string;
  comfyui: { baseUrl: string; probeUrl: string; ok: boolean; status: number | null; error: string | null };
  objectInfo: { ok: boolean; error: string | null; nodeCount: number | null; categoriesSample: string[] };
  python: { ok: boolean; error: string | null; packagesCount: number | null };
  manifest: {
    path: string;
    exists: boolean;
    examplePath: string;
    exampleExists: boolean;
    customNodes: number | null;
    models: number | null;
  };
  manifestIssues: string[];
  customNodes: Array<{ name: string; matched: boolean }>;
  pythonRequirements: Array<{ package: string; installed: boolean }>;
  workflowFiles: Array<{ path: string; exists: boolean }>;
  localConfig: {
    paths: { modelsRoot: string | null; checkpointsRoot: string | null; lorasRoot: string | null };
    missingRoots: string[];
  };
  checkpoints: Array<{
    id: string;
    path: string | null;
    exists: boolean;
    reason?: string;
    hashExpected?: string;
    hashMatch?: boolean;
  }>;
  loras: Array<{
    id: string;
    path: string | null;
    exists: boolean;
    reason?: string;
    hashExpected?: string;
    hashMatch?: boolean;
  }>;
};

export async function getComfyUiVerify() {
  return api<ComfyUiVerify>("GET", "/api/system/comfyui/verify");
}

export type AssetSpec = {
  id: string;
  projectId: string;
  specListId?: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  assetType: string;
  checkpointId?: string;
  loraIds?: string[];
  output?: {
    kind?: "single_image" | "animation" | "ui_states" | "logo_set";
    background?: "transparent_required" | "any";
    animation?: {
      name?: string;
      fps?: number;
      loop?: boolean;
      frameCount?: number;
      frameNames?: string[];
      framePrompts?: string[];
    };
    uiStates?: { states: string[] };
  };
  style: string;
  scenario: string;
  prompt: { positive: string; negative: string };
  generationParams?: Record<string, unknown>;
  status?: "draft" | "ready" | "deprecated";
};

export async function listSpecs(projectId: string) {
  return api<{ specs: AssetSpec[] }>("GET", `/api/projects/${projectId}/specs`);
}

export async function createSpec(projectId: string, spec: Partial<AssetSpec>) {
  return api<AssetSpec>("POST", `/api/projects/${projectId}/specs`, spec);
}

export async function updateSpec(projectId: string, specId: string, patch: Partial<AssetSpec>) {
  return api<AssetSpec>("PATCH", `/api/projects/${projectId}/specs/${specId}`, patch);
}

export type Asset = {
  id: string;
  projectId: string;
  specId: string;
  updatedAt: string;
  versions: Array<{
    id: string;
    createdAt: string;
    status: string;
    primaryVariantId?: string;
    generation?: Record<string, unknown>;
    variants: Array<{
      id: string;
      originalPath: string;
      alphaPath?: string;
      previewPath?: string;
      tags?: string[];
      rating?: number;
      status?: "candidate" | "selected" | "rejected";
      reviewNote?: string;
    }>;
  }>;
};

export async function listAssets(projectId: string) {
  return api<{ assets: Asset[] }>("GET", `/api/projects/${projectId}/assets`);
}

export type TagCatalog = {
  id: string;
  createdAt: string;
  updatedAt: string;
  groups: Array<{
    id: string;
    label: string;
    exclusive?: boolean;
    tags: Array<{ id: string; label: string }>;
  }>;
};

export async function getTagCatalog(projectId: string) {
  return api<TagCatalog>("GET", `/api/projects/${projectId}/catalogs/tags`);
}

export async function getCatalog(projectId: string, catalogId: string) {
  return api<Record<string, unknown>>("GET", `/api/projects/${projectId}/catalogs/${catalogId}`);
}

export async function updateCatalog(projectId: string, catalogId: string, body: Record<string, unknown>) {
  return api<Record<string, unknown>>("PUT", `/api/projects/${projectId}/catalogs/${catalogId}`, body);
}

export type AssetTypeCatalog = {
  id: string;
  createdAt: string;
  updatedAt: string;
  assetTypes: Array<{
    id: string;
    label: string;
    description?: string;
    multiFrame?: boolean;
    requiresAlpha?: boolean;
    tileable?: boolean;
    defaultTags?: string[];
    defaultGenerationParams?: Record<string, unknown>;
    workflowTemplateId?: string;
  }>;
};

export async function getAssetTypeCatalog(projectId: string) {
  return api<AssetTypeCatalog>("GET", `/api/projects/${projectId}/catalogs/asset-types`);
}

export async function updateAssetVariant(
  projectId: string,
  assetId: string,
  versionId: string,
  variantId: string,
  patch: {
    tags?: string[];
    rating?: number | null;
    status?: "candidate" | "selected" | "rejected";
    reviewNote?: string | null;
  },
) {
  return api<{ ok: true }>(
    "PATCH",
    `/api/projects/${projectId}/assets/${assetId}/versions/${versionId}/variants/${variantId}`,
    patch,
  );
}

export async function setPrimaryVariant(projectId: string, assetId: string, versionId: string, variantId: string) {
  return api<{ ok: true }>("POST", `/api/projects/${projectId}/assets/${assetId}/versions/${versionId}/primary`, {
    variantId,
  });
}

export async function updateAssetVersion(
  projectId: string,
  assetId: string,
  versionId: string,
  patch: { status?: "draft" | "review" | "approved" | "rejected" | "deprecated" },
) {
  return api<{ ok: true }>("PATCH", `/api/projects/${projectId}/assets/${assetId}/versions/${versionId}`, patch);
}

export type AtlasRecord = {
  id: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  imagePath: string;
  packSettings: Record<string, unknown>;
  frames: Array<{
    id: string;
    sourcePath: string;
    rect: { x: number; y: number; w: number; h: number };
    sourceSize: { w: number; h: number };
    pivot?: { x: number; y: number };
  }>;
};

export async function listAtlases(projectId: string) {
  return api<{ atlases: AtlasRecord[] }>("GET", `/api/projects/${projectId}/atlases`);
}

export async function getAtlas(projectId: string, atlasId: string) {
  return api<AtlasRecord>("GET", `/api/projects/${projectId}/atlases/${atlasId}`);
}

export async function updateAtlasFrames(
  projectId: string,
  atlasId: string,
  frames: Array<{ id: string; pivot?: { x: number; y: number } }>,
) {
  return api<AtlasRecord>("PATCH", `/api/projects/${projectId}/atlases/${atlasId}`, { frames });
}
