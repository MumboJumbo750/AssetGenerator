import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

import { ulid } from "ulid";

import { repoPath, repoRootFromHere, toPosixPath } from "./lib/repo";
import { fileExists, readJson, writeJsonAtomic } from "./lib/json";
import { loadLocalConfig } from "./lib/localConfig";
import { sleep } from "./lib/sleep";
import { createJsonlLogger, type JsonlLogger } from "./lib/logging";
import { appendWorkerEvent } from "./lib/events";
import { loadSchemas, type SchemaRegistry } from "../../backend/src/lib/schemas";
import { executeAutomationRun } from "../../backend/src/services/automation";
import { upsertJobIndexEntry } from "../../backend/src/services/indexes";

import { downloadImage, extractImagesFromHistory, getHistory, submitWorkflow } from "./adapters/comfyui";
import { removeBackground } from "./adapters/bgRemove";
import { packAtlas } from "./adapters/atlasPack";
import sharp from "sharp";

export type ErrorClass = "retryable" | "non_retryable" | "timeout" | "upstream_unavailable";
type EscalationTarget = "decision_sprint" | "exception_inbox" | "reject";

type RetryHistoryEntry = {
  attempt: number;
  error: string;
  errorClass: string;
  ts: string;
  durationMs?: number;
};

export type RetryPolicy = {
  maxAttempts: number;
  backoffMode: "fixed" | "exponential";
  baseDelayMs: number;
  maxDelayMs: number;
  jitterPct: number;
  retryOn: ErrorClass[];
  escalateTo: EscalationTarget;
  stuckRunThresholdMs?: number;
};

const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  backoffMode: "exponential",
  baseDelayMs: 2000,
  maxDelayMs: 60000,
  jitterPct: 0.15,
  retryOn: ["retryable", "timeout", "upstream_unavailable"],
  escalateTo: "exception_inbox",
  stuckRunThresholdMs: 900000, // 15 minutes
};

type Job = {
  id: string;
  projectId: string;
  type: "generate" | "bg_remove" | "atlas_pack" | "export";
  status: "queued" | "running" | "succeeded" | "failed" | "canceled";
  createdAt: string;
  updatedAt: string;
  input: Record<string, any>;
  output?: Record<string, any>;
  error?: string;
  errorClass?: ErrorClass;
  attempt?: number;
  maxAttempts?: number;
  nextRetryAt?: string;
  retryHistory?: RetryHistoryEntry[];
  escalatedAt?: string;
  escalationTarget?: EscalationTarget;
  logPath?: string;
};

type AssetSpec = {
  id: string;
  projectId: string;
  title: string;
  assetType: string;
  prompt: { positive: string; negative: string };
  generationParams?: Record<string, any>;
  output?: Record<string, any>;
  tags?: string[];
  entityLink?: { entityId?: string; role?: string };
  qualityContract?: {
    backgroundPolicy?: "white_or_transparent" | "transparent_only" | "white_only" | "any";
    requiredStates?: string[];
    alignmentTolerancePx?: number;
    perspectiveMode?: "strict" | "allow_minor" | "any";
    silhouetteDriftTolerance?: number;
  };
  baselineProfileId?: string;
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
};

type Asset = {
  id: string;
  projectId: string;
  specId: string;
  createdAt: string;
  updatedAt: string;
  versions: Array<{
    id: string;
    createdAt: string;
    status: "draft" | "review" | "approved" | "rejected" | "deprecated";
    primaryVariantId?: string;
    generation: Record<string, any>;
    variants: Array<{
      id: string;
      originalPath: string;
      alphaPath?: string;
      previewPath?: string;
      tags?: string[];
      rating?: number;
      status?: "candidate" | "selected" | "rejected";
      processing?: Record<string, any>;
    }>;
  }>;
};

type ExportProfile = {
  id: string;
  projectId: string;
  name: string;
  type: "pixi_kit";
  createdAt: string;
  updatedAt: string;
  options: Record<string, any>;
};

function nowIso() {
  return new Date().toISOString();
}

export type PromptTraceEntry = {
  layer:
    | "checkpoint_base"
    | "checkpoint_asset_type"
    | "baseline_hints"
    | "tag_prompt_map"
    | "spec_prompt"
    | "spec_override"
    | "runtime_safety";
  sourceId: string;
  order: number;
  positive?: string;
  negative?: string;
};

type DecisionQuestion = {
  id: string;
  text: string;
  helperTools: string[];
  source: "validator" | "tag_contract" | "entity_contract" | "fallback";
  contractRef?: string;
};

type RoutingDecision = "auto_advance" | "auto_regenerate" | "queue_decision_sprint" | "manual_review" | "reject";

function fnv1a32(input: string) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = (hash >>> 0) * 0x01000193;
  }
  return hash >>> 0;
}

function resolveSeed(spec: AssetSpec, fallbackSeed: number) {
  const mode = spec.seedPolicy?.mode ?? "random_recorded";
  if (mode === "fixed" && Number.isFinite(spec.seedPolicy?.baseSeed)) {
    return Number(spec.seedPolicy?.baseSeed);
  }
  if (mode === "derived") {
    const derive = Array.isArray(spec.seedPolicy?.deriveFrom) && spec.seedPolicy?.deriveFrom.length > 0
      ? spec.seedPolicy?.deriveFrom
      : ["specId", "assetType", "checkpointId"];
    const raw = derive
      .map((key) => {
        if (key === "specId") return spec.id;
        if (key === "assetType") return spec.assetType;
        if (key === "checkpointId") return String((spec as any).checkpointId ?? "");
        return String((spec as any)[key] ?? "");
      })
      .join("|");
    return fnv1a32(raw);
  }
  return fallbackSeed;
}

async function loadJsonIfExists<T>(filePath: string): Promise<T | null> {
  if (!(await fileExists(filePath))) return null;
  return readJson<T>(filePath);
}

function uniqueStrings(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (!value || typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function normalizeReviewTool(tool: string) {
  const normalized = tool.trim();
  if (
    normalized === "overlay_grid" ||
    normalized === "bg_cycler" ||
    normalized === "reference_ghost" ||
    normalized === "safe_area" ||
    normalized === "onion_skin" ||
    normalized === "color_picker" ||
    normalized === "horizon_line"
  ) {
    return normalized;
  }
  return null;
}

function reviewToolsFromTagCatalog(tagCatalog: any, tags: string[]) {
  const tools: string[] = [];
  const groups = Array.isArray(tagCatalog?.groups) ? tagCatalog.groups : [];
  const active = new Set(tags);
  for (const group of groups) {
    const tagEntries = Array.isArray(group?.tags) ? group.tags : [];
    for (const entry of tagEntries) {
      const tagId = typeof entry?.id === "string" ? entry.id : "";
      if (!tagId || !active.has(tagId)) continue;
      const reviewTools = Array.isArray(entry?.reviewTools) ? entry.reviewTools : [];
      for (const reviewTool of reviewTools) {
        const type = normalizeReviewTool(String(reviewTool?.type ?? ""));
        if (type) tools.push(type);
      }
    }
  }
  return uniqueStrings(tools);
}

function validatorQuestionText(checkId: string) {
  if (checkId === "background_policy") return "Is the background policy fulfilled in this render?";
  if (checkId === "state_alignment") return "Do state variants stay aligned and consistent?";
  if (checkId === "silhouette_consistency") return "Does the silhouette stay consistent with the same asset family?";
  if (checkId === "perspective_consistency") return "Is the perspective angle consistent and usable in-game?";
  if (checkId === "entity_prompt_continuity") return "Does this still represent the same linked entity identity?";
  if (checkId === "prompt_policy_tag_order") return "Does prompt intent match the expected tag-priority behavior?";
  if (checkId === "required_states_output_kind") return "Are required states represented by the selected output kind?";
  return "Is this output compliant with the expected contract?";
}

function helperToolsForValidator(checkId: string, tags: string[]) {
  const inferred: string[] = [];
  const hasIso = tags.includes("view:isometric");
  const hasSide = tags.includes("view:side");
  const hasMultiFrame = tags.includes("assetType:spritesheet");
  if (checkId === "perspective_consistency") {
    inferred.push(hasIso ? "overlay_grid" : hasSide ? "horizon_line" : "overlay_grid");
  } else if (checkId === "background_policy") {
    inferred.push("bg_cycler");
  } else if (checkId === "silhouette_consistency" || checkId === "entity_prompt_continuity") {
    inferred.push("reference_ghost");
  } else if (checkId === "state_alignment" || checkId === "required_states_output_kind") {
    inferred.push(hasMultiFrame ? "onion_skin" : "safe_area");
  }
  return uniqueStrings(inferred.map((tool) => normalizeReviewTool(tool)));
}

function buildDecisionQuestions(opts: {
  spec: AssetSpec;
  validatorChecks: Record<string, { pass: boolean; confidence: number; reason: string }>;
  tagCatalog: any;
}) {
  const tags = Array.isArray(opts.spec.tags) ? opts.spec.tags.filter((tag) => typeof tag === "string") : [];
  const baseTagTools = reviewToolsFromTagCatalog(opts.tagCatalog, tags);
  const questions: DecisionQuestion[] = [];
  for (const [checkId, result] of Object.entries(opts.validatorChecks)) {
    if (result.pass) continue;
    const validatorTools = helperToolsForValidator(checkId, tags);
    questions.push({
      id: `q.validator.${checkId}`,
      text: validatorQuestionText(checkId),
      helperTools: uniqueStrings([...validatorTools, ...baseTagTools]),
      source: "validator",
      contractRef: checkId,
    });
  }
  if (opts.spec.entityLink?.entityId) {
    questions.push({
      id: "q.entity.identity",
      text: "Does this match the expected linked entity identity across related assets?",
      helperTools: uniqueStrings(["reference_ghost", ...baseTagTools]),
      source: "entity_contract",
      contractRef: `entity:${opts.spec.entityLink.entityId}`,
    });
  }
  if (questions.length === 0) {
    questions.push({
      id: "q.fallback.ship",
      text: "Should this variant be accepted for production use?",
      helperTools: baseTagTools,
      source: "fallback",
    });
  }
  return {
    questionSetId: `qs_${opts.spec.id}`,
    questions,
    helperTools: uniqueStrings(questions.flatMap((question) => question.helperTools)),
  };
}

function resolveRoutingDecision(opts: {
  summaryStatus: "pass" | "warn" | "fail";
  baselineRoutingPolicy?: {
    onPass?: RoutingDecision;
    onFail?: RoutingDecision;
    onUncertain?: RoutingDecision;
  };
  runtimeFeedbackPolicy?: {
    manualReviewFallbackEnabled?: boolean;
    sprintQueueName?: string;
  };
}) {
  const onPass = opts.baselineRoutingPolicy?.onPass ?? "auto_advance";
  const onFail = opts.baselineRoutingPolicy?.onFail ?? "queue_decision_sprint";
  const onUncertain = opts.baselineRoutingPolicy?.onUncertain ?? "queue_decision_sprint";
  const rawDecision = opts.summaryStatus === "pass" ? onPass : opts.summaryStatus === "fail" ? onFail : onUncertain;
  const manualReviewFallbackEnabled = opts.runtimeFeedbackPolicy?.manualReviewFallbackEnabled === true;
  const decision =
    rawDecision === "manual_review" && !manualReviewFallbackEnabled ? ("queue_decision_sprint" as RoutingDecision) : rawDecision;
  const queue =
    decision === "queue_decision_sprint"
      ? opts.runtimeFeedbackPolicy?.sprintQueueName?.trim() || "decision_sprint_queue"
      : decision === "manual_review"
        ? "manual_review_queue"
        : null;
  return {
    decision,
    queue,
    fallbackApplied: rawDecision === "manual_review" && decision === "queue_decision_sprint",
  };
}

export async function compilePromptPackage(opts: {
  dataRoot: string;
  projectId: string;
  spec: AssetSpec;
  checkpoint: any;
  fallbackPositive: string;
  fallbackNegative: string;
}) {
  const trace: PromptTraceEntry[] = [];
  let order = 0;
  const positives: string[] = [];
  const negatives: string[] = [];
  const add = (entry: PromptTraceEntry) => {
    trace.push(entry);
    if (entry.positive) positives.push(entry.positive);
    if (entry.negative) negatives.push(entry.negative);
  };

  const project = await loadJsonIfExists<any>(path.join(opts.dataRoot, "projects", opts.projectId, "project.json"));
  const checkpointId = String((opts.spec as any).checkpointId ?? opts.checkpoint?.id ?? "");
  const checkpointProfile = project?.policies?.checkpointProfiles?.[checkpointId];
  const checkpointProfileBasePositive =
    typeof checkpointProfile?.basePositive === "string" ? checkpointProfile.basePositive : undefined;
  const checkpointProfileBaseNegative =
    typeof checkpointProfile?.baseNegative === "string" ? checkpointProfile.baseNegative : undefined;
  const checkpointBasePositive = checkpointProfileBasePositive ?? opts.checkpoint?.promptTemplates?.basePositive;
  const checkpointBaseNegative = checkpointProfileBaseNegative ?? opts.checkpoint?.promptTemplates?.baseNegative;

  if (checkpointBasePositive || checkpointBaseNegative) {
    add({
      layer: "checkpoint_base",
      sourceId: `checkpointProfile:${checkpointId}:${String(checkpointProfile?.profileId ?? "legacy")}:v${String(checkpointProfile?.version ?? 1)}`,
      order: ++order,
      positive: String(checkpointBasePositive ?? "").trim() || undefined,
      negative: String(checkpointBaseNegative ?? "").trim() || undefined,
    });
  }

  const perAssetType =
    checkpointProfile?.perAssetType?.[opts.spec.assetType] ??
    opts.checkpoint?.promptTemplates?.perAssetType?.[opts.spec.assetType];
  if (perAssetType?.positive || perAssetType?.negative) {
    add({
      layer: "checkpoint_asset_type",
      sourceId: `checkpointProfile:${checkpointId}:${String(checkpointProfile?.profileId ?? "legacy")}:v${String(checkpointProfile?.version ?? 1)}:assetType:${opts.spec.assetType}`,
      order: ++order,
      positive: String(perAssetType.positive ?? "").trim() || undefined,
      negative: String(perAssetType.negative ?? "").trim() || undefined,
    });
  }

  if (opts.spec.baselineProfileId) {
    const baseline = await loadJsonIfExists<any>(
      path.join(opts.dataRoot, "projects", opts.projectId, "baseline-profiles", `${opts.spec.baselineProfileId}.json`),
    );
    const profile = baseline?.assetTypeProfiles?.[opts.spec.assetType];
    if (profile) {
      add({
        layer: "baseline_hints",
        sourceId: `baseline:${opts.spec.baselineProfileId}:assetType:${opts.spec.assetType}`,
        order: ++order,
        positive: Array.isArray(profile.promptHints) ? profile.promptHints.join(", ") : undefined,
        negative: Array.isArray(profile.negativePromptHints) ? profile.negativePromptHints.join(", ") : undefined,
      });
    }
  }

  const scopedTagPromptMap = project?.policies?.tagPromptMap?.[checkpointId] ?? {};
  const inputTags = (Array.isArray(opts.spec.tags) ? opts.spec.tags : []).filter(
    (tag) => typeof tag === "string" && tag.trim().length > 0,
  );
  const checkpointTagOrder = Array.isArray(checkpointProfile?.tagOrder)
    ? checkpointProfile.tagOrder.filter((tag: unknown) => typeof tag === "string" && String(tag).trim().length > 0)
    : [];
  const explicitTagOrder = Array.isArray(opts.spec.promptPolicy?.tagOrder)
    ? opts.spec.promptPolicy.tagOrder.filter((tag) => typeof tag === "string" && tag.trim().length > 0)
    : [];
  const tagOrderMode =
    opts.spec.promptPolicy?.tagOrderMode === "explicit"
      ? "explicit"
      : checkpointProfile?.tagOrderPolicy === "explicit" || checkpointProfile?.tagOrderPolicy === "checkpoint_default"
        ? "checkpoint_default"
        : "weight";
  const orderSource = tagOrderMode === "explicit" ? explicitTagOrder : checkpointTagOrder;
  const canonicalInput = new Set(inputTags);
  const orderedTags = orderSource.filter((tag: string, index: number) => canonicalInput.has(tag) && orderSource.indexOf(tag) === index);
  const unorderedTags = inputTags.filter((tag) => !orderedTags.includes(tag));
  const tagFragments = [...orderedTags, ...unorderedTags]
    .map((tag) => {
      const fragment = scopedTagPromptMap?.[tag];
      if (!fragment) return null;
      return {
        tag,
        fragment,
        weight: Number(fragment.weight ?? 0),
      };
    })
    .filter(Boolean) as Array<{ tag: string; fragment: any; weight: number }>;
  if (tagOrderMode === "weight") {
    tagFragments.sort((a, b) => {
      if (b.weight !== a.weight) return b.weight - a.weight;
      return a.tag.localeCompare(b.tag);
    });
  } else {
    const orderIndex = new Map<string, number>();
    for (let index = 0; index < orderedTags.length; index += 1) orderIndex.set(orderedTags[index], index);
    tagFragments.sort((a, b) => {
      const left = orderIndex.get(a.tag);
      const right = orderIndex.get(b.tag);
      if (left !== undefined && right !== undefined) return left - right;
      if (left !== undefined) return -1;
      if (right !== undefined) return 1;
      if (b.weight !== a.weight) return b.weight - a.weight;
      return a.tag.localeCompare(b.tag);
    });
  }
  for (const item of tagFragments) {
    const fragment = item.fragment;
    if (!fragment) continue;
    add({
      layer: "tag_prompt_map",
      sourceId: `tagPromptMap:${checkpointId}:${item.tag}`,
      order: ++order,
      positive: typeof fragment.positive === "string" ? fragment.positive : undefined,
      negative: typeof fragment.negative === "string" ? fragment.negative : undefined,
    });
  }

  add({
    layer: "spec_prompt",
    sourceId: `spec:${opts.spec.id}`,
    order: ++order,
    positive: opts.fallbackPositive,
    negative: opts.fallbackNegative,
  });

  if (opts.spec.promptPolicy?.compileMode === "spec_override") {
    add({
      layer: "spec_override",
      sourceId: `spec:${opts.spec.id}:override`,
      order: ++order,
      positive: opts.spec.prompt?.positive ?? "",
      negative: opts.spec.prompt?.negative ?? "",
    });
  }

  const checkpointRuntimeSafety = checkpointProfile?.runtimeSafety;
  const projectRuntimeSafety = project?.policies?.runtimeSafety;
  const runtimeSafety = checkpointRuntimeSafety ?? projectRuntimeSafety;
  const runtimeSafetyEnabled = runtimeSafety?.enabled !== false;
  const safetyPositive = Array.isArray(runtimeSafety?.positive)
    ? runtimeSafety.positive.filter((entry: unknown) => typeof entry === "string" && String(entry).trim().length > 0)
    : [];
  const safetyNegative = Array.isArray(runtimeSafety?.negative)
    ? runtimeSafety.negative.filter((entry: unknown) => typeof entry === "string" && String(entry).trim().length > 0)
    : [];
  if (runtimeSafetyEnabled && (safetyPositive.length > 0 || safetyNegative.length > 0)) {
    add({
      layer: "runtime_safety",
      sourceId: `runtimeSafety:${checkpointId || "default"}`,
      order: ++order,
      positive: safetyPositive.join(", "),
      negative: safetyNegative.join(", "),
    });
  }

  const compiled = {
    positive: positives.filter(Boolean).join(", "),
    negative: negatives.filter(Boolean).join(", "),
  };
  const packageHash = createHash("sha256").update(JSON.stringify({ compiled, trace })).digest("hex");
  return { compiled, trace, packageHash };
}

async function buildPromptDriftEvidence(opts: {
  dataRoot: string;
  projectId: string;
  specId: string;
  entityId?: string;
  promptPackageHash?: string;
}) {
  if (!opts.entityId || !opts.promptPackageHash) return null;
  const assetsDir = path.join(opts.dataRoot, "projects", opts.projectId, "assets");
  try {
    const entries = await fs.readdir(assetsDir, { withFileTypes: true });
    let comparedCount = 0;
    let exactHashMatches = 0;
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      const asset = await readJson<any>(path.join(assetsDir, entry.name));
      if (asset?.specId === opts.specId) continue;
      const versions = Array.isArray(asset?.versions) ? asset.versions : [];
      for (const version of versions) {
        const generation = version?.generation ?? {};
        if (generation?.entityLink?.entityId !== opts.entityId) continue;
        if (typeof generation?.promptPackageHash !== "string") continue;
        comparedCount += 1;
        if (generation.promptPackageHash === opts.promptPackageHash) exactHashMatches += 1;
      }
    }
    return {
      entityId: opts.entityId,
      comparedCount,
      exactHashMatches,
      exactHashMismatch: Math.max(0, comparedCount - exactHashMatches),
      mode: "prompt_package_hash",
    };
  } catch {
    return null;
  }
}

async function buildValidatorReport(opts: {
  dataRoot: string;
  projectId: string;
  spec: AssetSpec;
  variantImagePaths?: string[];
  promptCompileTrace?: PromptTraceEntry[];
  promptPackageHash?: string;
  promptDriftEvidence?: {
    comparedCount: number;
    exactHashMismatch: number;
  } | null;
}) {
  const checks: Record<string, { pass: boolean; confidence: number; reason: string }> = {};
  let total = 0;
  let passed = 0;
  const add = (id: string, pass: boolean, confidence: number, reason: string) => {
    checks[id] = { pass, confidence, reason };
    total += 1;
    if (pass) passed += 1;
  };

  if (opts.spec.baselineProfileId && (opts.spec as any).checkpointId) {
    const baseline = await loadJsonIfExists<any>(
      path.join(opts.dataRoot, "projects", opts.projectId, "baseline-profiles", `${opts.spec.baselineProfileId}.json`),
    );
    if (baseline?.checkpointId) {
      const pass = baseline.checkpointId === (opts.spec as any).checkpointId;
      add(
        "baseline_checkpoint_compat",
        pass,
        1,
        pass ? "Baseline profile matches checkpoint" : "Baseline profile checkpoint mismatch",
      );
    }
  }

  add(
    "prompt_policy_evidence",
    Boolean(opts.promptPackageHash),
    1,
    opts.promptPackageHash ? "Prompt package hash recorded" : "Missing prompt package hash evidence",
  );

  if (opts.spec.promptPolicy?.tagOrderMode === "explicit" && Array.isArray(opts.spec.promptPolicy?.tagOrder)) {
    const traceTags = (opts.promptCompileTrace ?? [])
      .filter((entry) => entry.layer === "tag_prompt_map")
      .map((entry) => {
        const parts = String(entry.sourceId).split(":");
        return parts[parts.length - 1];
      });
    const expected = opts.spec.promptPolicy.tagOrder;
    const orderedSubset = expected.every((tag, index) => traceTags[index] === tag);
    add(
      "prompt_policy_tag_order",
      orderedSubset,
      0.9,
      orderedSubset ? "Explicit tag order honored in compile trace" : "Compile trace deviates from explicit tag order",
    );
  } else if (opts.spec.promptPolicy?.tagOrderMode === "checkpoint_default") {
    const project = await loadJsonIfExists<any>(path.join(opts.dataRoot, "projects", opts.projectId, "project.json"));
    const checkpointId = String((opts.spec as any).checkpointId ?? "");
    const profileOrder = Array.isArray(project?.policies?.checkpointProfiles?.[checkpointId]?.tagOrder)
      ? project.policies.checkpointProfiles[checkpointId].tagOrder
      : [];
    const inputTags = Array.isArray(opts.spec.tags) ? opts.spec.tags : [];
    const inputSet = new Set(inputTags.filter((tag) => typeof tag === "string"));
    const expected = profileOrder.filter(
      (tag: unknown): tag is string => typeof tag === "string" && inputSet.has(String(tag)),
    );
    if (expected.length > 0) {
      const traceTags = (opts.promptCompileTrace ?? [])
        .filter((entry) => entry.layer === "tag_prompt_map")
        .map((entry) => {
          const parts = String(entry.sourceId).split(":");
          return parts[parts.length - 1];
        });
      const orderedSubset = expected.every((tag: string, index: number) => traceTags[index] === tag);
      add(
        "prompt_policy_tag_order",
        orderedSubset,
        0.9,
        orderedSubset
          ? "Checkpoint default tag order honored in compile trace"
          : "Compile trace deviates from checkpoint default tag order",
      );
    }
  }

  type VariantStats = {
    width: number;
    height: number;
    alphaCoverage: number;
    bbox: { minX: number; minY: number; maxX: number; maxY: number; w: number; h: number } | null;
    centroid: { x: number; y: number } | null;
    orientationDeg: number | null;
  };
  const computeVariantStats = async (absPath: string): Promise<VariantStats | null> => {
    try {
      const image = sharp(absPath).ensureAlpha();
      const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
      const width = info.width;
      const height = info.height;
      const channels = info.channels;
      let alphaCount = 0;
      let minX = width;
      let minY = height;
      let maxX = -1;
      let maxY = -1;
      let sumX = 0;
      let sumY = 0;
      let m20 = 0;
      let m02 = 0;
      let m11 = 0;
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const idx = (y * width + x) * channels;
          const a = data[idx + 3];
          if (a > 15) {
            alphaCount += 1;
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
            sumX += x;
            sumY += y;
          }
        }
      }
      if (alphaCount === 0) {
        return {
          width,
          height,
          alphaCoverage: 0,
          bbox: null,
          centroid: null,
          orientationDeg: null,
        };
      }
      const cx = sumX / alphaCount;
      const cy = sumY / alphaCount;
      for (let y = minY; y <= maxY; y += 1) {
        for (let x = minX; x <= maxX; x += 1) {
          const idx = (y * width + x) * channels;
          const a = data[idx + 3];
          if (a <= 15) continue;
          const dx = x - cx;
          const dy = y - cy;
          m20 += dx * dx;
          m02 += dy * dy;
          m11 += dx * dy;
        }
      }
      const orientation = 0.5 * Math.atan2(2 * m11, m20 - m02);
      return {
        width,
        height,
        alphaCoverage: alphaCount / (width * height),
        bbox: { minX, minY, maxX, maxY, w: maxX - minX + 1, h: maxY - minY + 1 },
        centroid: { x: cx, y: cy },
        orientationDeg: (orientation * 180) / Math.PI,
      };
    } catch {
      return null;
    }
  };

  const variantStats: VariantStats[] = [];
  for (const relPath of opts.variantImagePaths ?? []) {
    const abs = path.join(opts.dataRoot, relPath);
    const stats = await computeVariantStats(abs);
    if (stats) variantStats.push(stats);
  }

  if (variantStats.length > 0) {
    const bgPolicy = opts.spec.qualityContract?.backgroundPolicy ?? "white_or_transparent";
    if (bgPolicy !== "any") {
      const alphaCoverages = variantStats.map((item) => item.alphaCoverage);
      const hasTransparency = alphaCoverages.some((value) => value > 0.01);
      const pass =
        bgPolicy === "transparent_only" ? hasTransparency : bgPolicy === "white_only" ? !hasTransparency : true;
      add(
        "background_policy",
        pass,
        0.85,
        pass ? `Background policy ${bgPolicy} satisfied` : `Background policy ${bgPolicy} likely violated`,
      );
    }

    const centers = variantStats.map((item) => item.centroid).filter(Boolean) as Array<{ x: number; y: number }>;
    if (centers.length > 1) {
      const cx = centers.reduce((sum, item) => sum + item.x, 0) / centers.length;
      const cy = centers.reduce((sum, item) => sum + item.y, 0) / centers.length;
      const maxDrift = centers.reduce((max, item) => Math.max(max, Math.hypot(item.x - cx, item.y - cy)), 0);
      const tol = Number(opts.spec.qualityContract?.alignmentTolerancePx ?? 2);
      add(
        "state_alignment",
        maxDrift <= tol,
        0.8,
        maxDrift <= tol ? `Alignment drift ${maxDrift.toFixed(2)}px <= ${tol}px` : `Alignment drift ${maxDrift.toFixed(2)}px > ${tol}px`,
      );
    }

    const bboxes = variantStats.map((item) => item.bbox).filter(Boolean) as Array<{ w: number; h: number }>;
    if (bboxes.length > 1) {
      const areas = bboxes.map((item) => item.w * item.h);
      const avgArea = areas.reduce((sum, value) => sum + value, 0) / areas.length;
      const drift = Math.max(...areas.map((value) => Math.abs(value - avgArea) / Math.max(1, avgArea)));
      const tol = Number(opts.spec.qualityContract?.silhouetteDriftTolerance ?? 0.2);
      add(
        "silhouette_consistency",
        drift <= tol,
        0.75,
        drift <= tol ? `Silhouette drift ${drift.toFixed(3)} <= ${tol}` : `Silhouette drift ${drift.toFixed(3)} > ${tol}`,
      );
    }

    const perspectiveMode = opts.spec.qualityContract?.perspectiveMode ?? "allow_minor";
    const orientations = variantStats.map((item) => item.orientationDeg).filter((v) => Number.isFinite(v)) as number[];
    if (orientations.length > 1 && perspectiveMode !== "any") {
      const avg = orientations.reduce((sum, value) => sum + value, 0) / orientations.length;
      const maxDelta = Math.max(...orientations.map((value) => Math.abs(value - avg)));
      const tol = perspectiveMode === "strict" ? 4 : 10;
      add(
        "perspective_consistency",
        maxDelta <= tol,
        0.7,
        maxDelta <= tol
          ? `Perspective delta ${maxDelta.toFixed(2)}deg <= ${tol}deg`
          : `Perspective delta ${maxDelta.toFixed(2)}deg > ${tol}deg`,
      );
    }
  }

  const requiredStates = Array.isArray((opts.spec as any).qualityContract?.requiredStates)
    ? ((opts.spec as any).qualityContract.requiredStates as string[])
    : [];
  if (requiredStates.length > 1) {
    const kind = String((opts.spec as any).output?.kind ?? "single_image");
    const pass = kind === "animation" || kind === "ui_states";
    add(
      "required_states_output_kind",
      pass,
      0.8,
      pass ? "Output kind supports multiple required states" : "Multiple required states on non-stateful output kind",
    );
  }

  if (opts.spec.entityLink?.entityId) {
    const drift = opts.promptDriftEvidence;
    const pass = !drift || drift.exactHashMismatch === 0;
    add(
      "entity_prompt_continuity",
      pass,
      drift && drift.comparedCount > 0 ? 0.7 : 0.4,
      pass ? "Entity-linked prompt drift within tolerance" : "Entity-linked prompt drift detected",
    );
  }

  const score = total > 0 ? passed / total : 1;
  return {
    checks,
    summary: {
      passed,
      total,
      score,
      status: score >= 0.85 ? "pass" : score >= 0.65 ? "warn" : "fail",
    },
  };
}

type ComfyProgress = { value: number; max: number; percent: number };

function extractComfyProgress(history: any, promptId: string): ComfyProgress | null {
  const entry = history?.[promptId];
  if (!entry) return null;
  const status = entry?.status;
  if (status?.completed === true) return { value: 1, max: 1, percent: 100 };
  const messages: any[] = Array.isArray(status?.messages) ? status.messages : [];
  let lastProgress: any = null;
  for (const msg of messages) {
    if (!Array.isArray(msg) || msg.length < 2) continue;
    if (msg[0] === "progress" && msg[1]) lastProgress = msg[1];
  }
  if (!lastProgress) return null;
  const value = Number(lastProgress.value ?? lastProgress.step ?? 0);
  const max = Number(lastProgress.max ?? lastProgress.total ?? 0);
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return null;
  const percent = Math.max(0, Math.min(100, Math.round((value / max) * 100)));
  return { value, max, percent };
}

async function updateJobOutput(filePath: string, patch: Record<string, unknown>) {
  const job = await readJson<Job>(filePath);
  job.output = { ...(job.output ?? {}), ...patch };
  job.updatedAt = nowIso();
  await writeJsonAtomic(filePath, job);
}

async function writeWorkerHeartbeat(dataRoot: string, opts: { pid: number; intervalMs: number }) {
  const outPath = path.join(dataRoot, "runtime", "worker-heartbeat.json");
  const tmp = `${outPath}.tmp`;
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  const body = {
    ts: nowIso(),
    pid: opts.pid,
    pollIntervalMs: opts.intervalMs,
  };
  await fs.writeFile(tmp, JSON.stringify(body, null, 2) + "\n", "utf8");
  await fs.rename(tmp, outPath);
  return outPath;
}

async function listQueuedJobs(projectDir: string) {
  const jobsDir = path.join(projectDir, "jobs");
  const now = Date.now();
  try {
    const entries = await fs.readdir(jobsDir, { withFileTypes: true });
    const jobs: Array<{ filePath: string; job: Job }> = [];
    for (const e of entries) {
      if (!e.isFile() || !e.name.endsWith(".json")) continue;
      const filePath = path.join(jobsDir, e.name);
      const job = await readJson<Job>(filePath);
      if (job.status !== "queued") continue;
      // If job has a nextRetryAt set, only pick it up after that time
      if (job.nextRetryAt) {
        const retryAt = Date.parse(job.nextRetryAt);
        if (Number.isFinite(retryAt) && retryAt > now) continue;
      }
      jobs.push({ filePath, job });
    }
    jobs.sort((a, b) => a.job.createdAt.localeCompare(b.job.createdAt));
    return jobs;
  } catch {
    return [];
  }
}

async function listQueuedAutomationRuns(projectDir: string) {
  const runsDir = path.join(projectDir, "automation-runs");
  try {
    const entries = await fs.readdir(runsDir, { withFileTypes: true });
    const runs: Array<{ runId: string; createdAt: string }> = [];
    for (const e of entries) {
      if (!e.isFile() || !e.name.endsWith(".json")) continue;
      const filePath = path.join(runsDir, e.name);
      const run = await readJson<{ id: string; status: string; createdAt: string }>(filePath);
      if (run.status === "queued" && run.id) runs.push({ runId: run.id, createdAt: run.createdAt });
    }
    runs.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return runs;
  } catch {
    return [];
  }
}

// ── Error classification ──────────────────────────────────────────────

export function classifyError(err: any): ErrorClass {
  const msg = (err?.message ?? String(err)).toLowerCase();
  const code: string = (err?.code ?? "").toUpperCase();

  // ── Non-retryable: schema / validation / bad-input errors (check first) ──
  if (msg.includes("schema") || msg.includes("validation") || msg.includes("invalid input")) return "non_retryable";
  if (code === "ERR_INVALID_ARG_TYPE" || code === "ERR_ASSERTION") return "non_retryable";

  // ── Timeouts (Node.js codes + message heuristics) ──
  if (code === "ETIMEDOUT" || code === "UND_ERR_CONNECT_TIMEOUT" || code === "UND_ERR_HEADERS_TIMEOUT")
    return "timeout";
  if (msg.includes("timeout") || msg.includes("timed out") || msg.includes("deadline")) return "timeout";
  // AbortError from fetch/AbortController
  if (err?.name === "AbortError" || code === "ABORT_ERR") return "timeout";

  // ── Upstream / network errors (ComfyUI down, DNS, connection refused, etc.) ──
  if (
    code === "ECONNREFUSED" ||
    code === "ECONNRESET" ||
    code === "ENOTFOUND" ||
    code === "EPIPE" ||
    code === "EHOSTUNREACH" ||
    code === "EAI_AGAIN"
  )
    return "upstream_unavailable";
  // HTTP status codes in message or as property
  const httpStatus = err?.status ?? err?.statusCode ?? 0;
  if (httpStatus === 502 || httpStatus === 503 || httpStatus === 504) return "upstream_unavailable";
  if (
    msg.includes("econnrefused") ||
    msg.includes("econnreset") ||
    msg.includes("enotfound") ||
    msg.includes("fetch failed") ||
    msg.includes("network") ||
    msg.includes("503") ||
    msg.includes("502") ||
    msg.includes("unavailable")
  )
    return "upstream_unavailable";
  // ComfyUI-specific: queue full, prompt execution error indicating transient state
  if (msg.includes("queue full") || msg.includes("comfyui") && msg.includes("busy")) return "upstream_unavailable";

  // ── Retryable transient errors ──
  if (code === "EPERM" || code === "EACCES" || code === "EBUSY" || code === "ENOLCK") return "retryable";
  if (httpStatus === 429) return "retryable"; // rate-limited
  if (httpStatus >= 500 && httpStatus < 600) return "retryable"; // other server errors
  if (
    msg.includes("busy") ||
    msg.includes("lock") ||
    msg.includes("temporary") ||
    msg.includes("could not connect") ||
    msg.includes("eperm") ||
    msg.includes("eacces") ||
    msg.includes("rate limit")
  )
    return "retryable";

  // Everything else is non-retryable (bad input, missing files, logic errors, etc.)
  return "non_retryable";
}

// ── Retry policy resolution ───────────────────────────────────────────

type ProjectRetryPolicyResult = {
  policy: RetryPolicy;
  raw: Record<string, any> | null;
};

async function loadProjectRetryPolicy(dataRoot: string, projectId: string): Promise<ProjectRetryPolicyResult> {
  const projectPath = path.join(dataRoot, "projects", projectId, "project.json");
  try {
    if (!(await fileExists(projectPath))) return { policy: { ...DEFAULT_RETRY_POLICY }, raw: null };
    const project = await readJson<{
      policies?: { retryPolicy?: Partial<RetryPolicy> & { perJobType?: Record<string, Partial<RetryPolicy>> } };
    }>(projectPath);
    const base = project.policies?.retryPolicy;
    if (!base) return { policy: { ...DEFAULT_RETRY_POLICY }, raw: null };
    return {
      policy: {
        maxAttempts: base.maxAttempts ?? DEFAULT_RETRY_POLICY.maxAttempts,
        backoffMode: base.backoffMode ?? DEFAULT_RETRY_POLICY.backoffMode,
        baseDelayMs: base.baseDelayMs ?? DEFAULT_RETRY_POLICY.baseDelayMs,
        maxDelayMs: base.maxDelayMs ?? DEFAULT_RETRY_POLICY.maxDelayMs,
        jitterPct: base.jitterPct ?? DEFAULT_RETRY_POLICY.jitterPct,
        retryOn: base.retryOn ?? DEFAULT_RETRY_POLICY.retryOn,
        escalateTo: (base.escalateTo ?? DEFAULT_RETRY_POLICY.escalateTo) as EscalationTarget,
        stuckRunThresholdMs: base.stuckRunThresholdMs ?? DEFAULT_RETRY_POLICY.stuckRunThresholdMs,
      },
      raw: base as Record<string, any>,
    };
  } catch {
    return { policy: { ...DEFAULT_RETRY_POLICY }, raw: null };
  }
}

function resolveRetryPolicyForJob(
  globalPolicy: RetryPolicy,
  projectPolicy: any,
  jobType: string,
): RetryPolicy {
  const perType = projectPolicy?.perJobType?.[jobType];
  if (!perType) return globalPolicy;
  return {
    maxAttempts: perType.maxAttempts ?? globalPolicy.maxAttempts,
    backoffMode: perType.backoffMode ?? globalPolicy.backoffMode,
    baseDelayMs: perType.baseDelayMs ?? globalPolicy.baseDelayMs,
    maxDelayMs: perType.maxDelayMs ?? globalPolicy.maxDelayMs,
    jitterPct: perType.jitterPct ?? globalPolicy.jitterPct,
    retryOn: perType.retryOn ?? globalPolicy.retryOn,
    escalateTo: (perType.escalateTo ?? globalPolicy.escalateTo) as EscalationTarget,
    stuckRunThresholdMs: perType.stuckRunThresholdMs ?? globalPolicy.stuckRunThresholdMs,
  };
}

export function computeBackoffMs(policy: RetryPolicy, attempt: number): number {
  let delay: number;
  if (policy.backoffMode === "exponential") {
    delay = policy.baseDelayMs * Math.pow(2, attempt - 1);
  } else {
    delay = policy.baseDelayMs;
  }
  delay = Math.min(delay, policy.maxDelayMs);
  const jitter = delay * policy.jitterPct * (Math.random() * 2 - 1);
  return Math.max(100, Math.round(delay + jitter));
}

// ── Stuck-run recovery ────────────────────────────────────────────────

const DEFAULT_STUCK_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes

async function recoverStuckJobs(projectDir: string, log: JsonlLogger, thresholdMs?: number): Promise<number> {
  const stuckThreshold = thresholdMs ?? Number(process.env.ASSETGEN_WORKER_STUCK_THRESHOLD_MS || DEFAULT_STUCK_THRESHOLD_MS);
  const jobsDir = path.join(projectDir, "jobs");
  let recovered = 0;
  try {
    const entries = await fs.readdir(jobsDir, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isFile() || !e.name.endsWith(".json")) continue;
      const filePath = path.join(jobsDir, e.name);
      const job = await readJson<Job>(filePath);
      if (job.status !== "running") continue;
      const runningMs = Date.now() - Date.parse(job.updatedAt);
      if (runningMs > stuckThreshold) {
        job.status = "queued";
        job.updatedAt = nowIso();
        job.error = `Recovered from stuck running state after ${Math.round(runningMs / 1000)}s`;
        job.errorClass = "retryable";
        await writeJsonAtomic(filePath, job);
        await log.info("stuck_job_recovered", { jobId: job.id, projectId: job.projectId, stuckMs: runningMs });
        recovered += 1;
      }
    }
  } catch {
    // jobs dir may not exist
  }
  return recovered;
}

async function recoverStuckAutomationRuns(projectDir: string, log: JsonlLogger, thresholdMs?: number): Promise<number> {
  const stuckThreshold = thresholdMs ?? Number(process.env.ASSETGEN_WORKER_STUCK_THRESHOLD_MS || DEFAULT_STUCK_THRESHOLD_MS);
  const runsDir = path.join(projectDir, "automation-runs");
  let recovered = 0;
  try {
    const entries = await fs.readdir(runsDir, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isFile() || !e.name.endsWith(".json")) continue;
      const filePath = path.join(runsDir, e.name);
      const run = await readJson<{ id: string; status: string; updatedAt: string; error?: string }>(filePath);
      if (run.status !== "running") continue;
      const runningMs = Date.now() - Date.parse(run.updatedAt);
      if (runningMs > stuckThreshold) {
        run.status = "queued";
        run.updatedAt = nowIso();
        run.error = `Recovered from stuck running state after ${Math.round(runningMs / 1000)}s`;
        await writeJsonAtomic(filePath, run);
        await log.info("stuck_run_recovered", { runId: run.id, stuckMs: runningMs });
        recovered += 1;
      }
    }
  } catch {
    // runs dir may not exist
  }
  return recovered;
}

function relToData(dataRoot: string, absPath: string) {
  return toPosixPath(path.relative(dataRoot, absPath));
}

async function upsertAsset(dataRoot: string, projectId: string, asset: Asset) {
  const assetPath = path.join(dataRoot, "projects", projectId, "assets", `${asset.id}.json`);
  await writeJsonAtomic(assetPath, asset);
}

async function loadAssetIfExists(dataRoot: string, projectId: string, assetId: string): Promise<Asset | null> {
  const assetPath = path.join(dataRoot, "projects", projectId, "assets", `${assetId}.json`);
  if (!(await fileExists(assetPath))) return null;
  return readJson<Asset>(assetPath);
}

function summarizeJobInput(input: Record<string, any>) {
  const out: Record<string, any> = { ...input };
  if (out.workflow) out.workflow = "[omitted workflow]";
  if (Array.isArray(out.nextJobs)) out.nextJobs = `[${out.nextJobs.length} chained jobs omitted]`;
  if (Array.isArray(out.framePaths) && out.framePaths.length > 100)
    out.framePaths = `[${out.framePaths.length} frames omitted]`;
  if (Array.isArray(out.assetIds) && out.assetIds.length > 200)
    out.assetIds = `[${out.assetIds.length} assetIds omitted]`;
  if (Array.isArray(out.atlasIds) && out.atlasIds.length > 200)
    out.atlasIds = `[${out.atlasIds.length} atlasIds omitted]`;
  return out;
}

type JobLoraInput = {
  loraId?: string;
  releaseId?: string;
  loraName?: string;
  weightPath?: string;
  localPath?: string;
  strengthModel?: number;
  strengthClip?: number;
  weight?: number;
};

type ResolvedJobLora = {
  loraId?: string;
  releaseId?: string;
  loraName: string;
  strengthModel: number;
  strengthClip: number;
};

function normalizePathLike(value: string) {
  return value.replace(/\\/g, "/");
}

function resolveJobLoras(raw: unknown): ResolvedJobLora[] {
  if (!Array.isArray(raw)) return [];
  const resolved: ResolvedJobLora[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const lora = entry as JobLoraInput;
    const loraNameRaw = String(lora.loraName ?? lora.weightPath ?? lora.localPath ?? lora.loraId ?? "").trim();
    if (!loraNameRaw) continue;
    const strengthModelRaw = Number(lora.strengthModel ?? lora.weight ?? 1);
    const strengthModel = Number.isFinite(strengthModelRaw) ? strengthModelRaw : 1;
    const strengthClipRaw = Number(lora.strengthClip ?? strengthModel);
    const strengthClip = Number.isFinite(strengthClipRaw) ? strengthClipRaw : strengthModel;
    resolved.push({
      ...(lora.loraId ? { loraId: String(lora.loraId) } : {}),
      ...(lora.releaseId ? { releaseId: String(lora.releaseId) } : {}),
      loraName: normalizePathLike(loraNameRaw),
      strengthModel,
      strengthClip,
    });
  }
  return resolved;
}

function applyLoraChainToWorkflow(opts: { workflow: any; baseNodeId: string; loras: ResolvedJobLora[] }) {
  const { workflow, baseNodeId, loras } = opts;
  if (!workflow?.[baseNodeId]?.inputs || loras.length === 0) return { addedNodes: 0, applied: 0 };

  const baseNode = workflow[baseNodeId];
  const baseInputs = baseNode.inputs ?? {};

  const first = loras[0];
  baseInputs.lora_name = first.loraName;
  baseInputs.strength_model = first.strengthModel;
  baseInputs.strength_clip = first.strengthClip;

  let prevNodeId = String(baseNodeId);
  const addedNodeIds: string[] = [];
  const nextNodeId = () => {
    const max = Object.keys(workflow)
      .map((key) => Number(key))
      .filter((num) => Number.isFinite(num))
      .reduce((acc, num) => Math.max(acc, num), 0);
    return String(max + 1);
  };

  for (let idx = 1; idx < loras.length; idx += 1) {
    const lora = loras[idx];
    const nodeId = nextNodeId();
    workflow[nodeId] = {
      class_type: baseNode.class_type,
      inputs: {
        ...baseInputs,
        model: [prevNodeId, 0],
        clip: [prevNodeId, 1],
        lora_name: lora.loraName,
        strength_model: lora.strengthModel,
        strength_clip: lora.strengthClip,
      },
    };
    addedNodeIds.push(nodeId);
    prevNodeId = nodeId;
  }

  if (addedNodeIds.length > 0) {
    for (const [nodeId, node] of Object.entries<any>(workflow)) {
      if (nodeId === String(baseNodeId) || addedNodeIds.includes(nodeId)) continue;
      if (!node?.inputs || typeof node.inputs !== "object") continue;
      for (const [inputKey, inputValue] of Object.entries<any>(node.inputs)) {
        if (
          Array.isArray(inputValue) &&
          inputValue.length >= 2 &&
          String(inputValue[0]) === String(baseNodeId) &&
          (inputValue[1] === 0 || inputValue[1] === 1)
        ) {
          node.inputs[inputKey] = [prevNodeId, inputValue[1]];
        }
      }
    }
  }

  return { addedNodes: addedNodeIds.length, applied: loras.length };
}

function resolveTemplateValue(
  value: unknown,
  ctx: { input: Record<string, any>; output: Record<string, any>; projectId: string; jobId: string },
): unknown {
  const resolveToken = (token: string): unknown => {
    if (token === "$projectId") return ctx.projectId;
    if (token === "$jobId") return ctx.jobId;
    const outputMatch = token.match(/^\$output\.([a-zA-Z0-9_]+)$/);
    if (outputMatch) return ctx.output?.[outputMatch[1]];
    const inputMatch = token.match(/^\$input\.([a-zA-Z0-9_]+)$/);
    if (inputMatch) return ctx.input?.[inputMatch[1]];
    return undefined;
  };

  if (typeof value === "string") {
    const exactResolved = resolveToken(value);
    if (exactResolved !== undefined) return exactResolved;

    // Allow token interpolation inside paths/labels while preserving unresolved tokens.
    return value.replace(/\$(?:projectId|jobId|output\.[a-zA-Z0-9_]+|input\.[a-zA-Z0-9_]+)/g, (token) => {
      const resolved = resolveToken(token);
      return resolved === undefined ? token : String(resolved);
    });
  }
  if (Array.isArray(value)) return value.map((v) => resolveTemplateValue(v, ctx));
  if (value && typeof value === "object") {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) out[k] = resolveTemplateValue(v, ctx);
    return out;
  }
  return value;
}

async function enqueueNextJobs(opts: {
  dataRoot: string;
  projectId: string;
  jobId: string;
  input: Record<string, any>;
  output: Record<string, any>;
}) {
  const nextJobs = Array.isArray(opts.input.nextJobs)
    ? (opts.input.nextJobs as Array<{ type?: Job["type"]; input?: Record<string, any> }>)
    : [];
  if (nextJobs.length === 0) return [];
  const jobsDir = path.join(opts.dataRoot, "projects", opts.projectId, "jobs");
  await fs.mkdir(jobsDir, { recursive: true });

  const created: string[] = [];
  for (const next of nextJobs) {
    const type = next?.type;
    if (!type) continue;
    const input = resolveTemplateValue(next?.input ?? {}, {
      input: opts.input,
      output: opts.output ?? {},
      projectId: opts.projectId,
      jobId: opts.jobId,
    }) as Record<string, any>;
    const id = ulid();
    const createdAt = nowIso();
    const job: Job = {
      id,
      projectId: opts.projectId,
      type,
      status: "queued",
      createdAt,
      updatedAt: createdAt,
      input,
    };
    await writeJsonAtomic(path.join(jobsDir, `${id}.json`), job);
    created.push(id);
  }
  return created;
}

async function acquireProjectLock(opts: { dataRoot: string; projectId: string; ttlMs: number }) {
  const locksDir = path.join(opts.dataRoot, "runtime", "worker-locks");
  await fs.mkdir(locksDir, { recursive: true });
  const lockPath = path.join(locksDir, `${opts.projectId}.json`);
  const now = Date.now();
  try {
    const handle = await fs.open(lockPath, "wx");
    try {
      await handle.writeFile(JSON.stringify({ projectId: opts.projectId, ts: now }) + "\n", "utf8");
      return { acquired: true, lockPath };
    } finally {
      await handle.close();
    }
  } catch {
    try {
      const raw = await fs.readFile(lockPath, "utf8");
      const data = JSON.parse(raw) as { ts?: number };
      if (typeof data?.ts === "number" && now - data.ts < opts.ttlMs) return { acquired: false, lockPath };
    } catch {
      return { acquired: false, lockPath };
    }
    await fs.writeFile(lockPath, JSON.stringify({ projectId: opts.projectId, ts: now }) + "\n", "utf8");
    return { acquired: true, lockPath };
  }
}

async function releaseProjectLock(lockPath: string) {
  try {
    await fs.unlink(lockPath);
  } catch {
    // ignore
  }
}

async function processGenerateJob(opts: {
  repoRoot: string;
  dataRoot: string;
  comfyBaseUrl: string;
  job: Job;
  log?: JsonlLogger;
  jobFilePath?: string;
}) {
  const { job } = opts;
  const specId = String(job.input.specId ?? "");
  if (!specId) throw new Error("generate job missing input.specId");

  const specPath = path.join(opts.dataRoot, "projects", job.projectId, "specs", `${specId}.json`);
  if (!(await fileExists(specPath))) throw new Error(`Spec not found: ${specPath}`);
  const spec = await readJson<AssetSpec>(specPath);
  const resolvedLoras = resolveJobLoras(job.input.loras);
  const loraSelection =
    job.input.loraSelection && typeof job.input.loraSelection === "object" ? job.input.loraSelection : null;
  let promptCompileTrace: PromptTraceEntry[] | undefined;
  let promptPackageHash: string | undefined;
  let effectiveSeed: number | undefined;

  let workflow = job.input.workflow;
  if (!workflow) {
    const templateId = String(job.input.templateId ?? job.input.template ?? "txt2img");
    const templatePath = path.join(opts.repoRoot, "pipeline", "comfyui", "workflows", `${templateId}.json`);
    if (!(await fileExists(templatePath))) {
      throw new Error(`generate job missing input.workflow and template not found: ${templatePath}`);
    }

    workflow = await readJson<any>(templatePath);

    const bindingsPath = path.join(opts.repoRoot, "pipeline", "comfyui", "workflows", `${templateId}.bindings.json`);
    const bindings = (await fileExists(bindingsPath)) ? await readJson<any>(bindingsPath) : null;

    const checkpointName = String(job.input.checkpointName ?? "");
    if (!checkpointName) throw new Error("generate job missing input.checkpointName (ComfyUI ckpt_name)");

    const checkpointPath = path.join(opts.dataRoot, "projects", job.projectId, "checkpoints", `${checkpointName}.json`);
    const checkpoint = (await fileExists(checkpointPath)) ? await readJson<any>(checkpointPath) : null;

    const specPositive = String(spec.prompt?.positive ?? "");
    const specNegative = String(spec.prompt?.negative ?? "");
    const basePositive = String(checkpoint?.promptTemplates?.basePositive ?? "");
    const baseNegative = String(checkpoint?.promptTemplates?.baseNegative ?? "");
    const perAsset = checkpoint?.promptTemplates?.perAssetType?.[spec.assetType] ?? {};
    const perPositive = String(perAsset?.positive ?? "");
    const perNegative = String(perAsset?.negative ?? "");

    const renderTemplate = (template: string, fallback: string) => {
      if (!template) return fallback;
      if (template.includes("{specPrompt}")) return template.replace("{specPrompt}", fallback);
      return [template, fallback].filter(Boolean).join(", ");
    };

    const renderedPositive = renderTemplate(perPositive || basePositive, specPositive);
    const renderedNegative = renderTemplate(perNegative || baseNegative, specNegative);
    const compiledPrompt = await compilePromptPackage({
      dataRoot: opts.dataRoot,
      projectId: job.projectId,
      spec,
      checkpoint,
      fallbackPositive: renderedPositive,
      fallbackNegative: renderedNegative,
    });
    promptCompileTrace = compiledPrompt.trace;
    promptPackageHash = compiledPrompt.packageHash;

    const positive = String(job.input.positive ?? compiledPrompt.compiled.positive);
    const negative = String(job.input.negative ?? compiledPrompt.compiled.negative);
    const width = Number(
      job.input.width ??
        spec.generationParams?.width ??
        spec.generationParams?.w ??
        checkpoint?.defaultGenerationParams?.width ??
        512,
    );
    const height = Number(
      job.input.height ??
        spec.generationParams?.height ??
        spec.generationParams?.h ??
        checkpoint?.defaultGenerationParams?.height ??
        512,
    );
    const variants = Number(
      job.input.variants ?? spec.generationParams?.variants ?? checkpoint?.defaultGenerationParams?.variants ?? 4,
    );
    const fallbackSeed = Number(job.input.seed ?? Math.floor(Math.random() * 1_000_000_000));
    const seed = resolveSeed(spec, fallbackSeed);
    effectiveSeed = seed;
    const steps = Number(
      job.input.steps ?? spec.generationParams?.steps ?? checkpoint?.defaultGenerationParams?.steps ?? 20,
    );
    const cfg = Number(job.input.cfg ?? spec.generationParams?.cfg ?? checkpoint?.defaultGenerationParams?.cfg ?? 7);
    const sampler = String(
      job.input.sampler_name ?? job.input.sampler ?? checkpoint?.defaultGenerationParams?.sampler ?? "euler",
    );
    const scheduler = String(job.input.scheduler ?? checkpoint?.defaultGenerationParams?.scheduler ?? "normal");
    const vae = String(job.input.vae ?? spec.generationParams?.vae ?? checkpoint?.defaultGenerationParams?.vae ?? "");
    const clipSkipRaw =
      job.input.clip_skip ??
      job.input.clipSkip ??
      spec.generationParams?.clip_skip ??
      spec.generationParams?.clipSkip ??
      checkpoint?.defaultGenerationParams?.clip_skip ??
      checkpoint?.defaultGenerationParams?.clipSkip ??
      null;
    const clipSkipVal = clipSkipRaw === "" || clipSkipRaw === null ? null : Number(clipSkipRaw);

    const filenamePrefix = String(job.input.filenamePrefix ?? `assetgen/${job.projectId}/${spec.id}`);

    const apply = (key: string, value: any) => {
      if (!bindings?.[key]) return;
      const { node, input } = bindings[key];
      if (!workflow?.[node]?.inputs) return;
      workflow[node].inputs[input] = value;
    };

    apply("checkpoint", checkpointName);
    if (vae) {
      apply("vae", vae);
      if (bindings?.vae?.node) {
        apply("vae_target", [bindings.vae.node, 0]);
      }
    }
    if (clipSkipVal !== null && Number.isFinite(clipSkipVal)) {
      const stopAt = clipSkipVal > 0 ? -clipSkipVal : clipSkipVal;
      apply("clip_skip", stopAt);
    }
    const primaryLora = resolvedLoras[0];
    if (primaryLora) {
      apply("lora_name", primaryLora.loraName);
      apply("lora_strength_model", primaryLora.strengthModel);
      apply("lora_strength_clip", primaryLora.strengthClip);
    }
    if (resolvedLoras.length > 0) {
      const loraNodeId = bindings?.lora_name?.node ? String(bindings.lora_name.node) : "";
      if (loraNodeId && workflow?.[loraNodeId]?.inputs) {
        const chainResult = applyLoraChainToWorkflow({ workflow, baseNodeId: loraNodeId, loras: resolvedLoras });
        if (chainResult.applied > 0) {
          await opts.log?.info("lora_chain_applied", {
            applied: chainResult.applied,
            addedNodes: chainResult.addedNodes,
          });
        }
      } else {
        await opts.log?.warn("lora_binding_missing", {
          templateId,
          reason: "bindings.lora_name is not defined",
          loras: resolvedLoras.map((item) => ({
            loraId: item.loraId ?? null,
            releaseId: item.releaseId ?? null,
            loraName: item.loraName,
          })),
        });
      }
    }
    apply("positive", positive);
    apply("negative", negative);
    apply("width", width);
    apply("height", height);
    apply("batch_size", variants);
    apply("seed", seed);
    apply("steps", steps);
    apply("cfg", cfg);
    apply("sampler_name", sampler);
    apply("scheduler", scheduler);
    apply("filename_prefix", filenamePrefix);

    if (opts.jobFilePath) {
      await updateJobOutput(opts.jobFilePath, {
        promptCompileTrace,
        promptPackageHash,
        effectiveSeed,
      });
    }
  }

  const assetId = String(job.input.assetId ?? ulid());
  const assetVersionId = ulid();
  const sequenceId = typeof job.input.sequenceId === "string" ? String(job.input.sequenceId) : "";
  const frameIndexRaw = job.input.frameIndex ?? job.input.frame ?? null;
  const frameIndex = Number(frameIndexRaw);
  const frameCountRaw = job.input.frameCount ?? null;
  const frameCount = Number(frameCountRaw);
  const frameName = typeof job.input.frameName === "string" ? String(job.input.frameName) : "";
  const framePrompt = typeof job.input.framePrompt === "string" ? String(job.input.framePrompt) : "";

  await opts.log?.info("comfyui_submit", { templateId: job.input.templateId ?? job.input.template ?? "txt2img" });
  const { promptId } = await submitWorkflow({ baseUrl: opts.comfyBaseUrl, workflow });
  await opts.log?.info("comfyui_submitted", { promptId });
  if (opts.jobFilePath) {
    await updateJobOutput(opts.jobFilePath, { promptId });
  }

  // Poll history for outputs.
  const timeoutMs = Number(job.input.timeoutMs ?? 10 * 60 * 1000);
  const start = Date.now();
  let images: any[] = [];
  let lastPercent = -1;
  let lastProgressWrite = 0;
  while (Date.now() - start < timeoutMs) {
    const history = await getHistory({ baseUrl: opts.comfyBaseUrl, promptId });
    images = extractImagesFromHistory(history, promptId);
    const progress = extractComfyProgress(history, promptId);
    if (progress && opts.jobFilePath) {
      const now = Date.now();
      if (progress.percent !== lastPercent && now - lastProgressWrite > 750) {
        await updateJobOutput(opts.jobFilePath, { promptId, progress });
        await appendWorkerEvent(opts.dataRoot, {
          projectId: job.projectId,
          type: "job_progress",
          entityType: "job",
          entityId: job.id,
          idempotencyKey: `job:${job.id}:progress:${progress.percent}`,
          payload: { progressPercent: progress.percent, value: progress.value, max: progress.max, promptId },
        }).catch(() => undefined);
        lastPercent = progress.percent;
        lastProgressWrite = now;
      }
    }
    if (images.length > 0) break;
    await sleep(750);
  }
  if (images.length === 0) throw new Error(`Timed out waiting for ComfyUI outputs (promptId=${promptId}).`);
  await opts.log?.info("comfyui_outputs_ready", { count: images.length });

  const originalsDir = path.join(opts.dataRoot, "projects", job.projectId, "files", "images", assetId, "original");
  await fs.mkdir(originalsDir, { recursive: true });

  const variants: Asset["versions"][number]["variants"] = [];
  let i = 0;
  for (const img of images) {
    i++;
    const variantId = ulid();
    const data = await downloadImage({ baseUrl: opts.comfyBaseUrl, ref: img });
    const outAbs = path.join(originalsDir, `${variantId}.png`);
    await fs.writeFile(outAbs, data);
    variants.push({ id: variantId, originalPath: relToData(opts.dataRoot, outAbs), status: "candidate" });
  }

  const existing = await loadAssetIfExists(opts.dataRoot, job.projectId, assetId);
  const base: Asset =
    existing ??
    ({
      id: assetId,
      projectId: job.projectId,
      specId: spec.id,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      versions: [],
    } satisfies Asset);

  base.updatedAt = nowIso();
  const promptDriftEvidence = await buildPromptDriftEvidence({
    dataRoot: opts.dataRoot,
    projectId: job.projectId,
    specId: spec.id,
    entityId: spec.entityLink?.entityId,
    promptPackageHash,
  });
  const validatorReport = await buildValidatorReport({
    dataRoot: opts.dataRoot,
    projectId: job.projectId,
    spec,
    variantImagePaths: variants.map((variant) => variant.originalPath),
    promptCompileTrace,
    promptPackageHash,
    promptDriftEvidence,
  });
  base.versions.push({
    id: assetVersionId,
    createdAt: nowIso(),
    status: "review",
    generation: {
      promptId,
      spec: { id: spec.id, title: spec.title, assetType: spec.assetType },
      workflow: job.input.workflow,
      // Keeping prompt examples here for traceability; the true resolved prompt should also be stored once we add templates.
      promptExample: { positive: spec.prompt.positive, negative: spec.prompt.negative },
      promptCompileTrace,
      promptPackageHash,
      seedPolicy: spec.seedPolicy ?? { mode: "random_recorded" },
      effectiveSeed,
      entityLink: spec.entityLink ?? null,
      ...(promptDriftEvidence ? { promptDriftEvidence } : {}),
      validators: validatorReport.checks,
      validatorReport: validatorReport.summary,
      ...(resolvedLoras.length > 0
        ? {
            loras: resolvedLoras.map((item) => ({
              loraId: item.loraId ?? null,
              releaseId: item.releaseId ?? null,
              loraName: item.loraName,
              strengthModel: item.strengthModel,
              strengthClip: item.strengthClip,
            })),
          }
        : {}),
      ...(loraSelection ? { loraSelection } : {}),
      ...(loraSelection && (loraSelection as any).resolvedStackSnapshot
        ? { resolvedModelStack: (loraSelection as any).resolvedStackSnapshot }
        : {}),
      ...(loraSelection && (loraSelection as any).resolverExplanation
        ? { resolverExplanation: (loraSelection as any).resolverExplanation }
        : {}),
      ...(sequenceId ? { sequenceId } : {}),
      ...(Number.isFinite(frameIndex) ? { frameIndex } : {}),
      ...(Number.isFinite(frameCount) ? { frameCount } : {}),
      ...(frameName ? { frameName } : {}),
      ...(framePrompt ? { framePrompt } : {}),
    },
    variants,
  });

  await upsertAsset(opts.dataRoot, job.projectId, base);

  // Write a baseline-validation-result file conforming to the schema so that
  // Phase 8 services (improvementRuns, trends, backtestAndGap) can read from
  // the baseline-validation-results/ directory.
  {
    const statusMap: Record<string, string> = { pass: "pass", warn: "uncertain", fail: "fail" };
    const schemaChecks = Object.entries(validatorReport.checks).map(([checkId, result]) => ({
      id: checkId,
      status: result.pass ? "pass" : "fail",
      score: result.confidence,
      message: result.reason,
    }));
    const routingDecisionValue = resolveRoutingDecision({
      summaryStatus: validatorReport.summary.status as "pass" | "warn" | "fail",
    });
    const validationResult = {
      id: `vr_${assetVersionId}`,
      projectId: job.projectId,
      assetId,
      versionId: assetVersionId,
      specId: spec.id,
      assetType: spec.assetType ?? "",
      status: statusMap[validatorReport.summary.status] ?? "uncertain",
      checks: schemaChecks,
      decision: routingDecisionValue.decision,
      createdAt: nowIso(),
    };
    const vrDir = path.join(opts.dataRoot, "projects", job.projectId, "baseline-validation-results");
    await fs.mkdir(vrDir, { recursive: true });
    await writeJsonAtomic(path.join(vrDir, `${validationResult.id}.json`), validationResult);
  }

  await opts.log?.info("asset_written", { assetId, assetVersionId, variants: variants.length });

  const wantsTransparent = spec.output?.background === "transparent_required";
  const autoBgRemove =
    typeof spec.generationParams?.autoBgRemove === "boolean"
      ? Boolean(spec.generationParams.autoBgRemove)
      : wantsTransparent;
  if (autoBgRemove && variants.length > 0) {
    const nextJobs = variants.map((variant) => ({
      type: "bg_remove" as const,
      input: { originalPath: variant.originalPath },
    }));
    const chained = await enqueueNextJobs({
      dataRoot: opts.dataRoot,
      projectId: job.projectId,
      jobId: job.id,
      input: { nextJobs },
      output: {},
    });
    if (chained.length > 0) {
      await opts.log?.info("auto_bg_remove_queued", { count: chained.length });
    }
  }

  const evalMeta = job.input.eval && typeof job.input.eval === "object" ? job.input.eval : null;
  if (evalMeta?.evalId) {
    const evalId = String(evalMeta.evalId);
    const prompt = String(evalMeta.prompt ?? spec.prompt.positive ?? "");
    const evalPath = path.join(opts.dataRoot, "projects", job.projectId, "evals", `${evalId}.json`);
    if (await fileExists(evalPath)) {
      try {
        const evalRecord = await readJson<any>(evalPath);
        const outputs = Array.isArray(evalRecord.outputs) ? evalRecord.outputs : [];
        outputs.push({
          prompt,
          images: variants.map((v) => v.originalPath),
          assetId,
          assetVersionId,
        });
        evalRecord.outputs = outputs;
        evalRecord.updatedAt = nowIso();
        const totalPrompts = Array.isArray(evalRecord.prompts) ? evalRecord.prompts.length : 0;
        if (totalPrompts > 0 && outputs.length >= totalPrompts) {
          evalRecord.status = "complete";
        } else if (!evalRecord.status || evalRecord.status === "pending") {
          evalRecord.status = "running";
        }
        await writeJsonAtomic(evalPath, evalRecord);
        if (evalRecord.autoCleanup && evalRecord.status === "complete") {
          const specsDir = path.join(opts.dataRoot, "projects", job.projectId, "specs");
          try {
            const entries = await fs.readdir(specsDir, { withFileTypes: true });
            for (const entry of entries) {
              if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
              const specPath = path.join(specsDir, entry.name);
              try {
                const spec = await readJson<any>(specPath);
                if (spec?.id && typeof spec.id === "string" && spec.id.startsWith(`eval_${evalId}_`)) {
                  await fs.unlink(specPath);
                }
              } catch {
                // ignore
              }
            }
            await opts.log?.info("eval_auto_cleanup", { evalId });
          } catch (err) {
            const error = err as any;
            await opts.log?.warn("eval_auto_cleanup_failed", { evalId, error: error?.message ?? String(error) });
          }
        }
      } catch (err) {
        const error = err as any;
        await opts.log?.error("eval_update_failed", {
          evalId,
          error: { message: error?.message ?? String(error), stack: error?.stack },
        });
      }
    } else {
      await opts.log?.warn("eval_missing", { evalId, evalPath });
    }
  }

  return {
    assetId,
    assetVersionId,
    variantIds: variants.map((v) => v.id),
    originalPath: variants[0]?.originalPath,
    originalPaths: variants.map((v) => v.originalPath),
    originalsDir: relToData(opts.dataRoot, originalsDir),
  };
}

async function processBgRemoveJob(opts: { repoRoot: string; dataRoot: string; job: Job; log?: JsonlLogger }) {
  const { job } = opts;
  const originalPathRel = String(job.input.originalPath ?? "");
  if (!originalPathRel) throw new Error("bg_remove job missing input.originalPath (data-relative path)");
  const originalAbs = path.join(opts.dataRoot, originalPathRel);
  if (!(await fileExists(originalAbs))) throw new Error(`Original image not found: ${originalAbs}`);

  const outputRel = String(job.input.alphaPath ?? "");
  const alphaAbs = outputRel
    ? path.join(opts.dataRoot, outputRel)
    : originalAbs.replace(/\/original\//g, "/alpha/").replace(/\\original\\/g, "\\alpha\\");
  await fs.mkdir(path.dirname(alphaAbs), { recursive: true });

  const threshold = typeof job.input.threshold === "number" ? Number(job.input.threshold) : undefined;
  const feather = typeof job.input.feather === "number" ? Number(job.input.feather) : undefined;
  const erode = typeof job.input.erode === "number" ? Number(job.input.erode) : undefined;

  await opts.log?.info("bg_remove_start", {
    originalPath: originalPathRel,
    alphaPath: relToData(opts.dataRoot, alphaAbs),
    params: { threshold, feather, erode },
  });
  await removeBackground({
    repoRoot: opts.repoRoot,
    inputPath: originalAbs,
    outputPath: alphaAbs,
    threshold,
    feather,
    erode,
    log: opts.log,
  });
  await opts.log?.info("bg_remove_done", { alphaPath: relToData(opts.dataRoot, alphaAbs) });

  const assetId = job.input.assetId ? String(job.input.assetId) : "";
  const versionId = job.input.versionId ? String(job.input.versionId) : "";
  const variantId = job.input.variantId ? String(job.input.variantId) : "";
  if (assetId && versionId && variantId) {
    const asset = await loadAssetIfExists(opts.dataRoot, job.projectId, assetId);
    if (asset) {
      const version = asset.versions.find((v) => v.id === versionId);
      const variant = version?.variants.find((v) => v.id === variantId);
      if (version && variant) {
        variant.alphaPath = relToData(opts.dataRoot, alphaAbs);
        variant.processing = {
          ...(variant.processing ?? {}),
          bg_remove: { threshold, feather, erode },
        };
        asset.updatedAt = nowIso();
        await upsertAsset(opts.dataRoot, job.projectId, asset);
      }
    }
  }

  return { alphaPath: relToData(opts.dataRoot, alphaAbs), params: { threshold, feather, erode } };
}

async function processAtlasPackJob(opts: { dataRoot: string; job: Job; log?: JsonlLogger }) {
  const { job } = opts;
  const framePaths = job.input.framePaths as unknown;
  if (!Array.isArray(framePaths) || framePaths.length === 0)
    throw new Error("atlas_pack job missing input.framePaths[] (data-relative)");

  const atlasId = String(job.input.atlasId ?? ulid());
  const atlasDir = path.join(opts.dataRoot, "projects", job.projectId, "files", "atlases", atlasId);
  const atlasPng = path.join(atlasDir, "atlas.png");
  const atlasJson = path.join(atlasDir, "atlas.json");
  const padding = Number(job.input.padding ?? 2);
  const maxSize = Number(job.input.maxSize ?? 2048);
  const powerOfTwo = Boolean(job.input.powerOfTwo ?? false);
  const trim = Boolean(job.input.trim ?? false);
  const extrude = Number(job.input.extrude ?? 0);
  const sort = typeof job.input.sort === "string" ? String(job.input.sort) : undefined;

  const frames = framePaths.map((p: any, idx: number) => ({
    key: String(p.key ?? `frame_${idx}`),
    absPath: path.join(opts.dataRoot, String(p.path ?? p)),
  }));

  await opts.log?.info("atlas_pack_start", {
    atlasId,
    frames: frames.length,
    padding,
    maxSize,
    powerOfTwo,
    trim,
    extrude,
    sort,
  });
  const packed = await packAtlas({
    frames,
    atlasAbsPngPath: atlasPng,
    atlasAbsJsonPath: atlasJson,
    padding,
    maxSize,
    powerOfTwo,
    trim,
    extrude,
    sort: (sort as any) ?? "area",
  });
  await opts.log?.info("atlas_pack_done", {
    atlasId,
    frames: packed.frames.length,
    atlasImagePath: relToData(opts.dataRoot, atlasPng),
  });

  // Write engine-agnostic atlas record.
  const atlasRecord = {
    id: atlasId,
    projectId: job.projectId,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    imagePath: relToData(opts.dataRoot, atlasPng),
    packSettings: { padding, maxSize, powerOfTwo, trim, extrude, sort: sort ?? "area" },
    frames: packed.frames.map((f) => ({
      id: f.key,
      sourcePath: relToData(opts.dataRoot, f.sourcePath),
      rect: f.rect,
      sourceSize: { w: f.rect.w, h: f.rect.h },
    })),
  };

  await writeJsonAtomic(path.join(opts.dataRoot, "projects", job.projectId, "atlases", `${atlasId}.json`), atlasRecord);

  return {
    atlasId,
    atlasImagePath: relToData(opts.dataRoot, atlasPng),
    atlasDataPath: relToData(opts.dataRoot, atlasJson),
  };
}

async function processExportJob(opts: { dataRoot: string; job: Job; log?: JsonlLogger }) {
  const { job } = opts;
  const exportId = String(job.input.exportId ?? ulid());
  const kitRoot = path.join(opts.dataRoot, "projects", job.projectId, "files", "exports", exportId, "pixi-kit");
  const assetsDir = path.join(kitRoot, "assets");
  const imagesDir = path.join(assetsDir, "images");
  const atlasesDir = path.join(assetsDir, "atlases");
  const srcDir = path.join(kitRoot, "src");

  await fs.mkdir(imagesDir, { recursive: true });
  await fs.mkdir(atlasesDir, { recursive: true });
  await fs.mkdir(srcDir, { recursive: true });

  const assetIds = Array.isArray(job.input.assetIds) ? (job.input.assetIds as string[]) : [];
  const atlasIds = Array.isArray(job.input.atlasIds) ? (job.input.atlasIds as string[]) : [];

  const profileId = typeof job.input.profileId === "string" ? String(job.input.profileId) : "";
  const profileSnapshot =
    typeof job.input.profileSnapshot === "object" && job.input.profileSnapshot
      ? (job.input.profileSnapshot as ExportProfile)
      : null;
  const profileFromDisk = async () => {
    if (!profileId) return null;
    const filePath = path.join(opts.dataRoot, "projects", job.projectId, "export-profiles", `${profileId}.json`);
    if (!(await fileExists(filePath))) throw new Error(`export profile not found: ${profileId}`);
    return readJson<ExportProfile>(filePath);
  };
  const profile = profileSnapshot ?? (await profileFromDisk());
  const profileOptions = profile?.options ?? {};
  const scale = typeof profileOptions.scale === "number" && profileOptions.scale > 0 ? Number(profileOptions.scale) : 1;
  const trim = Boolean(profileOptions.trim ?? false);
  const padding =
    typeof profileOptions.padding === "number" && profileOptions.padding > 0 ? Number(profileOptions.padding) : 0;
  const namePrefix = typeof profileOptions.namePrefix === "string" ? profileOptions.namePrefix : "";
  const nameSuffix = typeof profileOptions.nameSuffix === "string" ? profileOptions.nameSuffix : "";

  const images: Array<{ name: string; assetId: string; path: string; tags?: string[] }> = [];
  const atlases: Array<{ id: string; imagePath: string; dataPath: string }> = [];

  await opts.log?.info("export_start", { exportId, assets: assetIds.length, atlases: atlasIds.length });
  const usedNames = new Map<string, number>();
  const slugify = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 48) || "asset";

  const uniqueName = (base: string) => {
    const key = slugify(`${namePrefix}${base}${nameSuffix}`);
    const n = usedNames.get(key) ?? 0;
    usedNames.set(key, n + 1);
    return n === 0 ? key : `${key}_${n + 1}`;
  };

  const pickVariantPath = (asset: Asset) => {
    const approved = asset.versions.filter((v) => v.status === "approved");
    const version = approved.length ? approved[approved.length - 1] : asset.versions[asset.versions.length - 1];
    if (!version) return null;

    const primary = version.primaryVariantId ? version.variants.find((v) => v.id === version.primaryVariantId) : null;
    const selected = version.variants.find((v) => v.status === "selected") ?? null;
    const candidate = version.variants[0] ?? null;
    const variant = primary ?? selected ?? candidate;
    if (!variant) return null;
    return { versionId: version.id, variant };
  };

  for (const assetId of assetIds) {
    const assetPath = path.join(opts.dataRoot, "projects", job.projectId, "assets", `${assetId}.json`);
    if (!(await fileExists(assetPath))) continue;
    const asset = await readJson<Asset>(assetPath);

    const pick = pickVariantPath(asset);
    if (!pick) continue;
    const sourceRel = pick.variant.alphaPath ?? pick.variant.originalPath;
    const sourceAbs = path.join(opts.dataRoot, sourceRel);
    if (!(await fileExists(sourceAbs))) continue;

    const name = uniqueName(assetId);
    const destAbs = path.join(imagesDir, `${name}.png`);
    if (scale !== 1 || trim || padding > 0) {
      let pipeline = sharp(sourceAbs);
      if (trim) pipeline = pipeline.trim();
      if (scale !== 1) {
        const meta = await pipeline.metadata();
        const targetW = Math.max(1, Math.round((meta.width ?? 1) * scale));
        const targetH = Math.max(1, Math.round((meta.height ?? 1) * scale));
        pipeline = pipeline.resize(targetW, targetH, { kernel: "lanczos3" });
      }
      if (padding > 0) {
        pipeline = pipeline.extend({
          top: padding,
          bottom: padding,
          left: padding,
          right: padding,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        });
      }
      await pipeline.png().toFile(destAbs);
    } else {
      await fs.copyFile(sourceAbs, destAbs);
    }

    images.push({ name, assetId, path: `assets/images/${name}.png`, tags: pick.variant.tags ?? [] });
  }

  for (const atlasId of atlasIds) {
    const srcDirAbs = path.join(opts.dataRoot, "projects", job.projectId, "files", "atlases", atlasId);
    const srcPng = path.join(srcDirAbs, "atlas.png");
    const srcJson = path.join(srcDirAbs, "atlas.json");
    if (!(await fileExists(srcPng)) || !(await fileExists(srcJson))) continue;

    const atlasName = uniqueName(atlasId);
    const destPng = path.join(atlasesDir, `${atlasName}.png`);
    const destJson = path.join(atlasesDir, `${atlasName}.json`);

    if (scale !== 1) {
      const atlasImage = sharp(srcPng);
      const meta = await atlasImage.metadata();
      const targetW = Math.max(1, Math.round((meta.width ?? 1) * scale));
      const targetH = Math.max(1, Math.round((meta.height ?? 1) * scale));
      await atlasImage.resize(targetW, targetH, { kernel: "lanczos3" }).png().toFile(destPng);
    } else {
      await fs.copyFile(srcPng, destPng);
    }

    const atlasData = await readJson<any>(srcJson);
    atlasData.meta = atlasData.meta ?? {};
    atlasData.meta.image = path.basename(destPng);
    if (scale !== 1 && atlasData?.frames) {
      for (const frame of Object.values<any>(atlasData.frames)) {
        const scaleRect = (rect: { x: number; y: number; w: number; h: number }) => ({
          x: Math.round(rect.x * scale),
          y: Math.round(rect.y * scale),
          w: Math.max(1, Math.round(rect.w * scale)),
          h: Math.max(1, Math.round(rect.h * scale)),
        });
        if (frame.frame) frame.frame = scaleRect(frame.frame);
        if (frame.spriteSourceSize) frame.spriteSourceSize = scaleRect(frame.spriteSourceSize);
        if (frame.sourceSize) {
          frame.sourceSize = {
            w: Math.max(1, Math.round(frame.sourceSize.w * scale)),
            h: Math.max(1, Math.round(frame.sourceSize.h * scale)),
          };
        }
      }
    }
    await fs.writeFile(destJson, JSON.stringify(atlasData, null, 2) + "\n", "utf8");

    atlases.push({
      id: atlasId,
      imagePath: `assets/atlases/${atlasName}.png`,
      dataPath: `assets/atlases/${atlasName}.json`,
    });
  }

  const manifest = {
    id: exportId,
    projectId: job.projectId,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    version: "0.2",
    atlases,
    images,
    animations: Array.isArray(job.input.animations) ? job.input.animations : [],
    ui: Array.isArray(job.input.ui) ? job.input.ui : [],
  };

  const manifestAbs = path.join(kitRoot, "manifest.json");
  await fs.writeFile(manifestAbs, JSON.stringify(manifest, null, 2) + "\n", "utf8");

  const kitPackageJson = {
    name: `assetgenerator-pixi-kit-${job.projectId}`,
    private: true,
    version: "0.0.0",
    type: "module",
    main: "./src/index.ts",
  };
  await fs.writeFile(path.join(kitRoot, "package.json"), JSON.stringify(kitPackageJson, null, 2) + "\n", "utf8");

  const kitIndexTs = `export { default as manifest } from "../manifest.json";\nexport * from "./runtime";\nexport * from "./types";\n`;
  await fs.writeFile(path.join(srcDir, "index.ts"), kitIndexTs, "utf8");

  const kitTypesTs = `import manifest from "../manifest.json";\n\nexport type KitManifest = typeof manifest;\nexport type KitAtlas = KitManifest["atlases"][number];\nexport type KitImage = KitManifest["images"][number];\nexport type KitAnimation = KitManifest["animations"][number];\nexport type KitUi = KitManifest["ui"][number];\n`;
  await fs.writeFile(path.join(srcDir, "types.ts"), kitTypesTs, "utf8");

  const kitRuntimeTs = `import { AnimatedSprite, Assets, Sprite, Texture } from "pixi.js";\nimport manifest from "../manifest.json";\n\nexport async function loadKit() {\n  const atlasLoads = manifest.atlases.map((atlas) => Assets.load(atlas.dataPath));\n  const imageLoads = manifest.images.map((img) => Assets.load(img.path));\n  await Promise.all([...atlasLoads, ...imageLoads]);\n  return manifest;\n}\n\nexport function createSprite(name: string) {\n  const entry = manifest.images.find((img) => img.name === name);\n  if (!entry) throw new Error(\`Unknown sprite: \${name}\`);\n  return Sprite.from(entry.path);\n}\n\nexport function createAnimation(name: string) {\n  const entry = manifest.animations.find((anim) => anim.name === name);\n  if (!entry) throw new Error(\`Unknown animation: \${name}\`);\n  const textures = entry.frames.map((frame) => Texture.from(frame));\n  const sprite = new AnimatedSprite(textures);\n  sprite.animationSpeed = entry.fps / 60;\n  sprite.loop = entry.loop;\n  sprite.play();\n  return sprite;\n}\n\nexport function createUiElement(name: string) {\n  const entry = manifest.ui.find((ui) => ui.name === name);\n  if (!entry) throw new Error(\`Unknown UI element: \${name}\`);\n  const [firstKey] = Object.values(entry.states);\n  const sprite = new Sprite(firstKey ? Texture.from(firstKey) : Texture.EMPTY);\n  return {\n    type: entry.type,\n    sprite,\n    setState: (state: string) => {\n      const key = entry.states[state];\n      if (!key) return;\n      sprite.texture = Texture.from(key);\n    }\n  };\n}\n`;
  await fs.writeFile(path.join(srcDir, "runtime.ts"), kitRuntimeTs, "utf8");

  const exportRecord = {
    id: exportId,
    projectId: job.projectId,
    type: "pixi_kit",
    status: "succeeded",
    createdAt: nowIso(),
    updatedAt: nowIso(),
    input: {
      assetIds,
      atlasIds,
      profileId: (profile?.id ?? profileId) || undefined,
      profileSnapshot: profile
        ? { id: profile.id, name: profile.name, type: profile.type, options: profile.options }
        : undefined,
    },
    output: { exportPath: relToData(opts.dataRoot, kitRoot), manifestPath: relToData(opts.dataRoot, manifestAbs) },
  };

  await writeJsonAtomic(
    path.join(opts.dataRoot, "projects", job.projectId, "exports", `${exportId}.json`),
    exportRecord,
  );

  await opts.log?.info("export_done", { exportId, manifestPath: exportRecord.output.manifestPath });
  return exportRecord.output;
}

async function runOnce(opts: {
  repoRoot: string;
  dataRoot: string;
  comfyBaseUrl: string;
  schemas: SchemaRegistry;
  runtimeLog: JsonlLogger;
}) {
  const projectsDir = path.join(opts.dataRoot, "projects");
  const projectsRoot = projectsDir;
  let projects: string[] = [];
  try {
    const entries = await fs.readdir(projectsDir, { withFileTypes: true });
    projects = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return;
  }

  const perProjectConcurrency = Number(process.env.ASSETGEN_WORKER_PROJECT_CONCURRENCY ?? 1);
  const lockTtlMs = Number(process.env.ASSETGEN_WORKER_PROJECT_LOCK_TTL_MS ?? 30_000);

  for (const projectId of projects) {
    const projectDir = path.join(projectsDir, projectId);
    const lock = await acquireProjectLock({ dataRoot: opts.dataRoot, projectId, ttlMs: lockTtlMs });
    if (!lock.acquired) continue;

    // Stuck-run recovery: reclaim orphaned "running" jobs and automation runs
    // Load project retry policy to get configurable stuck threshold
    const { policy: projectRetryPolicy } = await loadProjectRetryPolicy(opts.dataRoot, projectId);
    const stuckThresholdMs = projectRetryPolicy.stuckRunThresholdMs;
    const stuckJobs = await recoverStuckJobs(projectDir, opts.runtimeLog, stuckThresholdMs);
    const stuckRuns = await recoverStuckAutomationRuns(projectDir, opts.runtimeLog, stuckThresholdMs);
    if (stuckJobs > 0 || stuckRuns > 0) {
      await opts.runtimeLog.info("stuck_recovery_complete", { projectId, stuckJobs, stuckRuns });
    }

    const queued = await listQueuedJobs(projectDir);
    const batch = queued.slice(0, Math.max(1, perProjectConcurrency));
    await Promise.all(
      batch.map(async ({ filePath, job }) => {
        const logAbs = path.join(opts.dataRoot, "projects", job.projectId, "files", "logs", "jobs", `${job.id}.jsonl`);
        const logRel = relToData(opts.dataRoot, logAbs);
        const log = await createJsonlLogger({
          absPath: logAbs,
          component: "worker",
          baseFields: { projectId: job.projectId, jobId: job.id },
        });

        const latest = await readJson<Job>(filePath);
        if (latest.status !== "queued") {
          await log.info("job_skip", { reason: "status_not_queued", status: latest.status });
          return;
        }

        const updatedAt = nowIso();
        latest.status = "running";
        latest.updatedAt = updatedAt;
        latest.logPath = latest.logPath ?? logRel;
        latest.attempt = latest.attempt ?? 1;
        await writeJsonAtomic(filePath, latest);
        await upsertJobIndexEntry({
          projectsRoot,
          projectId: latest.projectId,
          entry: { id: latest.id, type: latest.type, status: latest.status, createdAt: latest.createdAt, updatedAt: latest.updatedAt },
        }).catch(() => undefined);
        await appendWorkerEvent(opts.dataRoot, {
          projectId: latest.projectId,
          type: "job_running",
          entityType: "job",
          entityId: latest.id,
          idempotencyKey: `job:${latest.id}:running:attempt${latest.attempt ?? 1}`,
          payload: { jobType: latest.type, status: latest.status, attempt: latest.attempt ?? 1 },
        }).catch(() => undefined);

        try {
          await log.info("job_start", { type: latest.type, input: summarizeJobInput(latest.input) });
          let output: any = {};
          if (latest.type === "generate")
            output = await processGenerateJob({
              repoRoot: opts.repoRoot,
              dataRoot: opts.dataRoot,
              comfyBaseUrl: opts.comfyBaseUrl,
              job: latest,
              log,
              jobFilePath: filePath,
            });
          else if (latest.type === "bg_remove")
            output = await processBgRemoveJob({ repoRoot: opts.repoRoot, dataRoot: opts.dataRoot, job: latest, log });
          else if (latest.type === "atlas_pack")
            output = await processAtlasPackJob({ dataRoot: opts.dataRoot, job: latest, log });
          else if (latest.type === "export")
            output = await processExportJob({ dataRoot: opts.dataRoot, job: latest, log });
          else throw new Error(`Unsupported job.type=${latest.type}`);

          const updated = await readJson<Job>(filePath);
          if (updated.status === "canceled") {
            updated.updatedAt = nowIso();
            updated.output = output;
            await writeJsonAtomic(filePath, updated);
            await upsertJobIndexEntry({
              projectsRoot,
              projectId: updated.projectId,
              entry: {
                id: updated.id,
                type: updated.type,
                status: updated.status,
                createdAt: updated.createdAt,
                updatedAt: updated.updatedAt,
              },
            }).catch(() => undefined);
            await appendWorkerEvent(opts.dataRoot, {
              projectId: updated.projectId,
              type: "job_canceled",
              entityType: "job",
              entityId: updated.id,
              idempotencyKey: `job:${updated.id}:canceled`,
              payload: { status: updated.status },
            }).catch(() => undefined);
            await log.info("job_canceled_after_run", { output });
            return;
          }

          updated.status = "succeeded";
          updated.updatedAt = nowIso();
          updated.output = { ...(updated.output ?? {}), ...output };
          await writeJsonAtomic(filePath, updated);
          await upsertJobIndexEntry({
            projectsRoot,
            projectId: updated.projectId,
            entry: {
              id: updated.id,
              type: updated.type,
              status: updated.status,
              createdAt: updated.createdAt,
              updatedAt: updated.updatedAt,
            },
          }).catch(() => undefined);
          await appendWorkerEvent(opts.dataRoot, {
            projectId: updated.projectId,
            type: "job_succeeded",
            entityType: "job",
            entityId: updated.id,
            idempotencyKey: `job:${updated.id}:succeeded:${updated.updatedAt}`,
            payload: { status: updated.status, output },
          }).catch(() => undefined);
          const chained = await enqueueNextJobs({
            dataRoot: opts.dataRoot,
            projectId: updated.projectId,
            jobId: updated.id,
            input: updated.input,
            output,
          });
          await log.info("job_succeeded", { output, chainedJobs: chained });
        } catch (err: any) {
          const updated = await readJson<Job>(filePath);
          if (updated.status !== "canceled") {
            const errClass = classifyError(err);
            const { policy: retryPolicy, raw: rawProjectPolicy } = await loadProjectRetryPolicy(opts.dataRoot, updated.projectId);
            const effectivePolicy = resolveRetryPolicyForJob(retryPolicy, rawProjectPolicy, updated.type);
            const currentAttempt = updated.attempt ?? 1;
            const canRetry =
              effectivePolicy.retryOn.includes(errClass) && currentAttempt < effectivePolicy.maxAttempts;

            // Build retry history entry
            const historyEntry: RetryHistoryEntry = {
              attempt: currentAttempt,
              error: err?.message ?? String(err),
              errorClass: errClass,
              ts: nowIso(),
            };
            const retryHistory = [...(updated.retryHistory ?? []), historyEntry];

            if (canRetry) {
              // Re-queue for retry with backoff
              const backoffMs = computeBackoffMs(effectivePolicy, currentAttempt);
              updated.status = "queued";
              updated.updatedAt = nowIso();
              updated.error = err?.message ?? String(err);
              updated.errorClass = errClass;
              updated.attempt = currentAttempt + 1;
              updated.maxAttempts = effectivePolicy.maxAttempts;
              updated.nextRetryAt = new Date(Date.now() + backoffMs).toISOString();
              updated.retryHistory = retryHistory;
              await writeJsonAtomic(filePath, updated);
              await upsertJobIndexEntry({
                projectsRoot,
                projectId: updated.projectId,
                entry: {
                  id: updated.id,
                  type: updated.type,
                  status: updated.status,
                  createdAt: updated.createdAt,
                  updatedAt: updated.updatedAt,
                },
              }).catch(() => undefined);
              await appendWorkerEvent(opts.dataRoot, {
                projectId: updated.projectId,
                type: "job_retrying",
                entityType: "job",
                entityId: updated.id,
                idempotencyKey: `job:${updated.id}:retry:${currentAttempt}`,
                payload: {
                  attempt: currentAttempt,
                  nextAttempt: currentAttempt + 1,
                  maxAttempts: effectivePolicy.maxAttempts,
                  errorClass: errClass,
                  error: err?.message ?? String(err),
                  backoffMs,
                  nextRetryAt: updated.nextRetryAt,
                },
              }).catch(() => undefined);
              await log.info("job_retrying", {
                attempt: currentAttempt,
                nextAttempt: currentAttempt + 1,
                errorClass: errClass,
                backoffMs,
                error: { message: err?.message ?? String(err) },
              });
            } else {
              // Retries exhausted or non-retryable → fail + escalate
              updated.status = "failed";
              updated.updatedAt = nowIso();
              updated.error = err?.message ?? String(err);
              updated.errorClass = errClass;
              updated.retryHistory = retryHistory;
              updated.escalatedAt = nowIso();
              updated.escalationTarget = effectivePolicy.escalateTo;
              await writeJsonAtomic(filePath, updated);
              await upsertJobIndexEntry({
                projectsRoot,
                projectId: updated.projectId,
                entry: {
                  id: updated.id,
                  type: updated.type,
                  status: updated.status,
                  createdAt: updated.createdAt,
                  updatedAt: updated.updatedAt,
                },
              }).catch(() => undefined);
              await appendWorkerEvent(opts.dataRoot, {
                projectId: updated.projectId,
                type: "job_failed",
                entityType: "job",
                entityId: updated.id,
                idempotencyKey: `job:${updated.id}:failed:${updated.updatedAt}`,
                payload: { status: updated.status, error: updated.error ?? null, errorClass: errClass },
              }).catch(() => undefined);
              // Emit escalation event
              await appendWorkerEvent(opts.dataRoot, {
                projectId: updated.projectId,
                type: "job_escalated",
                entityType: "job",
                entityId: updated.id,
                idempotencyKey: `job:${updated.id}:escalated:${updated.updatedAt}`,
                payload: {
                  escalationTarget: effectivePolicy.escalateTo,
                  errorClass: errClass,
                  error: updated.error ?? null,
                  attempt: currentAttempt,
                  maxAttempts: effectivePolicy.maxAttempts,
                  retryHistory,
                  reasonCode: effectivePolicy.retryOn.includes(errClass) ? "retries_exhausted" : `non_retryable:${errClass}`,
                },
              }).catch(() => undefined);
              await log.error("job_failed_escalated", {
                errorClass: errClass,
                escalationTarget: effectivePolicy.escalateTo,
                attempt: currentAttempt,
                maxAttempts: effectivePolicy.maxAttempts,
                error: { message: err?.message ?? String(err), stack: err?.stack },
              });
            }
          } else {
            await log.error("job_failed", { error: { message: err?.message ?? String(err), stack: err?.stack } });
          }
        }
      }),
    );

    const queuedRuns = await listQueuedAutomationRuns(projectDir);
    for (const queuedRun of queuedRuns) {
      await executeAutomationRun({
        projectsRoot: path.join(opts.dataRoot, "projects"),
        schemas: opts.schemas,
        projectId,
        runId: queuedRun.runId,
      }).catch(async (err: any) => {
        await opts.runtimeLog.error("automation_run_execute_failed", {
          projectId,
          runId: queuedRun.runId,
          error: { message: err?.message ?? String(err), stack: err?.stack },
        });
      });
    }
    await releaseProjectLock(lock.lockPath);
  }
}

async function main() {
  const repoRoot = repoRootFromHere(import.meta.url);
  const local = await loadLocalConfig(repoPath(repoRoot, "config", "local.json"));
  const dataRoot = local?.dataRoot ? path.resolve(local.dataRoot) : repoPath(repoRoot, "data");
  const comfyBaseUrlRaw = local?.comfyui?.baseUrl ?? "http://127.0.0.1:8188";
  const comfyBaseUrl = /^[a-zA-Z]+:\/\//.test(comfyBaseUrlRaw) ? comfyBaseUrlRaw : `http://${comfyBaseUrlRaw}`;

  const runtimeLog = await createJsonlLogger({
    absPath: path.join(dataRoot, "runtime", "logs", "worker.jsonl"),
    component: "worker",
  });
  await runtimeLog.info("startup", { dataRoot, comfyBaseUrl: comfyBaseUrlRaw });

  process.on("unhandledRejection", (reason) => {
    void runtimeLog.error("unhandled_rejection", { reason: String(reason) });
  });
  process.on("uncaughtException", (err) => {
    void runtimeLog
      .error("uncaught_exception", { error: { message: err?.message ?? String(err), stack: (err as any)?.stack } })
      .finally(() => {
        process.exit(1);
      });
  });

  const once = process.argv.includes("--once");
  const intervalMs = Number(process.env.ASSETGEN_WORKER_POLL_MS ?? 1500);
  const schemas = await loadSchemas(repoPath(repoRoot, "schemas"));

  let lastHeartbeatWrite = 0;
  const heartbeatEveryMs = 5_000;

  if (once) {
    try {
      await writeWorkerHeartbeat(dataRoot, { pid: process.pid, intervalMs });
      await runOnce({ repoRoot, dataRoot, comfyBaseUrl, schemas, runtimeLog });
    } catch (err: any) {
      await runtimeLog.error("run_once_failed", { error: { message: err?.message ?? String(err), stack: err?.stack } });
      throw err;
    }
    return;
  }

  // eslint-disable-next-line no-console
  console.log(`[worker] Watching jobs. dataRoot=${dataRoot}`);
  await runtimeLog.info("watching", { intervalMs });

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const now = Date.now();
      if (now - lastHeartbeatWrite > heartbeatEveryMs) {
        await writeWorkerHeartbeat(dataRoot, { pid: process.pid, intervalMs });
        lastHeartbeatWrite = now;
      }
      await runOnce({ repoRoot, dataRoot, comfyBaseUrl, schemas, runtimeLog });
    } catch (err: any) {
      // Keep the worker alive, but make sure the error is visible.
      // eslint-disable-next-line no-console
      console.error("[worker] loop error:", err?.message ?? err);
      await runtimeLog.error("loop_error", { error: { message: err?.message ?? String(err), stack: err?.stack } });
    }
    await sleep(intervalMs);
  }
}

// Only start the worker loop when run as the main entry point (not when imported for tests)
const isMainEntry =
  process.argv[1] &&
  (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}` ||
    import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/")) ||
    process.argv[1].replace(/\\/g, "/").endsWith("worker.ts"));

if (isMainEntry) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err?.message ?? err);
    process.exit(1);
  });
}
