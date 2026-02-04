import fs from "node:fs/promises";
import path from "node:path";

import fg from "fast-glob";

import { repoPath } from "../lib/paths.mjs";
import { loadLocalConfig } from "../lib/config.mjs";

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {
    kind: null,
    from: null,
    to: null,
    projectId: null,
    dataRoot: null,
    dryRun: false
  };

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--kind") out.kind = args[++i] ?? null;
    else if (a === "--from") out.from = args[++i] ?? null;
    else if (a === "--to") out.to = args[++i] ?? null;
    else if (a === "--project") out.projectId = args[++i] ?? null;
    else if (a === "--data-root") out.dataRoot = args[++i] ?? null;
    else if (a === "--dry-run") out.dryRun = true;
  }

  return out;
}

function usage() {
  console.log("Usage:");
  console.log("  npm run migrate:rename-id -- --kind <kind> --from <oldId> --to <newId> [--project <projectId>] [--dry-run]");
  console.log("");
  console.log("Kinds:");
  console.log("  tag | tagGroup | assetType | style | scenario | palette | checkpoint | lora");
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function replaceExactString(value, from, to) {
  if (typeof value !== "string") return value;
  return value === from ? to : value;
}

function replaceInArray(arr, from, to) {
  if (!Array.isArray(arr)) return { changed: false, value: arr };
  let changed = false;
  const out = arr.map((v) => {
    const next = replaceExactString(v, from, to);
    if (next !== v) changed = true;
    return next;
  });
  return { changed, value: out };
}

function replacePrefix(value, prefixFrom, prefixTo) {
  if (typeof value !== "string") return value;
  return value.startsWith(prefixFrom) ? prefixTo + value.slice(prefixFrom.length) : value;
}

function replaceTagGroupPrefixInArray(arr, groupFrom, groupTo) {
  if (!Array.isArray(arr)) return { changed: false, value: arr };
  const prefixFrom = `${groupFrom}:`;
  const prefixTo = `${groupTo}:`;
  let changed = false;
  const out = arr.map((v) => {
    const next = replacePrefix(v, prefixFrom, prefixTo);
    if (next !== v) changed = true;
    return next;
  });
  return { changed, value: out };
}

function updateProjectJson(project, { kind, from, to }) {
  let changed = false;
  if (!project || typeof project !== "object") return { changed: false, value: project };

  if (kind === "style" && project.defaults?.style === from) {
    project.defaults.style = to;
    changed = true;
  }
  if (kind === "scenario" && project.defaults?.scenario === from) {
    project.defaults.scenario = to;
    changed = true;
  }
  if (kind === "palette") {
    const r = replaceInArray(project.defaults?.paletteIds, from, to);
    if (r.changed) {
      project.defaults.paletteIds = r.value;
      changed = true;
    }
  }
  if (kind === "tag") {
    const r = replaceInArray(project.defaults?.tagIds, from, to);
    if (r.changed) {
      project.defaults.tagIds = r.value;
      changed = true;
    }
  }
  if (kind === "tagGroup") {
    const r = replaceTagGroupPrefixInArray(project.defaults?.tagIds, from, to);
    if (r.changed) {
      project.defaults.tagIds = r.value;
      changed = true;
    }
  }

  return { changed, value: project };
}

function updateSpecJson(spec, { kind, from, to }) {
  let changed = false;
  if (!spec || typeof spec !== "object") return { changed: false, value: spec };

  if (kind === "assetType" && spec.assetType === from) {
    spec.assetType = to;
    changed = true;
  }
  if (kind === "checkpoint" && spec.checkpointId === from) {
    spec.checkpointId = to;
    changed = true;
  }
  if (kind === "lora") {
    const r = replaceInArray(spec.loraIds, from, to);
    if (r.changed) {
      spec.loraIds = r.value;
      changed = true;
    }
  }
  if (kind === "style" && spec.style === from) {
    spec.style = to;
    changed = true;
  }
  if (kind === "scenario" && spec.scenario === from) {
    spec.scenario = to;
    changed = true;
  }
  if (kind === "tag") {
    const r = replaceInArray(spec.tags, from, to);
    if (r.changed) {
      spec.tags = r.value;
      changed = true;
    }
  }
  if (kind === "tagGroup") {
    const r = replaceTagGroupPrefixInArray(spec.tags, from, to);
    if (r.changed) {
      spec.tags = r.value;
      changed = true;
    }
  }

  return { changed, value: spec };
}

function updateAssetJson(asset, { kind, from, to }) {
  if (!asset || typeof asset !== "object") return { changed: false, value: asset };
  let changed = false;

  if (kind !== "tag" && kind !== "tagGroup") return { changed: false, value: asset };

  for (const version of asset.versions ?? []) {
    for (const variant of version?.variants ?? []) {
      if (kind === "tag") {
        const r = replaceInArray(variant.tags, from, to);
        if (r.changed) {
          variant.tags = r.value;
          changed = true;
        }
      } else if (kind === "tagGroup") {
        const r = replaceTagGroupPrefixInArray(variant.tags, from, to);
        if (r.changed) {
          variant.tags = r.value;
          changed = true;
        }
      }
    }
  }

  return { changed, value: asset };
}

function updateAssetTypesCatalogJson(catalog, { from, to }) {
  if (!catalog || typeof catalog !== "object") return { changed: false, value: catalog };
  let changed = false;

  for (const t of catalog.assetTypes ?? []) {
    if (t?.id === from) {
      t.id = to;
      changed = true;
    }
    // Keep defaultTags in sync with the assetType:* tag convention.
    if (Array.isArray(t?.defaultTags)) {
      const r = replaceInArray(t.defaultTags, `assetType:${from}`, `assetType:${to}`);
      if (r.changed) {
        t.defaultTags = r.value;
        changed = true;
      }
    }
  }

  return { changed, value: catalog };
}

function updateTagsCatalogJsonForTag(catalog, { from, to }) {
  if (!catalog || typeof catalog !== "object") return { changed: false, value: catalog };
  let changed = false;

  for (const g of catalog.groups ?? []) {
    for (const t of g?.tags ?? []) {
      if (t?.id === from) {
        t.id = to;
        changed = true;
      }
    }
  }

  return { changed, value: catalog };
}

function updateTagsCatalogJsonForTagGroup(catalog, { from, to }) {
  if (!catalog || typeof catalog !== "object") return { changed: false, value: catalog };
  let changed = false;

  const prefixFrom = `${from}:`;
  const prefixTo = `${to}:`;

  for (const g of catalog.groups ?? []) {
    if (g?.id === from) {
      g.id = to;
      changed = true;
    }
    for (const t of g?.tags ?? []) {
      if (typeof t?.id === "string" && t.id.startsWith(prefixFrom)) {
        t.id = prefixTo + t.id.slice(prefixFrom.length);
        changed = true;
      }
    }
  }

  return { changed, value: catalog };
}

function updateStylesCatalogJson(catalog, { from, to }) {
  if (!catalog || typeof catalog !== "object") return { changed: false, value: catalog };
  let changed = false;
  for (const s of catalog.styles ?? []) {
    if (s?.id === from) {
      s.id = to;
      changed = true;
    }
  }
  return { changed, value: catalog };
}

function updateScenariosCatalogJson(catalog, { from, to }) {
  if (!catalog || typeof catalog !== "object") return { changed: false, value: catalog };
  let changed = false;
  for (const s of catalog.scenarios ?? []) {
    if (s?.id === from) {
      s.id = to;
      changed = true;
    }
  }
  return { changed, value: catalog };
}

function updatePalettesCatalogJson(catalog, { from, to }) {
  if (!catalog || typeof catalog !== "object") return { changed: false, value: catalog };
  let changed = false;
  for (const p of catalog.palettes ?? []) {
    if (p?.id === from) {
      p.id = to;
      changed = true;
    }
  }
  return { changed, value: catalog };
}

function updateCheckpointJson(checkpoint, { kind, from, to }) {
  if (!checkpoint || typeof checkpoint !== "object") return { changed: false, value: checkpoint };
  let changed = false;

  if (kind === "checkpoint" && checkpoint.id === from) {
    checkpoint.id = to;
    changed = true;
  }
  if (kind === "assetType") {
    const r = replaceInArray(checkpoint.supportedAssetTypes, from, to);
    if (r.changed) {
      checkpoint.supportedAssetTypes = r.value;
      changed = true;
    }
  }

  return { changed, value: checkpoint };
}

function updateLoraJson(lora, { kind, from, to }) {
  if (!lora || typeof lora !== "object") return { changed: false, value: lora };
  let changed = false;

  if (kind === "lora" && lora.id === from) {
    lora.id = to;
    changed = true;
  }
  if (kind === "checkpoint" && lora.checkpointId === from) {
    lora.checkpointId = to;
    changed = true;
  }
  if (kind === "assetType") {
    const r = replaceInArray(lora.assetTypes, from, to);
    if (r.changed) {
      lora.assetTypes = r.value;
      changed = true;
    }
  }

  return { changed, value: lora };
}

async function listProjects(dataRoot, projectId) {
  const projectsRoot = path.join(dataRoot, "projects");
  let names = [];
  try {
    names = await fs.readdir(projectsRoot);
  } catch {
    return [];
  }
  const dirs = [];
  for (const name of names) {
    if (projectId && name !== projectId) continue;
    const full = path.join(projectsRoot, name);
    try {
      const st = await fs.stat(full);
      if (st.isDirectory()) dirs.push({ id: name, dir: full });
    } catch {
      // ignore
    }
  }
  return dirs;
}

async function maybeRenameFile(absPath, nextAbsPath, dryRun, changedPaths) {
  if (absPath === nextAbsPath) return;
  changedPaths.add(absPath);
  changedPaths.add(nextAbsPath);
  if (dryRun) return;
  await fs.mkdir(path.dirname(nextAbsPath), { recursive: true });
  await fs.rename(absPath, nextAbsPath);
}

async function main() {
  const opts = parseArgs();
  if (!opts.kind || !opts.from || !opts.to) {
    usage();
    process.exit(1);
  }
  if (opts.from === opts.to) {
    console.log("No-op: --from and --to are identical.");
    process.exit(0);
  }

  const local = loadLocalConfig();
  const dataRoot = path.resolve(opts.dataRoot ?? local?.dataRoot ?? repoPath("data"));

  const kind = String(opts.kind);
  const from = String(opts.from);
  const to = String(opts.to);

  const changedFiles = new Set();

  const projects = await listProjects(dataRoot, opts.projectId);
  if (projects.length === 0) {
    console.log(`[migrate] No projects found under ${dataRoot}`);
  }

  async function processJsonFile(filePath, updateFn) {
    const before = await readJson(filePath);
    const result = updateFn(before);
    if (!result?.changed) return;
    changedFiles.add(filePath);
    if (opts.dryRun) return;
    await writeJson(filePath, result.value);
  }

  // Project-scoped files
  for (const p of projects) {
    const projectJson = path.join(p.dir, "project.json");
    await processJsonFile(projectJson, (v) => updateProjectJson(v, { kind, from, to }));

    // catalogs
    const catalogsDir = path.join(p.dir, "catalogs");
    const tagsCatalog = path.join(catalogsDir, "tags.json");
    if (kind === "tag") await processJsonFile(tagsCatalog, (v) => updateTagsCatalogJsonForTag(v, { from, to }));
    if (kind === "tagGroup") await processJsonFile(tagsCatalog, (v) => updateTagsCatalogJsonForTagGroup(v, { from, to }));
    if (kind === "assetType") {
      await processJsonFile(path.join(catalogsDir, "asset-types.json"), (v) => updateAssetTypesCatalogJson(v, { from, to }));
      // assetType tag IDs follow `assetType:<assetTypeId>`
      await processJsonFile(tagsCatalog, (v) => updateTagsCatalogJsonForTag(v, { from: `assetType:${from}`, to: `assetType:${to}` }));
    }
    if (kind === "style") await processJsonFile(path.join(catalogsDir, "styles.json"), (v) => updateStylesCatalogJson(v, { from, to }));
    if (kind === "scenario") await processJsonFile(path.join(catalogsDir, "scenarios.json"), (v) => updateScenariosCatalogJson(v, { from, to }));
    if (kind === "palette") await processJsonFile(path.join(catalogsDir, "palettes.json"), (v) => updatePalettesCatalogJson(v, { from, to }));

    // specs + assets
    const specFiles = await fg(["*.json"], { cwd: path.join(p.dir, "specs"), absolute: true });
    for (const f of specFiles) await processJsonFile(f, (v) => updateSpecJson(v, { kind, from, to }));

    const assetFiles = await fg(["*.json"], { cwd: path.join(p.dir, "assets"), absolute: true });
    for (const f of assetFiles) await processJsonFile(f, (v) => updateAssetJson(v, { kind, from, to }));

    // checkpoints
    const checkpointFiles = await fg(["*.json"], { cwd: path.join(p.dir, "checkpoints"), absolute: true });
    for (const f of checkpointFiles) await processJsonFile(f, (v) => updateCheckpointJson(v, { kind, from, to }));
    if (kind === "checkpoint") {
      const oldPath = path.join(p.dir, "checkpoints", `${from}.json`);
      const newPath = path.join(p.dir, "checkpoints", `${to}.json`);
      try {
        await fs.access(oldPath);
        await maybeRenameFile(oldPath, newPath, opts.dryRun, changedFiles);
      } catch {
        // ignore
      }
    }

    // project loras
    const loraFiles = await fg(["*.json"], { cwd: path.join(p.dir, "loras"), absolute: true });
    for (const f of loraFiles) await processJsonFile(f, (v) => updateLoraJson(v, { kind, from, to }));
    if (kind === "lora") {
      const oldPath = path.join(p.dir, "loras", `${from}.json`);
      const newPath = path.join(p.dir, "loras", `${to}.json`);
      try {
        await fs.access(oldPath);
        await maybeRenameFile(oldPath, newPath, opts.dryRun, changedFiles);
      } catch {
        // ignore
      }
    }
  }

  // Shared baseline loras
  const sharedLorasDir = path.join(dataRoot, "shared", "loras");
  const sharedLoraFiles = await fg(["*.json"], { cwd: sharedLorasDir, absolute: true });
  for (const f of sharedLoraFiles) await processJsonFile(f, (v) => updateLoraJson(v, { kind, from, to }));
  if (kind === "lora") {
    const oldPath = path.join(sharedLorasDir, `${from}.json`);
    const newPath = path.join(sharedLorasDir, `${to}.json`);
    try {
      await fs.access(oldPath);
      await maybeRenameFile(oldPath, newPath, opts.dryRun, changedFiles);
    } catch {
      // ignore
    }
  }

  const allChanged = [...new Set([...changedFiles])].sort((a, b) => a.localeCompare(b));
  if (allChanged.length === 0) {
    console.log("[migrate] No changes needed.");
    return;
  }

  console.log(`[migrate] ${opts.dryRun ? "Would change" : "Changed"} ${allChanged.length} file(s):`);
  for (const f of allChanged) {
    console.log(`- ${path.relative(repoPath(), f).replaceAll("\\", "/")}`);
  }
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});
