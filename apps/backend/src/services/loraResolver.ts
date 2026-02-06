import path from "node:path";

import { getProject } from "./projects";
import { getSpec } from "./specs";
import { listProjectLoras, listSharedLoras, type LoraRecord, type LoraRelease } from "./loras";

type LoraSelectionMode =
  | "manual"
  | "baseline_then_project"
  | "project_then_baseline"
  | "baseline_only"
  | "project_only";

type LoraReleasePolicy = "active_or_latest_approved" | "active_only";

type LoraSelectionPolicy = {
  mode: LoraSelectionMode;
  preferRecommended: boolean;
  maxActiveLoras: number;
  releasePolicy: LoraReleasePolicy;
};

type StackLayer = "baseline" | "project" | "manual";
type ModelStackPolicy = {
  stackOrder: StackLayer[];
  maxActiveLoras?: number;
  layerCaps?: Partial<Record<StackLayer, number>>;
};

type ResolvedLora = {
  loraId?: string;
  releaseId?: string;
  loraName: string;
  strengthModel: number;
  strengthClip: number;
  source: "explicit" | "policy";
  scope?: "baseline" | "project";
};

function defaultPolicy(): LoraSelectionPolicy {
  return {
    mode: "baseline_then_project",
    preferRecommended: true,
    maxActiveLoras: 2,
    releasePolicy: "active_or_latest_approved",
  };
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => (typeof item === "string" ? item.trim() : "")).filter((item) => item.length > 0);
}

function asNumber(value: unknown, fallback: number) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizePathLike(value: string) {
  return value.replace(/\\/g, "/");
}

function parsePolicy(raw: unknown): LoraSelectionPolicy {
  const defaults = defaultPolicy();
  const loraSelection = (raw as any)?.loraSelection ?? {};
  const mode = String(loraSelection.mode ?? defaults.mode) as LoraSelectionMode;
  const preferRecommended =
    typeof loraSelection.preferRecommended === "boolean" ? loraSelection.preferRecommended : defaults.preferRecommended;
  const maxActiveLoras = Math.max(0, Math.floor(asNumber(loraSelection.maxActiveLoras, defaults.maxActiveLoras)));
  const releasePolicy = String(loraSelection.releasePolicy ?? defaults.releasePolicy) as LoraReleasePolicy;
  return {
    mode:
      mode === "manual" ||
      mode === "baseline_then_project" ||
      mode === "project_then_baseline" ||
      mode === "baseline_only" ||
      mode === "project_only"
        ? mode
        : defaults.mode,
    preferRecommended,
    maxActiveLoras,
    releasePolicy: releasePolicy === "active_only" ? "active_only" : "active_or_latest_approved",
  };
}

function parseStackPolicy(raw: unknown, fallback: LoraSelectionPolicy): ModelStackPolicy {
  const modelStackPolicy = (raw as any)?.modelStackPolicy ?? {};
  const orderRaw = Array.isArray(modelStackPolicy.stackOrder)
    ? modelStackPolicy.stackOrder.map((item: unknown) => String(item))
    : null;
  const modeDefaultOrder: StackLayer[] =
    fallback.mode === "baseline_then_project"
      ? ["baseline", "project", "manual"]
      : fallback.mode === "project_then_baseline"
        ? ["project", "baseline", "manual"]
        : fallback.mode === "baseline_only"
          ? ["baseline", "manual"]
          : fallback.mode === "project_only"
            ? ["project", "manual"]
            : ["manual", "baseline", "project"];
  const normalizedOrder = (orderRaw ?? modeDefaultOrder).filter(
    (item: string): item is StackLayer => item === "baseline" || item === "project" || item === "manual",
  );
  const stackOrder = normalizedOrder.length > 0 ? normalizedOrder : modeDefaultOrder;

  const cap = (value: unknown) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return undefined;
    return Math.max(0, Math.floor(n));
  };
  const layerCapsRaw = modelStackPolicy.layerCaps ?? {};
  const layerCaps: Partial<Record<StackLayer, number>> = {
    ...(cap(layerCapsRaw.baseline) !== undefined ? { baseline: cap(layerCapsRaw.baseline)! } : {}),
    ...(cap(layerCapsRaw.project) !== undefined ? { project: cap(layerCapsRaw.project)! } : {}),
    ...(cap(layerCapsRaw.manual) !== undefined ? { manual: cap(layerCapsRaw.manual)! } : {}),
  };
  const maxActive = cap(modelStackPolicy.maxActiveLoras);
  return {
    stackOrder,
    ...(maxActive !== undefined ? { maxActiveLoras: maxActive } : {}),
    ...(Object.keys(layerCaps).length > 0 ? { layerCaps } : {}),
  };
}

function pickRelease(record: LoraRecord, policy: LoraSelectionPolicy, releaseIdHint?: string | null) {
  const releases = Array.isArray(record.releases) ? record.releases : [];
  if (releases.length === 0) return null;
  if (releaseIdHint) {
    const hinted = releases.find((release) => release.id === releaseIdHint);
    if (hinted) return hinted;
  }
  if (record.activeReleaseId) {
    const active = releases.find((release) => release.id === record.activeReleaseId);
    if (active) return active;
  }
  if (policy.releasePolicy === "active_only") return null;
  const approved = releases.filter((release) => release.status === "approved");
  if (approved.length === 0) return null;
  approved.sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));
  return approved[0];
}

function resolveWeightPath(release: LoraRelease) {
  const pathFromWeights =
    typeof (release.weights as any)?.path === "string" ? String((release.weights as any).path) : "";
  if (pathFromWeights.trim()) return normalizePathLike(pathFromWeights.trim());
  const localPath = typeof (release as any)?.localPath === "string" ? String((release as any).localPath) : "";
  if (localPath.trim()) return normalizePathLike(localPath.trim());
  return "";
}

function compatibilityReason(record: LoraRecord, opts: { checkpointId: string; assetType: string }) {
  if (opts.checkpointId && record.checkpointId && record.checkpointId !== opts.checkpointId) {
    return "incompatible_checkpoint";
  }
  const recordTypes = Array.isArray(record.assetTypes) ? record.assetTypes : [];
  if (recordTypes.length > 0 && opts.assetType && !recordTypes.includes(opts.assetType)) {
    return "incompatible_asset_type";
  }
  return null;
}

function sortPool(pool: LoraRecord[], preferRecommended: boolean) {
  const copy = [...pool];
  copy.sort((left, right) => {
    if (preferRecommended) {
      const leftRecommended = left.recommended ? 1 : 0;
      const rightRecommended = right.recommended ? 1 : 0;
      if (leftRecommended !== rightRecommended) return rightRecommended - leftRecommended;
    }
    const byUpdated = String(right.updatedAt ?? "").localeCompare(String(left.updatedAt ?? ""));
    if (byUpdated !== 0) return byUpdated;
    return String(left.id).localeCompare(String(right.id));
  });
  return copy;
}

function keyForResolved(item: ResolvedLora) {
  return [item.loraId ?? "", item.releaseId ?? "", item.loraName].join("|");
}

export async function resolveLorasForGenerate(opts: {
  projectsRoot: string;
  dataRoot: string;
  projectId: string;
  input: Record<string, unknown>;
}) {
  const specId = String(opts.input.specId ?? "");
  if (!specId) return null;
  const spec = await getSpec(opts.projectsRoot, opts.projectId, specId);
  if (!spec) return null;

  const project = await getProject(opts.projectsRoot, opts.projectId);
  const policy = parsePolicy(project?.policies);
  const stackPolicy = parseStackPolicy(project?.policies, policy);
  const checkpointId = String(opts.input.checkpointName ?? spec.checkpointId ?? "");
  const assetType = String(spec.assetType ?? "");

  const [projectLoras, sharedLoras] = await Promise.all([
    listProjectLoras(opts.projectsRoot, opts.projectId),
    listSharedLoras(opts.dataRoot),
  ]);
  const allById = new Map<string, LoraRecord>();
  [...projectLoras, ...sharedLoras].forEach((record) => {
    allById.set(record.id, record);
  });

  const explicitFromInput = Array.isArray(opts.input.loras) ? (opts.input.loras as Array<Record<string, unknown>>) : [];
  const explicitIds = new Set<string>([...asStringArray((spec as any).loraIds), ...asStringArray(opts.input.loraIds)]);

  const blocked: Array<{ loraId: string; scope?: string; reason: string }> = [];
  const skipped: Array<{ loraId: string; scope?: string; reason: string }> = [];
  const explicitResolved: ResolvedLora[] = [];
  for (const entry of explicitFromInput) {
    const loraId = typeof entry?.loraId === "string" ? entry.loraId : "";
    const releaseIdHint = typeof entry?.releaseId === "string" ? entry.releaseId : null;
    if (loraId) {
      explicitIds.add(loraId);
      const record = allById.get(loraId);
      if (!record) {
        blocked.push({ loraId, reason: "explicit_lora_not_found" });
        continue;
      }
      const incompatibleReason = compatibilityReason(record, { checkpointId, assetType });
      if (incompatibleReason) {
        blocked.push({ loraId: record.id, scope: record.scope, reason: `explicit_${incompatibleReason}` });
        continue;
      }
      const release = record ? pickRelease(record, policy, releaseIdHint) : null;
      if (!release) {
        blocked.push({ loraId: record.id, scope: record.scope, reason: "explicit_no_eligible_release" });
        continue;
      }
      const loraName =
        typeof entry?.loraName === "string" && entry.loraName.trim()
          ? normalizePathLike(entry.loraName.trim())
          : release
            ? resolveWeightPath(release) || loraId
            : loraId;
      explicitResolved.push({
        loraId,
        releaseId: release?.id ?? releaseIdHint ?? undefined,
        loraName,
        strengthModel: asNumber(entry?.strengthModel ?? entry?.weight, record?.scope === "baseline" ? 0.6 : 0.9),
        strengthClip: asNumber(
          entry?.strengthClip,
          asNumber(entry?.strengthModel ?? entry?.weight, record?.scope === "baseline" ? 0.6 : 0.9),
        ),
        source: "explicit",
        scope: record?.scope,
      });
      continue;
    }
    const loraName = typeof entry?.loraName === "string" ? entry.loraName.trim() : "";
    if (!loraName) continue;
    const strengthModel = asNumber(entry?.strengthModel ?? entry?.weight, 1);
    explicitResolved.push({
      loraName: normalizePathLike(loraName),
      strengthModel,
      strengthClip: asNumber(entry?.strengthClip, strengthModel),
      source: "explicit",
    });
  }

  for (const explicitId of explicitIds) {
    if (explicitResolved.some((item) => item.loraId === explicitId)) continue;
    const record = allById.get(explicitId);
    if (!record) {
      blocked.push({ loraId: explicitId, reason: "explicit_lora_not_found" });
      continue;
    }
    const reason = compatibilityReason(record, { checkpointId, assetType });
    if (reason) {
      blocked.push({ loraId: record.id, scope: record.scope, reason: `explicit_${reason}` });
      continue;
    }
    const release = pickRelease(record, policy);
    if (!release) {
      blocked.push({ loraId: record.id, scope: record.scope, reason: "explicit_no_eligible_release" });
      continue;
    }
    const defaultStrength = record.scope === "baseline" ? 0.6 : 0.9;
    explicitResolved.push({
      loraId: record.id,
      releaseId: release.id,
      loraName: resolveWeightPath(release) || record.id,
      strengthModel: defaultStrength,
      strengthClip: defaultStrength,
      source: "explicit",
      scope: record.scope,
    });
  }

  const mode = policy.mode;
  const compatibility = { checkpointId, assetType };
  const filterCompatible = (records: LoraRecord[]) =>
    sortPool(records, policy.preferRecommended).filter((record) => {
      const reason = compatibilityReason(record, compatibility);
      if (reason) {
        blocked.push({ loraId: record.id, scope: record.scope, reason });
        return false;
      }
      return true;
    });
  const candidateProject = filterCompatible(projectLoras);
  const candidateBaseline = filterCompatible(sharedLoras);

  let orderedPolicyPool: LoraRecord[] = [];
  if (mode === "baseline_then_project") orderedPolicyPool = [...candidateBaseline, ...candidateProject];
  else if (mode === "project_then_baseline") orderedPolicyPool = [...candidateProject, ...candidateBaseline];
  else if (mode === "baseline_only") orderedPolicyPool = [...candidateBaseline];
  else if (mode === "project_only") orderedPolicyPool = [...candidateProject];
  else orderedPolicyPool = [];

  const effectiveMaxActive = Math.max(
    0,
    Math.min(policy.maxActiveLoras, stackPolicy.maxActiveLoras ?? policy.maxActiveLoras),
  );

  const layerCaps: Partial<Record<StackLayer, number>> = {
    baseline: stackPolicy.layerCaps?.baseline ?? Number.MAX_SAFE_INTEGER,
    project: stackPolicy.layerCaps?.project ?? Number.MAX_SAFE_INTEGER,
    manual: stackPolicy.layerCaps?.manual ?? Number.MAX_SAFE_INTEGER,
  };

  const explicitByLayer: Record<StackLayer, ResolvedLora[]> = { baseline: [], project: [], manual: [] };
  for (const item of explicitResolved) {
    const layer: StackLayer = item.scope === "baseline" ? "baseline" : item.scope === "project" ? "project" : "manual";
    explicitByLayer[layer].push(item);
  }

  const explicitIdsResolved = new Set(explicitResolved.map((item) => item.loraId).filter(Boolean) as string[]);
  const policyResolved: ResolvedLora[] = [];
  for (const record of orderedPolicyPool) {
    if (explicitIdsResolved.has(record.id)) {
      skipped.push({ loraId: record.id, scope: record.scope, reason: "already_explicit" });
      continue;
    }
    const release = pickRelease(record, policy);
    if (!release) {
      skipped.push({ loraId: record.id, scope: record.scope, reason: "no_eligible_release" });
      continue;
    }
    const defaultStrength = record.scope === "baseline" ? 0.6 : 0.9;
    policyResolved.push({
      loraId: record.id,
      releaseId: release.id,
      loraName: resolveWeightPath(release) || record.id,
      strengthModel: defaultStrength,
      strengthClip: defaultStrength,
      source: "policy",
      scope: record.scope,
    });
  }

  const maxActive = policy.maxActiveLoras;
  const policyByLayer: Record<StackLayer, ResolvedLora[]> = { baseline: [], project: [], manual: [] };
  for (const item of policyResolved) {
    const layer: StackLayer = item.scope === "baseline" ? "baseline" : item.scope === "project" ? "project" : "manual";
    policyByLayer[layer].push(item);
  }

  const chosenByLayer: Record<StackLayer, ResolvedLora[]> = { baseline: [], project: [], manual: [] };
  let totalChosen = 0;
  for (const layer of stackPolicy.stackOrder) {
    const layerCap = layerCaps[layer] ?? Number.MAX_SAFE_INTEGER;
    const layerCandidates = [...explicitByLayer[layer], ...policyByLayer[layer]];
    for (const item of layerCandidates) {
      if (totalChosen >= effectiveMaxActive) {
        skipped.push({ loraId: item.loraId ?? item.loraName, scope: item.scope, reason: "max_active_loras_cap" });
        continue;
      }
      if (chosenByLayer[layer].length >= layerCap) {
        skipped.push({ loraId: item.loraId ?? item.loraName, scope: item.scope, reason: `layer_cap_${layer}` });
        continue;
      }
      chosenByLayer[layer].push(item);
      totalChosen += 1;
    }
  }
  const combined = stackPolicy.stackOrder.flatMap((layer) => chosenByLayer[layer]);

  const deduped: ResolvedLora[] = [];
  const seen = new Set<string>();
  for (const item of combined) {
    const key = keyForResolved(item);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  return {
    loras: deduped.map((item) => ({
      ...(item.loraId ? { loraId: item.loraId } : {}),
      ...(item.releaseId ? { releaseId: item.releaseId } : {}),
      loraName: item.loraName,
      strengthModel: item.strengthModel,
      strengthClip: item.strengthClip,
    })),
    loraSelection: {
      mode: policy.mode,
      releasePolicy: policy.releasePolicy,
      preferRecommended: policy.preferRecommended,
      maxActiveLoras: effectiveMaxActive,
      checkpointName: checkpointId || null,
      assetType: assetType || null,
      explicitCount: explicitResolved.length,
      resolvedCount: deduped.length,
      resolvedAt: new Date().toISOString(),
      resolvedStackSnapshot: {
        stackOrder: stackPolicy.stackOrder,
        layerCaps: {
          baseline: layerCaps.baseline,
          project: layerCaps.project,
          manual: layerCaps.manual,
        },
        maxActiveLoras: effectiveMaxActive,
        layers: stackPolicy.stackOrder.map((layer) => ({
          layer,
          items: chosenByLayer[layer].map((item) => ({
            loraId: item.loraId ?? null,
            releaseId: item.releaseId ?? null,
            source: item.source,
            scope: item.scope ?? null,
            strengthModel: item.strengthModel,
            strengthClip: item.strengthClip,
          })),
        })),
      },
      resolverExplanation: {
        chosen: deduped.map((item) => ({
          loraId: item.loraId ?? null,
          releaseId: item.releaseId ?? null,
          source: item.source,
          scope: item.scope ?? null,
        })),
        skipped,
        blocked,
      },
      /**
       * If any explicitly-requested LoRAs were blocked (not found, incompatible,
       * no eligible release), the resolver flags this so the job can be routed to
       * the exception queue instead of proceeding with a degraded stack.
       */
      unsatisfiedExplicit: blocked.filter((b) => b.reason.startsWith("explicit_")).length,
    },
  };
}
