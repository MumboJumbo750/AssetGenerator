import fs from "node:fs/promises";
import path from "node:path";

import { fileExists, readJson, writeJsonAtomic } from "../lib/json";
import type { SchemaRegistry } from "../lib/schemas";

export type Asset = {
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

function nowIso() {
  return new Date().toISOString();
}

export async function listAssets(projectsRoot: string, projectId: string) {
  const root = path.join(projectsRoot, projectId, "assets");
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    const items: Asset[] = [];
    for (const e of entries) {
      if (!e.isFile() || !e.name.endsWith(".json")) continue;
      items.push(await readJson<Asset>(path.join(root, e.name)));
    }
    items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return items;
  } catch {
    return [];
  }
}

export async function getAsset(projectsRoot: string, projectId: string, assetId: string) {
  const filePath = path.join(projectsRoot, projectId, "assets", `${assetId}.json`);
  if (!(await fileExists(filePath))) return null;
  return readJson<Asset>(filePath);
}

export async function approveAssetVersion(opts: {
  projectsRoot: string;
  schemas: SchemaRegistry;
  projectId: string;
  assetId: string;
  versionId: string;
}) {
  const filePath = path.join(opts.projectsRoot, opts.projectId, "assets", `${opts.assetId}.json`);
  if (!(await fileExists(filePath))) return null;
  const asset = await readJson<Asset>(filePath);

  const version = asset.versions.find((v) => v.id === opts.versionId);
  if (!version) return null;
  version.status = "approved";
  asset.updatedAt = nowIso();

  opts.schemas.validateOrThrow("asset.schema.json", asset);
  await writeJsonAtomic(filePath, asset);
  return asset;
}

export async function setPrimaryVariant(opts: {
  projectsRoot: string;
  schemas: SchemaRegistry;
  projectId: string;
  assetId: string;
  versionId: string;
  variantId: string;
}) {
  const filePath = path.join(opts.projectsRoot, opts.projectId, "assets", `${opts.assetId}.json`);
  if (!(await fileExists(filePath))) return null;
  const asset = await readJson<Asset>(filePath);

  const version = asset.versions.find((v) => v.id === opts.versionId);
  if (!version) return null;
  const variant = version.variants.find((v) => v.id === opts.variantId);
  if (!variant) return null;

  version.primaryVariantId = opts.variantId;
  asset.updatedAt = nowIso();

  opts.schemas.validateOrThrow("asset.schema.json", asset);
  await writeJsonAtomic(filePath, asset);
  return asset;
}

export async function updateAssetVariant(opts: {
  projectsRoot: string;
  schemas: SchemaRegistry;
  projectId: string;
  assetId: string;
  versionId: string;
  variantId: string;
  patch: { tags?: string[]; rating?: number | null; status?: string; reviewNote?: string | null };
}) {
  const filePath = path.join(opts.projectsRoot, opts.projectId, "assets", `${opts.assetId}.json`);
  if (!(await fileExists(filePath))) return null;
  const asset = await readJson<Asset>(filePath);

  const version = asset.versions.find((v) => v.id === opts.versionId);
  if (!version) return null;
  const variant = version.variants.find((v) => v.id === opts.variantId);
  if (!variant) return null;

  if (Array.isArray(opts.patch?.tags)) variant.tags = opts.patch.tags;
  if (typeof opts.patch?.rating === "number") variant.rating = opts.patch.rating;
  if (opts.patch?.rating === null) delete (variant as any).rating;
  if (typeof opts.patch?.status === "string") variant.status = opts.patch.status as any;
  if (typeof opts.patch?.reviewNote === "string") (variant as any).reviewNote = opts.patch.reviewNote;
  if (opts.patch?.reviewNote === null) delete (variant as any).reviewNote;

  asset.updatedAt = nowIso();
  opts.schemas.validateOrThrow("asset.schema.json", asset);
  await writeJsonAtomic(filePath, asset);
  return asset;
}

export async function updateAssetVersion(opts: {
  projectsRoot: string;
  schemas: SchemaRegistry;
  projectId: string;
  assetId: string;
  versionId: string;
  patch: { status?: string };
}) {
  const filePath = path.join(opts.projectsRoot, opts.projectId, "assets", `${opts.assetId}.json`);
  if (!(await fileExists(filePath))) return null;
  const asset = await readJson<Asset>(filePath);

  const version = asset.versions.find((v) => v.id === opts.versionId);
  if (!version) return null;

  if (typeof opts.patch?.status === "string") version.status = opts.patch.status as any;

  asset.updatedAt = nowIso();
  opts.schemas.validateOrThrow("asset.schema.json", asset);
  await writeJsonAtomic(filePath, asset);
  return asset;
}
