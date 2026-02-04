import fs from "node:fs/promises";
import path from "node:path";

import { repoPath } from "../lib/paths.mjs";
import { loadLocalConfig } from "../lib/config.mjs";

async function readJson(p) {
  const raw = await fs.readFile(p, "utf8");
  return JSON.parse(raw);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {
    projectId: "",
    evalId: "",
    dryRun: false
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--project") out.projectId = args[++i] ?? "";
    if (a === "--eval") out.evalId = args[++i] ?? "";
    if (a === "--dry-run") out.dryRun = true;
  }
  return out;
}

async function main() {
  const { projectId, evalId, dryRun } = parseArgs();
  if (!projectId || !evalId) {
    console.log("Usage: npm run lora:cleanup-eval -- --project <projectId> --eval <evalId> [--dry-run]");
    process.exit(1);
  }

  const local = loadLocalConfig();
  const dataRoot = local?.dataRoot ? path.resolve(local.dataRoot) : repoPath("data");
  const specsDir = path.join(dataRoot, "projects", projectId, "specs");

  let removed = 0;
  const entries = await fs.readdir(specsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const specPath = path.join(specsDir, entry.name);
    try {
      const spec = await readJson(specPath);
      if (spec?.id && typeof spec.id === "string" && spec.id.startsWith(`eval_${evalId}_`)) {
        removed += 1;
        if (!dryRun) await fs.unlink(specPath);
      }
    } catch {
      // ignore bad specs
    }
  }

  if (dryRun) {
    console.log(`[eval-cleanup] Would remove ${removed} spec(s) for eval ${evalId}`);
    return;
  }
  console.log(`[eval-cleanup] Removed ${removed} spec(s) for eval ${evalId}`);
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});
