import fs from "node:fs/promises";
import path from "node:path";

import { loadLocalConfig } from "../lib/config.mjs";
import { repoPath } from "../lib/paths.mjs";

function nowIso() {
  return new Date().toISOString();
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {
    scope: "all",
    projectId: "",
    dryRun: false,
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--scope") out.scope = args[++i] ?? "all";
    if (a === "--project") out.projectId = args[++i] ?? "";
    if (a === "--dry-run") out.dryRun = true;
  }
  return out;
}

async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function listProjectIds(projectsDir) {
  try {
    const entries = await fs.readdir(projectsDir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

function computeStatus(evalRecord) {
  const promptsLen = Array.isArray(evalRecord.prompts) ? evalRecord.prompts.length : 0;
  const outputsLen = Array.isArray(evalRecord.outputs) ? evalRecord.outputs.length : 0;
  if (promptsLen > 0 && outputsLen >= promptsLen) return "complete";
  if (outputsLen > 0) return "running";
  return "pending";
}

async function normalizeEvalFile(filePath, opts) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const evalRecord = JSON.parse(raw);
    const status = computeStatus(evalRecord);
    const needsStatus = evalRecord.status !== status;
    const needsUpdatedAt = !evalRecord.updatedAt;
    if (!needsStatus && !needsUpdatedAt) return { updated: false, status };

    const next = {
      ...evalRecord,
      status,
      updatedAt: nowIso(),
    };

    if (!opts.dryRun) {
      await fs.writeFile(filePath, JSON.stringify(next, null, 2) + "\n", "utf8");
    }
    return { updated: true, status };
  } catch (err) {
    return { updated: false, error: err?.message ?? String(err) };
  }
}

async function main() {
  const args = parseArgs();
  const local = loadLocalConfig();
  const dataRoot = local?.dataRoot ? path.resolve(local.dataRoot) : repoPath("data");
  const scope = args.scope ?? "all";

  const targets = [];
  if (scope === "all" || scope === "baseline") {
    targets.push({ label: "baseline", dir: path.join(dataRoot, "shared", "evals") });
  }

  if (scope === "all" || scope === "project") {
    const projectsDir = path.join(dataRoot, "projects");
    const projectIds = args.projectId ? [args.projectId] : await listProjectIds(projectsDir);
    for (const projectId of projectIds) {
      targets.push({ label: `project:${projectId}`, dir: path.join(projectsDir, projectId, "evals") });
    }
  }

  let updatedCount = 0;
  let scannedCount = 0;
  let errorCount = 0;

  for (const target of targets) {
    if (!(await fileExists(target.dir))) continue;
    const entries = await fs.readdir(target.dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      const filePath = path.join(target.dir, entry.name);
      scannedCount += 1;
      const result = await normalizeEvalFile(filePath, { dryRun: args.dryRun });
      if (result.error) {
        errorCount += 1;
        console.warn(`[normalize-evals] Failed ${filePath}: ${result.error}`);
        continue;
      }
      if (result.updated) updatedCount += 1;
    }
  }

  const dryRunLabel = args.dryRun ? " (dry-run)" : "";
  console.log(
    `[normalize-evals] Scanned ${scannedCount} evals${dryRunLabel}. Updated ${updatedCount}. Errors ${errorCount}.`,
  );
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});
