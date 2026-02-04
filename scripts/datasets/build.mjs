import fs from "node:fs/promises";
import path from "node:path";

import fg from "fast-glob";
import { ulid } from "ulid";

import { repoPath } from "../lib/paths.mjs";
import { loadLocalConfig } from "../lib/config.mjs";

function toPosix(p) {
  return p.replaceAll("\\", "/");
}

async function readJson(p) {
  const raw = await fs.readFile(p, "utf8");
  return JSON.parse(raw);
}

async function readJsonIfExists(p) {
  try {
    return await readJson(p);
  } catch (err) {
    if (err?.code === "ENOENT") return null;
    throw err;
  }
}

async function writeJson(p, v) {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(v, null, 2) + "\n", "utf8");
}

function uniq(values) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {
    projectId: "",
    scope: "project",
    datasetId: "",
    dryRun: false,
    status: "approved",
    assetTypes: [],
    tags: [],
    checkpoints: [],
    tagMode: "all",
    captionStrategy: "tags",
    includeSpecTags: true,
    includePromptTokens: false,
    provenance: {
      source: "",
      author: "",
      license: "",
      url: "",
      notes: ""
    }
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--project") out.projectId = args[++i] ?? "";
    if (a === "--scope") out.scope = args[++i] ?? "project";
    if (a === "--id") out.datasetId = args[++i] ?? "";
    if (a === "--dry-run") out.dryRun = true;
    if (a === "--status") out.status = args[++i] ?? "approved";
    if (a === "--asset-type" || a === "--assetType") {
      const raw = args[++i] ?? "";
      out.assetTypes.push(...raw.split(",").map((v) => v.trim()).filter(Boolean));
    }
    if (a === "--tag") {
      const raw = args[++i] ?? "";
      out.tags.push(...raw.split(",").map((v) => v.trim()).filter(Boolean));
    }
    if (a === "--checkpoint") {
      const raw = args[++i] ?? "";
      out.checkpoints.push(...raw.split(",").map((v) => v.trim()).filter(Boolean));
    }
    if (a === "--tag-any") out.tagMode = "any";
    if (a === "--caption") out.captionStrategy = args[++i] ?? "tags";
    if (a === "--no-spec-tags") out.includeSpecTags = false;
    if (a === "--with-tokens") out.includePromptTokens = true;
    if (a === "--no-tokens") out.includePromptTokens = false;
    if (a === "--provenance-source") out.provenance.source = args[++i] ?? "";
    if (a === "--provenance-author") out.provenance.author = args[++i] ?? "";
    if (a === "--provenance-license") out.provenance.license = args[++i] ?? "";
    if (a === "--provenance-url") out.provenance.url = args[++i] ?? "";
    if (a === "--provenance-notes") out.provenance.notes = args[++i] ?? "";
  }
  return out;
}

function pickVersionByStatus(asset, status) {
  const matches = (asset.versions ?? []).filter((v) => v.status === status);
  if (matches.length) return matches[matches.length - 1];
  return null;
}

function pickVariant(version) {
  if (!version) return null;
  if (version.primaryVariantId) return (version.variants ?? []).find((v) => v.id === version.primaryVariantId) ?? null;
  const selected = (version.variants ?? []).find((v) => v.status === "selected");
  if (selected) return selected;
  return (version.variants ?? [])[0] ?? null;
}

async function main() {
  const {
    projectId,
    scope,
    datasetId,
    dryRun,
    status,
    assetTypes,
    tags,
    checkpoints,
    tagMode,
    captionStrategy,
    includeSpecTags,
    includePromptTokens,
    provenance
  } = parseArgs();
  if (!projectId && scope === "project") {
    console.log("Usage: npm run dataset:build -- --project <projectId> [--id <datasetId>] [--dry-run] [--status <status>]");
    console.log("  Optional filters: --asset-type <type[,type]> --checkpoint <id[,id]> --tag <tag[,tag]> [--tag-any]");
    console.log("  Caption: --caption <tags|tags+spec|tags+spec+title> [--no-spec-tags] [--with-tokens]");
    console.log("  Provenance: --provenance-source <text> --provenance-author <text> --provenance-license <text> --provenance-url <url> --provenance-notes <text>");
    process.exit(1);
  }
  if (!["project", "baseline"].includes(scope)) {
    console.log("--scope must be 'project' or 'baseline'");
    process.exit(1);
  }
  if (!["draft", "review", "approved", "rejected", "deprecated"].includes(status)) {
    console.log("--status must be one of: draft, review, approved, rejected, deprecated");
    process.exit(1);
  }

  const local = loadLocalConfig();
  const dataRoot = local?.dataRoot ? path.resolve(local.dataRoot) : repoPath("data");

  const id = datasetId || ulid();
  const createdAt = new Date().toISOString();

  const baseDir = scope === "baseline" ? path.join(dataRoot, "shared", "datasets") : path.join(dataRoot, "projects", projectId, "datasets");
  const outPath = path.join(baseDir, `${id}.json`);

  const assetsGlob = path.join(dataRoot, "projects", projectId, "assets", "*.json");
  const assetFiles = await fg([assetsGlob], { absolute: true });
  const specsGlob = path.join(dataRoot, "projects", projectId, "specs", "*.json");
  const specFiles = await fg([specsGlob], { absolute: true });
  const specById = new Map();
  for (const file of specFiles) {
    const spec = await readJson(file);
    specById.set(spec.id, spec);
  }

  const catalogsRoot = path.join(dataRoot, "projects", projectId, "catalogs");

  function buildPromptTokensById(list = []) {
    const map = new Map();
    for (const entry of list ?? []) {
      if (!entry?.id || !Array.isArray(entry.promptTokens) || entry.promptTokens.length === 0) continue;
      map.set(entry.id, entry.promptTokens.filter(Boolean));
    }
    return map;
  }

  function buildTagPromptTokens(catalog) {
    const map = new Map();
    for (const group of catalog?.groups ?? []) {
      for (const tag of group?.tags ?? []) {
        if (tag?.id && tag?.promptToken) map.set(tag.id, tag.promptToken);
      }
    }
    return map;
  }

  function mergeTokenMaps(base, override) {
    const merged = new Map(base);
    for (const [key, value] of override) merged.set(key, value);
    return merged;
  }

  async function loadCatalogTokens(catalogDir) {
    const [stylesCatalog, scenariosCatalog, tagsCatalog] = await Promise.all([
      readJsonIfExists(path.join(catalogDir, "styles.json")),
      readJsonIfExists(path.join(catalogDir, "scenarios.json")),
      readJsonIfExists(path.join(catalogDir, "tags.json"))
    ]);
    return {
      styleTokensById: buildPromptTokensById(stylesCatalog?.styles),
      scenarioTokensById: buildPromptTokensById(scenariosCatalog?.scenarios),
      tagTokensById: buildTagPromptTokens(tagsCatalog)
    };
  }

  const baseCatalogTokens = await loadCatalogTokens(catalogsRoot);
  const catalogCache = new Map();

  async function getCatalogTokensForCheckpoint(checkpointId) {
    if (!checkpointId) return baseCatalogTokens;
    if (catalogCache.has(checkpointId)) return catalogCache.get(checkpointId);
    const checkpointCatalogsRoot = path.join(catalogsRoot, "checkpoints", checkpointId);
    const checkpointCatalogTokens = await loadCatalogTokens(checkpointCatalogsRoot);
    const merged = {
      styleTokensById: mergeTokenMaps(baseCatalogTokens.styleTokensById, checkpointCatalogTokens.styleTokensById),
      scenarioTokensById: mergeTokenMaps(baseCatalogTokens.scenarioTokensById, checkpointCatalogTokens.scenarioTokensById),
      tagTokensById: mergeTokenMaps(baseCatalogTokens.tagTokensById, checkpointCatalogTokens.tagTokensById)
    };
    catalogCache.set(checkpointId, merged);
    return merged;
  }

  const assetTypeSet = new Set(assetTypes);
  const checkpointSet = new Set(checkpoints);

  const items = [];
  for (const file of assetFiles) {
    const asset = await readJson(file);
    const spec = specById.get(asset.specId);
    if (assetTypeSet.size > 0 && !assetTypeSet.has(spec?.assetType)) continue;
    if (checkpointSet.size > 0 && !checkpointSet.has(spec?.checkpointId)) continue;

    const version = pickVersionByStatus(asset, status);
    if (!version) continue;
    const variant = pickVariant(version);
    if (!variant) continue;
    const relPath = variant.alphaPath ?? variant.originalPath;
    if (!relPath) continue;
    const absPath = path.join(dataRoot, relPath);
    try {
      await fs.access(absPath);
    } catch {
      continue;
    }

    const baseTags = Array.isArray(variant.tags) ? variant.tags : [];
    const specTags = includeSpecTags && Array.isArray(spec?.tags) ? spec.tags : [];
    const combinedTags = uniq([...baseTags, ...specTags]);
    if (tags.length > 0) {
      if (tagMode === "any") {
        const anyMatch = tags.some((tag) => combinedTags.includes(tag));
        if (!anyMatch) continue;
      } else {
        const allMatch = tags.every((tag) => combinedTags.includes(tag));
        if (!allMatch) continue;
      }
    }

    let promptTokens = [];
    if (includePromptTokens) {
      const catalogs = await getCatalogTokensForCheckpoint(spec?.checkpointId);
      if (spec?.style) promptTokens.push(...(catalogs.styleTokensById.get(spec.style) ?? []));
      if (spec?.scenario) promptTokens.push(...(catalogs.scenarioTokensById.get(spec.scenario) ?? []));
      for (const tag of combinedTags) {
        const token = catalogs.tagTokensById.get(tag);
        if (token) promptTokens.push(token);
      }
    }
    promptTokens = uniq(promptTokens);

    let caption = undefined;
    let captionParts = [];
    if (captionStrategy === "tags") {
      captionParts = [...baseTags];
    } else if (captionStrategy === "tags+spec") {
      captionParts = [...combinedTags];
    } else if (captionStrategy === "tags+spec+title") {
      captionParts = [...combinedTags];
      if (spec?.title) captionParts.push(spec.title);
    } else {
      captionParts = [...baseTags];
    }
    if (includePromptTokens) captionParts.push(...promptTokens);
    captionParts = uniq(captionParts);
    caption = captionParts.length > 0 ? captionParts.join(", ") : undefined;

    items.push({
      assetId: asset.id,
      assetVersionId: version.id,
      variantId: variant.id,
      path: toPosix(relPath),
      caption,
      tags: Array.isArray(variant.tags) ? variant.tags : []
    });
  }

  const provenancePayload =
    provenance?.source || provenance?.author || provenance?.license || provenance?.url || provenance?.notes
      ? {
          source: provenance.source || undefined,
          author: provenance.author || undefined,
          license: provenance.license || undefined,
          url: provenance.url || undefined,
          notes: provenance.notes || undefined
        }
      : undefined;

  const manifest = {
    id,
    scope,
    projectId: scope === "project" ? projectId : undefined,
    createdAt,
    updatedAt: createdAt,
    provenance: provenancePayload,
    selection: {
      source: "assets",
      status,
      variantPolicy: "primary|selected|first",
      assetTypes,
      checkpoints,
      tags,
      tagMode,
      captionStrategy,
      includeSpecTags,
      includePromptTokens,
      note: "Dataset builder with filters."
    },
    items
  };

  if (dryRun) {
    console.log(`[dataset] Would write ${outPath}`);
    console.log(`[dataset] items=${items.length}`);
    return;
  }

  await writeJson(outPath, manifest);
  console.log(`[dataset] Wrote ${outPath}`);
  console.log(`[dataset] items=${items.length}`);
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});
