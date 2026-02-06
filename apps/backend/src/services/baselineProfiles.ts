import fs from "node:fs/promises";
import path from "node:path";

import { ulid } from "ulid";

import { fileExists, readJson, writeJsonAtomic } from "../lib/json";
import type { SchemaRegistry } from "../lib/schemas";

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

function nowIso() {
  return new Date().toISOString();
}

function defaultProfile(projectId: string, id: string): BaselineProfile {
  const createdAt = nowIso();
  return {
    id,
    projectId,
    checkpointId: "ckpt_sd15_demo",
    name: "Default baseline profile",
    version: 1,
    createdAt,
    updatedAt: createdAt,
    global: {
      noDropShadows: true,
      background: "white_or_transparent",
      alphaEdgeClean: "required",
      allowPerspective: false,
    },
    assetTypeProfiles: {
      ui_icon: {
        lighting: "flat",
        tileableEdges: "off",
        requiredStates: ["default"],
        stateAlignment: "n/a",
        paddingPx: 2,
        promptHints: [],
        negativePromptHints: [],
      },
    },
    validatorPolicy: {
      shadowCheck: { enabled: true, threshold: 0.9 },
      backgroundCheck: { enabled: true, mode: "white_or_transparent", threshold: 0.9 },
      stateCompletenessCheck: { enabled: true, threshold: 0.95 },
      stateAlignmentCheck: { enabled: true, maxPixelDrift: 2 },
      edgeCleanlinessCheck: { enabled: true, threshold: 0.85 },
    },
    routingPolicy: {
      onPass: "auto_advance",
      onFail: "manual_review",
      onUncertain: "queue_decision_sprint",
    },
    specOverrides: {},
  };
}

export async function listBaselineProfiles(projectsRoot: string, projectId: string) {
  const root = path.join(projectsRoot, projectId, "baseline-profiles");
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    const items: BaselineProfile[] = [];
    for (const e of entries) {
      if (!e.isFile() || !e.name.endsWith(".json")) continue;
      items.push(await readJson<BaselineProfile>(path.join(root, e.name)));
    }
    items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return items;
  } catch {
    return [];
  }
}

export async function getBaselineProfile(projectsRoot: string, projectId: string, profileId: string) {
  const filePath = path.join(projectsRoot, projectId, "baseline-profiles", `${profileId}.json`);
  if (!(await fileExists(filePath))) return null;
  return readJson<BaselineProfile>(filePath);
}

export async function createBaselineProfile(opts: {
  projectsRoot: string;
  schemas: SchemaRegistry;
  projectId: string;
  body: Partial<BaselineProfile>;
}) {
  const id = opts.body?.id?.trim() || ulid();
  const base = defaultProfile(opts.projectId, id);
  const createdAt = nowIso();
  const profile: BaselineProfile = {
    ...base,
    ...(opts.body as Partial<BaselineProfile>),
    id,
    projectId: opts.projectId,
    checkpointId: opts.body?.checkpointId?.trim() || base.checkpointId,
    checkpointProfileId: opts.body?.checkpointProfileId?.trim() || base.checkpointProfileId,
    name: opts.body?.name?.trim() || base.name,
    version: Number.isFinite(opts.body?.version) ? Number(opts.body?.version) : base.version,
    createdAt,
    updatedAt: createdAt,
  };

  opts.schemas.validateOrThrow("baseline-profile.schema.json", profile);
  const dir = path.join(opts.projectsRoot, opts.projectId, "baseline-profiles");
  await fs.mkdir(dir, { recursive: true });
  await writeJsonAtomic(path.join(dir, `${id}.json`), profile);
  return profile;
}

export async function updateBaselineProfile(opts: {
  projectsRoot: string;
  schemas: SchemaRegistry;
  projectId: string;
  profileId: string;
  patch: Partial<BaselineProfile>;
}) {
  const filePath = path.join(opts.projectsRoot, opts.projectId, "baseline-profiles", `${opts.profileId}.json`);
  if (!(await fileExists(filePath))) return null;
  const profile = await readJson<BaselineProfile>(filePath);
  const next: BaselineProfile = {
    ...profile,
    updatedAt: nowIso(),
  };

  if (typeof opts.patch.name === "string") next.name = opts.patch.name.trim();
  if (typeof opts.patch.checkpointId === "string") next.checkpointId = opts.patch.checkpointId.trim();
  if (typeof opts.patch.checkpointProfileId === "string")
    next.checkpointProfileId = opts.patch.checkpointProfileId.trim();
  if (opts.patch.version !== undefined && Number.isFinite(opts.patch.version))
    next.version = Number(opts.patch.version);
  if (opts.patch.global) next.global = opts.patch.global;
  if (opts.patch.assetTypeProfiles) next.assetTypeProfiles = opts.patch.assetTypeProfiles;
  if (opts.patch.validatorPolicy) next.validatorPolicy = opts.patch.validatorPolicy;
  if (opts.patch.routingPolicy) next.routingPolicy = opts.patch.routingPolicy;
  if (opts.patch.specOverrides !== undefined) next.specOverrides = opts.patch.specOverrides;

  opts.schemas.validateOrThrow("baseline-profile.schema.json", next);
  await writeJsonAtomic(filePath, next);
  return next;
}
