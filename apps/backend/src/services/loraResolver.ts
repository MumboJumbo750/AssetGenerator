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

function compatible(record: LoraRecord, opts: { checkpointId: string; assetType: string }) {
  if (opts.checkpointId && record.checkpointId && record.checkpointId !== opts.checkpointId) return false;
  const recordTypes = Array.isArray(record.assetTypes) ? record.assetTypes : [];
  if (recordTypes.length > 0 && opts.assetType) return recordTypes.includes(opts.assetType);
  return true;
}

function sortPool(pool: LoraRecord[], preferRecommended: boolean) {
  const copy = [...pool];
  copy.sort((left, right) => {
    if (preferRecommended) {
      const leftRecommended = left.recommended ? 1 : 0;
      const rightRecommended = right.recommended ? 1 : 0;
      if (leftRecommended !== rightRecommended) return rightRecommended - leftRecommended;
    }
    return String(right.updatedAt ?? "").localeCompare(String(left.updatedAt ?? ""));
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

  const explicitResolved: ResolvedLora[] = [];
  for (const entry of explicitFromInput) {
    const loraId = typeof entry?.loraId === "string" ? entry.loraId : "";
    const releaseIdHint = typeof entry?.releaseId === "string" ? entry.releaseId : null;
    if (loraId) {
      explicitIds.add(loraId);
      const record = allById.get(loraId);
      const release = record ? pickRelease(record, policy, releaseIdHint) : null;
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
    if (!record) continue;
    if (!compatible(record, { checkpointId, assetType })) continue;
    const release = pickRelease(record, policy);
    if (!release) continue;
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
  const candidateProject = sortPool(projectLoras, policy.preferRecommended).filter((record) =>
    compatible(record, { checkpointId, assetType }),
  );
  const candidateBaseline = sortPool(sharedLoras, policy.preferRecommended).filter((record) =>
    compatible(record, { checkpointId, assetType }),
  );

  let orderedPolicyPool: LoraRecord[] = [];
  if (mode === "baseline_then_project") orderedPolicyPool = [...candidateBaseline, ...candidateProject];
  else if (mode === "project_then_baseline") orderedPolicyPool = [...candidateProject, ...candidateBaseline];
  else if (mode === "baseline_only") orderedPolicyPool = [...candidateBaseline];
  else if (mode === "project_only") orderedPolicyPool = [...candidateProject];
  else orderedPolicyPool = [];

  const explicitIdsResolved = new Set(explicitResolved.map((item) => item.loraId).filter(Boolean) as string[]);
  const policyResolved: ResolvedLora[] = [];
  for (const record of orderedPolicyPool) {
    if (explicitIdsResolved.has(record.id)) continue;
    const release = pickRelease(record, policy);
    if (!release) continue;
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
  const allowedPolicyCount = Math.max(0, maxActive - explicitResolved.length);
  const combined = [...explicitResolved, ...policyResolved.slice(0, allowedPolicyCount)];

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
      maxActiveLoras: policy.maxActiveLoras,
      checkpointName: checkpointId || null,
      assetType: assetType || null,
      explicitCount: explicitResolved.length,
      resolvedCount: deduped.length,
      resolvedAt: new Date().toISOString(),
    },
  };
}
