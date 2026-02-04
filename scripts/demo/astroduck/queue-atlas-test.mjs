import fs from "node:fs/promises";
import path from "node:path";

import fg from "fast-glob";
import { ulid } from "ulid";

import { repoPath } from "../../lib/paths.mjs";
import { loadLocalConfig } from "../../lib/config.mjs";

function toPosix(p) {
  return p.replaceAll("\\", "/");
}

async function readJson(p) {
  const raw = await fs.readFile(p, "utf8");
  return JSON.parse(raw);
}

async function writeJson(p, v) {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(v, null, 2) + "\n", "utf8");
}

async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {
    projectId: "",
    planPath: repoPath("docs", "demo", "astroduck", "atlas-plan.json"),
    padding: 2,
    allowOriginal: false,
    exportId: "",
    dryRun: false
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--project") out.projectId = args[++i] ?? "";
    if (a === "--plan") out.planPath = args[++i] ?? out.planPath;
    if (a === "--padding") out.padding = Number(args[++i] ?? out.padding);
    if (a === "--allow-original") out.allowOriginal = true;
    if (a === "--export-id") out.exportId = args[++i] ?? "";
    if (a === "--dry-run") out.dryRun = true;
  }
  return out;
}

function nowIso() {
  return new Date().toISOString();
}

function pickLatestVersion(asset) {
  const versions = Array.isArray(asset?.versions) ? asset.versions : [];
  if (versions.length === 0) return null;
  return versions[versions.length - 1];
}

function pickVariantPaths(version, opts) {
  const variants = Array.isArray(version?.variants) ? version.variants : [];
  const sorted = [...variants].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const out = [];
  for (const v of sorted) {
    const rel = v.alphaPath ?? (opts.allowOriginal ? v.originalPath : null);
    if (!rel) continue;
    out.push({ variantId: String(v.id), path: String(rel), isAlpha: Boolean(v.alphaPath) });
  }
  return out;
}

async function loadSpecFrameHints(specDir, specIds) {
  const hints = new Map();
  for (const specId of specIds) {
    const specPath = path.join(specDir, `${specId}.json`);
    if (!(await fileExists(specPath))) continue;
    try {
      const spec = await readJson(specPath);
      const frameCount = spec?.output?.animation?.frameCount;
      if (Number.isFinite(frameCount) && frameCount > 0) hints.set(specId, frameCount);
    } catch {
      // ignore
    }
  }
  return hints;
}

async function main() {
  const { projectId, planPath, padding, allowOriginal, exportId, dryRun } = parseArgs();
  if (!projectId) {
    console.log("Usage: npm run demo:astroduck:queue-atlases -- --project <projectId> [--allow-original] [--padding 2] [--export-id <id>] [--dry-run]");
    process.exit(1);
  }

  const local = loadLocalConfig();
  const dataRoot = local?.dataRoot ? path.resolve(local.dataRoot) : repoPath("data");

  const projectRoot = path.join(dataRoot, "projects", projectId);
  const assetsDir = path.join(projectRoot, "assets");
  const specsDir = path.join(projectRoot, "specs");
  const jobsDir = path.join(projectRoot, "jobs");

  if (!(await fileExists(projectRoot))) {
    console.error(`[demo] Project not found: ${projectRoot}`);
    process.exit(1);
  }

  const plan = await readJson(planPath);
  const atlases = Array.isArray(plan?.atlases) ? plan.atlases : [];
  if (atlases.length === 0) {
    console.error(`[demo] No atlases found in plan: ${planPath}`);
    process.exit(1);
  }

  const allSpecIds = new Set(atlases.flatMap((a) => (Array.isArray(a.specIds) ? a.specIds : [])));
  const frameHints = await loadSpecFrameHints(specsDir, [...allSpecIds]);

  const assetFiles = await fg([path.join(assetsDir, "*.json")], { absolute: true });
  const assetsBySpecId = new Map();
  for (const file of assetFiles) {
    const asset = await readJson(file);
    if (!asset?.specId) continue;
    assetsBySpecId.set(String(asset.specId), asset);
  }

  const queued = [];
  for (const atlas of atlases) {
    const atlasId = String(atlas.atlasId ?? "");
    if (!atlasId) continue;
    const specIds = Array.isArray(atlas.specIds) ? atlas.specIds.map(String) : [];

    const framePaths = [];
    for (const specId of specIds) {
      const asset = assetsBySpecId.get(specId);
      if (!asset) {
        console.warn(`[demo] Missing asset for specId=${specId} (atlasId=${atlasId})`);
        continue;
      }
      const version = pickLatestVersion(asset);
      if (!version) continue;

      const variants = pickVariantPaths(version, { allowOriginal });
      const limit = frameHints.get(specId);
      const chosen = typeof limit === "number" ? variants.slice(0, limit) : variants;

      let idx = 0;
      for (const v of chosen) {
        idx++;
        const key = `${specId}__${String(idx).padStart(2, "0")}`;
        framePaths.push({ key, path: toPosix(v.path) });
      }
    }

    if (framePaths.length === 0) {
      console.warn(`[demo] No frames collected for atlasId=${atlasId}; skipping atlas_pack job.`);
      continue;
    }

    const jobId = ulid();
    const createdAt = nowIso();
    const job = {
      id: jobId,
      projectId,
      type: "atlas_pack",
      status: "queued",
      createdAt,
      updatedAt: createdAt,
      input: { atlasId, padding: Number.isFinite(padding) ? padding : 2, framePaths }
    };

    const jobPath = path.join(jobsDir, `${jobId}.json`);
    queued.push({ type: "atlas_pack", atlasId, jobPath, frames: framePaths.length });
    if (!dryRun) await writeJson(jobPath, job);
  }

  const atlasIds = queued.filter((q) => q.type === "atlas_pack").map((q) => q.atlasId);
  if (atlasIds.length > 0) {
    const jobId = ulid();
    const createdAt = nowIso();
    const expId = exportId || `export_astroduck_${jobId}`;
    const job = {
      id: jobId,
      projectId,
      type: "export",
      status: "queued",
      createdAt,
      updatedAt: createdAt,
      input: { exportId: expId, assetIds: [], atlasIds, animations: [], ui: [] }
    };
    const jobPath = path.join(jobsDir, `${jobId}.json`);
    queued.push({ type: "export", exportId: expId, jobPath, atlases: atlasIds.length });
    if (!dryRun) await writeJson(jobPath, job);
  } else {
    console.warn("[demo] No atlases were queued; export job not queued.");
  }

  console.log(`[demo] Plan: ${planPath}`);
  console.log(`[demo] projectId=${projectId} dataRoot=${dataRoot}`);
  console.log(`[demo] queued=${queued.length} (dryRun=${dryRun})`);
  for (const q of queued) {
    if (q.type === "atlas_pack") console.log(`- atlas_pack atlasId=${q.atlasId} frames=${q.frames} -> ${q.jobPath}`);
    if (q.type === "export") console.log(`- export exportId=${q.exportId} atlases=${q.atlases} -> ${q.jobPath}`);
  }
  console.log("");
  console.log("Next:");
  console.log("- Ensure bg removal is done for the variants you want (alphaPath).");
  console.log("- Run worker to process: npm run worker:dev (or: tsx apps/worker/src/worker.ts --once).");
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});

