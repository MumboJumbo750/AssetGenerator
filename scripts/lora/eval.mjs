import fs from "node:fs/promises";
import path from "node:path";

import { ulid } from "ulid";

import { repoPath } from "../lib/paths.mjs";
import { loadLocalConfig } from "../lib/config.mjs";

async function readJson(p) {
  const raw = await fs.readFile(p, "utf8");
  return JSON.parse(raw);
}

async function writeJson(p, v) {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(v, null, 2) + "\n", "utf8");
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {
    projectId: "",
    scope: "project",
    loraId: "",
    releaseId: "",
    status: "pending",
    evalId: "",
    prompts: "",
    promptsFile: "",
    notes: "",
    dryRun: false
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--project") out.projectId = args[++i] ?? "";
    if (a === "--scope") out.scope = args[++i] ?? "project";
    if (a === "--lora") out.loraId = args[++i] ?? "";
    if (a === "--release") out.releaseId = args[++i] ?? "";
    if (a === "--status") out.status = args[++i] ?? "pending";
    if (a === "--eval") out.evalId = args[++i] ?? "";
    if (a === "--prompts") out.prompts = args[++i] ?? "";
    if (a === "--prompts-file") out.promptsFile = args[++i] ?? "";
    if (a === "--notes") out.notes = args[++i] ?? "";
    if (a === "--dry-run") out.dryRun = true;
  }
  return out;
}

function parsePrompts(raw) {
  if (!raw) return [];
  return raw
    .split("|")
    .map((p) => p.trim())
    .filter(Boolean);
}

async function main() {
  const { projectId, scope, loraId, releaseId, status, evalId, prompts, promptsFile, notes, dryRun } = parseArgs();
  if (!loraId) {
    console.log("Usage: npm run lora:eval -- --lora <loraId> --release <releaseId> [--project <projectId>] [--scope project|baseline]");
    console.log("  Prompts: --prompts \"p1|p2|p3\" or --prompts-file <path>");
    console.log("  Optional: --status <pending|running|complete> --eval <evalId> --notes <text> --dry-run");
    process.exit(1);
  }
  if (scope !== "project" && scope !== "baseline") {
    console.log("--scope must be 'project' or 'baseline'");
    process.exit(1);
  }
  if (scope === "project" && !projectId) {
    console.log("--project is required for scope=project");
    process.exit(1);
  }

  const local = loadLocalConfig();
  const dataRoot = local?.dataRoot ? path.resolve(local.dataRoot) : repoPath("data");

  const loraPath =
    scope === "baseline"
      ? path.join(dataRoot, "shared", "loras", `${loraId}.json`)
      : path.join(dataRoot, "projects", projectId, "loras", `${loraId}.json`);
  let lora;
  try {
    lora = await readJson(loraPath);
  } catch {
    console.error(`Could not read LoRA at ${loraPath}`);
    process.exit(1);
  }

  const release = (lora.releases ?? []).find((r) => r.id === releaseId);
  if (!release) {
    console.error(`Release ${releaseId} not found for ${loraId}`);
    process.exit(1);
  }

  let promptList = parsePrompts(prompts);
  if (promptsFile) {
    const filePath = path.isAbsolute(promptsFile) ? promptsFile : path.resolve(promptsFile);
    const fileRaw = await fs.readFile(filePath, "utf8");
    promptList = promptList.concat(parsePrompts(fileRaw.replace(/\r?\n/g, "|")));
  }
  promptList = promptList.map((p) => p.trim()).filter(Boolean);

  const evalRecord = {
    id: evalId || ulid(),
    loraId,
    releaseId,
    createdAt: new Date().toISOString(),
    status,
    prompts: promptList,
    outputs: [],
    notes: notes || undefined
  };

  const evalDir =
    scope === "baseline"
      ? path.join(dataRoot, "shared", "evals")
      : path.join(dataRoot, "projects", projectId, "evals");
  const evalPath = path.join(evalDir, `${evalRecord.id}.json`);

  if (!release.evaluation || typeof release.evaluation !== "object") {
    release.evaluation = {};
  }
  release.evaluation.evalId = evalRecord.id;
  release.evaluation.status = status;
  release.evaluation.prompts = promptList;

  lora.updatedAt = evalRecord.createdAt;

  if (dryRun) {
    console.log(`[lora] Would write eval ${evalPath}`);
    console.log(`[lora] Would update ${loraPath} release=${releaseId}`);
    return;
  }

  await writeJson(evalPath, evalRecord);
  await writeJson(loraPath, lora);
  console.log(`[lora] Wrote eval ${evalPath}`);
  console.log(`[lora] Updated ${loraPath}`);
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});
