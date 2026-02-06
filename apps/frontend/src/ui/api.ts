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
  errorClass?: "retryable" | "non_retryable" | "timeout" | "upstream_unavailable";
  attempt?: number;
  maxAttempts?: number;
  nextRetryAt?: string;
  retryHistory?: Array<{
    attempt: number;
    error: string;
    errorClass: string;
    ts: string;
    durationMs?: number;
  }>;
  escalatedAt?: string;
  escalationTarget?: "decision_sprint" | "exception_inbox" | "reject";
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

type ThresholdCheck = {
  enabled: boolean;
  threshold: number;
};

type BackgroundCheck = {
  enabled: boolean;
  mode: "white_or_transparent" | "transparent_only" | "white_only" | "any";
  threshold: number;
};

type AlignmentCheck = {
  enabled: boolean;
  maxPixelDrift: number;
};

export type BaselineProfile = {
  id: string;
  projectId: string;
  checkpointId: string;
  checkpointProfileId?: string;
  name: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  global: {
    noDropShadows: boolean;
    background: "white_or_transparent" | "transparent_only" | "white_only" | "any";
    alphaEdgeClean: "required" | "preferred" | "off";
    allowPerspective: boolean;
  };
  assetTypeProfiles: Record<
    string,
    {
      lighting: "flat" | "soft" | "dramatic" | "any";
      tileableEdges: "required" | "optional" | "off";
      requiredStates: Array<
        | "default"
        | "hover"
        | "pressed"
        | "disabled"
        | "open"
        | "focused"
        | "selected"
        | "active"
        | "checked"
        | "unchecked"
      >;
      stateAlignment: "exact" | "aligned" | "n/a";
      paddingPx: number;
      promptHints: string[];
      negativePromptHints: string[];
      validatorOverrides?: {
        shadowCheck?: ThresholdCheck;
        backgroundCheck?: BackgroundCheck;
        stateCompletenessCheck?: ThresholdCheck;
        stateAlignmentCheck?: AlignmentCheck;
        edgeCleanlinessCheck?: ThresholdCheck;
      };
    }
  >;
  validatorPolicy: {
    shadowCheck: ThresholdCheck;
    backgroundCheck: BackgroundCheck;
    stateCompletenessCheck: ThresholdCheck;
    stateAlignmentCheck: AlignmentCheck;
    edgeCleanlinessCheck: ThresholdCheck;
  };
  routingPolicy: {
    onPass: "auto_advance" | "manual_review" | "queue_decision_sprint";
    onFail: "auto_regenerate" | "manual_review" | "queue_decision_sprint" | "reject";
    onUncertain: "queue_decision_sprint" | "manual_review" | "auto_regenerate";
  };
  specOverrides?: Record<
    string,
    {
      reason: string;
      global?: {
        noDropShadows?: boolean;
        background?: "white_or_transparent" | "transparent_only" | "white_only" | "any";
        alphaEdgeClean?: "required" | "preferred" | "off";
        allowPerspective?: boolean;
      };
      assetTypeProfile?: BaselineProfile["assetTypeProfiles"][string];
    }
  >;
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

export type LoraActivateRenderResult = {
  lora: LoraRecord;
  releaseId: string;
  queuedJobs: string[];
  queuedSpecIds: string[];
  automationRuns: string[];
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

async function apiWithResponse(method: string, path: string, body?: unknown): Promise<Response> {
  const res = await fetch(path, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await res.text());
  return res;
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

export async function listBaselineProfiles(projectId: string) {
  return api<{ profiles: BaselineProfile[] }>("GET", `/api/projects/${projectId}/baseline-profiles`);
}

export async function createBaselineProfile(projectId: string, body: Partial<BaselineProfile>) {
  return api<BaselineProfile>("POST", `/api/projects/${projectId}/baseline-profiles`, body);
}

export async function updateBaselineProfile(projectId: string, profileId: string, patch: Partial<BaselineProfile>) {
  return api<BaselineProfile>("PATCH", `/api/projects/${projectId}/baseline-profiles/${profileId}`, patch);
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

export async function activateProjectLoraReleaseRender(
  projectId: string,
  loraId: string,
  body: {
    releaseId?: string;
    templateId?: string;
    statuses?: Array<"draft" | "ready" | "deprecated">;
    limit?: number;
    strengthModel?: number;
    strengthClip?: number;
  } = {},
) {
  return api<LoraActivateRenderResult>("POST", `/api/projects/${projectId}/loras/${loraId}/activate-render`, body);
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

export type ProjectEvent = {
  id: string;
  projectId: string;
  seq: number;
  ts: string;
  type: string;
  entityType: string;
  entityId: string;
  causalChainId: string;
  idempotencyKey: string;
  payload: Record<string, unknown>;
};

export type ProjectEventCursor = {
  projectId: string;
  lastSeq: number;
  updatedAt: string;
};

export async function listProjectEvents(projectId: string, opts: { since?: number; limit?: number } = {}) {
  const qs = new URLSearchParams();
  if (opts.since !== undefined) qs.set("since", String(opts.since));
  if (opts.limit !== undefined) qs.set("limit", String(opts.limit));
  const path = qs.size > 0 ? `/api/projects/${projectId}/events?${qs.toString()}` : `/api/projects/${projectId}/events`;
  return api<{ events: ProjectEvent[]; cursor: ProjectEventCursor }>("GET", path);
}

export async function getProjectEventCursor(projectId: string) {
  return api<ProjectEventCursor>("GET", `/api/projects/${projectId}/events/cursor`);
}

// ── Phase 8: Continuous Improvement Types ─────────────────────────────

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
  cohort: {
    selectionMethod: string;
    assetType?: string;
    checkpointId?: string;
    tag?: string;
    entityFamily?: string;
    specIds?: string[];
    resolvedSpecIds?: string[];
    resolvedCount?: number;
  };
  intervention: {
    type: string;
    ruleId?: string;
    baselineProfileId?: string;
    checkpointId?: string;
    description?: string;
    params?: Record<string, unknown>;
  };
  metrics?: {
    before?: MetricSnapshot;
    after?: MetricSnapshot;
    delta?: MetricDelta;
  };
  promotionDecision?: string;
  promotedAt?: string;
  rolledBackAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type CircuitBreaker = {
  id: string;
  projectId: string;
  ruleId?: string;
  type: "velocity" | "queue_depth";
  state: "closed" | "open" | "half_open";
  config?: {
    maxTriggersPerMinute?: number;
    maxQueueDepthRatio?: number;
    cooldownMs?: number;
    halfOpenTestCount?: number;
  };
  triggerLog?: string[];
  trippedAt?: string;
  trippedReason?: string;
  stats?: {
    totalTrips?: number;
    lastTripAt?: string;
    blockedTriggers?: number;
  };
  createdAt: string;
  updatedAt: string;
};

export type TrendSnapshot = {
  id: string;
  projectId: string;
  period: { from: string; to: string; granularity: string };
  scope?: { checkpointId?: string; assetType?: string; entityFamily?: string; tag?: string };
  metrics: {
    totalJobs?: number;
    succeededJobs?: number;
    failedJobs?: number;
    totalAssets?: number;
    approvedAssets?: number;
    rejectedAssets?: number;
    firstPassApprovalRate?: number;
    validatorPassRate?: number;
    avgValidatorScore?: number;
    escalationCount?: number;
    autoResolvedDecisions?: number;
    manualDecisions?: number;
    autoResolvedRate?: number;
    avgJobDurationMs?: number;
    cohesionScore?: number;
    driftScore?: number;
    validatorGapCount?: number;
    validatorGapRate?: number;
  };
  createdAt: string;
};

export type BacktestReport = {
  ruleId: string;
  ruleName: string;
  periodFrom: string;
  periodTo: string;
  totalEventsScanned: number;
  matchedEvents: number;
  wouldHaveTriggered: number;
  estimatedJobsEnqueued: number;
  triggerTimestamps: string[];
  peakTriggersPerMinute: number;
  avgTriggersPerHour: number;
  warning?: string;
};

export type ValidatorGapEntry = {
  assetId: string;
  versionId: string;
  specId?: string;
  validatorStatus: string;
  validatorScore?: number;
  humanDecision: string;
  checkId?: string;
  checkScore?: number;
  checkThreshold?: number;
  suggestedAction?: string;
};

export type ValidatorGapReport = {
  projectId: string;
  totalValidatorPasses: number;
  humanRejectedAfterPass: number;
  gapRate: number;
  entries: ValidatorGapEntry[];
  suggestions: string[];
  generatedAt: string;
};

// ── Phase 8: Improvement Run API functions ────────────────────────────

export async function listImprovementRuns(projectId: string) {
  return api<{ runs: ImprovementRun[] }>("GET", `/api/projects/${projectId}/improvement-runs`);
}

export async function getImprovementRun(projectId: string, runId: string) {
  return api<{ run: ImprovementRun }>("GET", `/api/projects/${projectId}/improvement-runs/${runId}`);
}

export async function createImprovementRun(projectId: string, body: Partial<ImprovementRun>) {
  return api<{ run: ImprovementRun }>("POST", `/api/projects/${projectId}/improvement-runs`, body);
}

export async function startImprovementRun(projectId: string, runId: string) {
  return api<{ run: ImprovementRun }>("POST", `/api/projects/${projectId}/improvement-runs/${runId}/start`);
}

export async function completeImprovementRun(projectId: string, runId: string) {
  return api<{ run: ImprovementRun }>("POST", `/api/projects/${projectId}/improvement-runs/${runId}/complete`);
}

export async function promoteImprovementRun(projectId: string, runId: string) {
  return api<{ run: ImprovementRun }>("POST", `/api/projects/${projectId}/improvement-runs/${runId}/promote`);
}

export async function rollbackImprovementRun(projectId: string, runId: string) {
  return api<{ run: ImprovementRun }>("POST", `/api/projects/${projectId}/improvement-runs/${runId}/rollback`);
}

// ── Phase 8: Circuit Breaker API functions ────────────────────────────

export async function listCircuitBreakers(projectId: string) {
  return api<{ breakers: CircuitBreaker[] }>("GET", `/api/projects/${projectId}/circuit-breakers`);
}

export async function resetCircuitBreaker(projectId: string, breakerId: string) {
  return api<{ breaker: CircuitBreaker }>("POST", `/api/projects/${projectId}/circuit-breakers/${breakerId}/reset`);
}

// ── Phase 8: Trend Snapshot API functions ─────────────────────────────

export async function listTrendSnapshots(projectId: string, opts?: { granularity?: string; limit?: number }) {
  const qs = new URLSearchParams();
  if (opts?.granularity) qs.set("granularity", opts.granularity);
  if (opts?.limit) qs.set("limit", String(opts.limit));
  const path = qs.size > 0 ? `/api/projects/${projectId}/trends?${qs.toString()}` : `/api/projects/${projectId}/trends`;
  return api<{ snapshots: TrendSnapshot[] }>("GET", path);
}

export async function generateTrendSnapshot(
  projectId: string,
  body: { from: string; to: string; granularity?: string; scope?: Record<string, string> },
) {
  return api<{ snapshot: TrendSnapshot }>("POST", `/api/projects/${projectId}/trends/generate`, body);
}

// ── Phase 8: Rule Backtesting API function ────────────────────────────

export async function backtestRule(
  projectId: string,
  ruleId: string,
  body?: { periodFrom?: string; periodTo?: string },
) {
  return api<{ report: BacktestReport }>(
    "POST",
    `/api/projects/${projectId}/automation/rules/${ruleId}/backtest`,
    body ?? {},
  );
}

// ── Phase 8: Validator Gap API function ───────────────────────────────

export async function getValidatorGapReport(projectId: string) {
  return api<{ report: ValidatorGapReport }>("GET", `/api/projects/${projectId}/validator-gaps`);
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

export async function getSpec(projectId: string, specId: string) {
  return api<AssetSpec>("GET", `/api/projects/${projectId}/specs/${specId}`);
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
    tags: Array<{
      id: string;
      label: string;
      promptToken?: string;
      aliases?: string[];
      reviewTools?: Array<{ type: string; config?: Record<string, unknown> }>;
    }>;
  }>;
};

export async function getTagCatalog(projectId: string, opts: { checkpointId?: string } = {}) {
  return api<TagCatalog>("GET", withCheckpointQuery(`/api/projects/${projectId}/catalogs/tags`, opts.checkpointId));
}

function withCheckpointQuery(path: string, checkpointId?: string) {
  if (!checkpointId) return path;
  const qs = new URLSearchParams({ checkpointId });
  return `${path}?${qs.toString()}`;
}

export async function getCatalog(projectId: string, catalogId: string, opts: { checkpointId?: string } = {}) {
  return api<Record<string, unknown>>(
    "GET",
    withCheckpointQuery(`/api/projects/${projectId}/catalogs/${catalogId}`, opts.checkpointId),
  );
}

export async function getCatalogWithMeta(
  projectId: string,
  catalogId: string,
  opts: { checkpointId?: string } = {},
): Promise<{ catalog: Record<string, unknown>; resolvedScope: "project" | "checkpoint"; checkpointId: string | null }> {
  const path = withCheckpointQuery(`/api/projects/${projectId}/catalogs/${catalogId}`, opts.checkpointId);
  const separator = path.includes("?") ? "&" : "?";
  const res = await apiWithResponse("GET", `${path}${separator}includeMeta=1`);
  return (await res.json()) as {
    catalog: Record<string, unknown>;
    resolvedScope: "project" | "checkpoint";
    checkpointId: string | null;
  };
}

export async function updateCatalog(
  projectId: string,
  catalogId: string,
  body: Record<string, unknown>,
  opts: { checkpointId?: string } = {},
) {
  return api<Record<string, unknown>>(
    "PUT",
    withCheckpointQuery(`/api/projects/${projectId}/catalogs/${catalogId}`, opts.checkpointId),
    body,
  );
}

export async function getCheckpointCatalog(projectId: string, checkpointId: string, catalogId: string) {
  return api<Record<string, unknown>>(
    "GET",
    `/api/projects/${projectId}/checkpoints/${checkpointId}/catalogs/${catalogId}`,
  );
}

export async function updateCheckpointCatalog(
  projectId: string,
  checkpointId: string,
  catalogId: string,
  body: Record<string, unknown>,
) {
  return api<Record<string, unknown>>(
    "PUT",
    `/api/projects/${projectId}/checkpoints/${checkpointId}/catalogs/${catalogId}`,
    body,
  );
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
  patch: {
    status?: "draft" | "review" | "approved" | "rejected" | "deprecated";
    generationPatch?: Record<string, unknown>;
  },
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

// ── Section 9: Operational Metrics types ──────────────────────────────

export type OperationalMetrics = {
  autopilotReadySpecsPct?: number;
  completeContractSpecsPct?: number;
  checkpointCompatibleSpecsPct?: number;
  validatorFailCategoryDistribution?: Record<string, number>;
  exceptionQueueVolume?: number;
  exceptionQueueAgingHours?: number;
  loraActivationToApprovalHours?: number | null;
  promptCompileDriftByCheckpoint?: Record<string, number>;
  promptCompileDriftByTagFamily?: Record<string, number>;
  automationTriggerToRunLatencyMs?: number | null;
  idempotencyDedupeHitRate?: number;
  escalationReasonCodeDistribution?: Record<string, number>;
  pinnedProfileDriftViolations?: number;
};

export type MetricsSnapshotRecord = {
  id: string;
  projectId: string;
  createdAt: string;
  metrics: OperationalMetrics;
};

export type GateResult = {
  id: string;
  name: string;
  threshold: string;
  measured: number | null;
  unit: string;
  status: "pass" | "fail" | "insufficient_data";
  detail: string;
};

export type BenchmarkProfileResult = {
  targetJobs: number;
  targetAssets: number;
  targetSpecs: number;
  targetAutomationRules: number;
  actualJobs: number;
  actualAssets: number;
  actualSpecs: number;
  actualAutomationRules: number;
  satisfied: boolean;
  warmCacheJobsListMs?: number;
  coldCacheJobsListMs?: number;
};

export type ReleaseGateReport = {
  id: string;
  projectId: string;
  createdAt: string;
  overallStatus: "pass" | "fail" | "insufficient_data";
  benchmarkProfile: BenchmarkProfileResult;
  gates: GateResult[];
};

// ── Section 9: Metrics API functions ──────────────────────────────────

export async function listMetricsSnapshots(projectId: string, opts?: { limit?: number }) {
  const qs = new URLSearchParams();
  if (opts?.limit) qs.set("limit", String(opts.limit));
  const p = qs.size > 0 ? `/api/projects/${projectId}/metrics?${qs.toString()}` : `/api/projects/${projectId}/metrics`;
  return api<{ snapshots: MetricsSnapshotRecord[] }>("GET", p);
}

export async function getMetricsSnapshot(projectId: string, snapshotId: string) {
  return api<{ snapshot: MetricsSnapshotRecord }>("GET", `/api/projects/${projectId}/metrics/${snapshotId}`);
}

export async function generateMetricsSnapshot(projectId: string) {
  return api<{ snapshot: MetricsSnapshotRecord }>("POST", `/api/projects/${projectId}/metrics/generate`);
}

// ── Section 9: Release Gate API functions ─────────────────────────────

export async function listReleaseGateReports(projectId: string, opts?: { limit?: number }) {
  const qs = new URLSearchParams();
  if (opts?.limit) qs.set("limit", String(opts.limit));
  const p =
    qs.size > 0
      ? `/api/projects/${projectId}/release-gates?${qs.toString()}`
      : `/api/projects/${projectId}/release-gates`;
  return api<{ reports: ReleaseGateReport[] }>("GET", p);
}

export async function getReleaseGateReport(projectId: string, reportId: string) {
  return api<{ report: ReleaseGateReport }>("GET", `/api/projects/${projectId}/release-gates/${reportId}`);
}

export async function evaluateReleaseGates(projectId: string) {
  return api<{ report: ReleaseGateReport }>("POST", `/api/projects/${projectId}/release-gates/evaluate`);
}
