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
    loraId: "",
    releaseId: "",
    evalId: "",
    prompts: "",
    promptsFile: "",
    checkpointName: "",
    templateId: "txt2img",
    assetType: "",
    width: "",
    height: "",
    variants: "",
    dryRun: false,
    autoCleanup: false,
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--project") out.projectId = args[++i] ?? "";
    if (a === "--lora") out.loraId = args[++i] ?? "";
    if (a === "--release") out.releaseId = args[++i] ?? "";
    if (a === "--eval") out.evalId = args[++i] ?? "";
    if (a === "--prompts") out.prompts = args[++i] ?? "";
    if (a === "--prompts-file") out.promptsFile = args[++i] ?? "";
    if (a === "--checkpoint") out.checkpointName = args[++i] ?? "";
    if (a === "--template") out.templateId = args[++i] ?? "txt2img";
    if (a === "--asset-type") out.assetType = args[++i] ?? "";
    if (a === "--width") out.width = args[++i] ?? "";
    if (a === "--height") out.height = args[++i] ?? "";
    if (a === "--variants") out.variants = args[++i] ?? "";
    if (a === "--dry-run") out.dryRun = true;
    if (a === "--auto-cleanup") out.autoCleanup = true;
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

function toNumber(value) {
  if (value === "" || value == null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function main() {
  const args = parseArgs();
  const {
    projectId,
    loraId,
    releaseId,
    evalId,
    prompts,
    promptsFile,
    checkpointName,
    templateId,
    assetType,
    width,
    height,
    variants,
    dryRun,
    autoCleanup,
  } = args;

  if (!projectId || !loraId || !releaseId) {
    console.log("Usage: npm run lora:eval-grid -- --project <projectId> --lora <loraId> --release <releaseId>");
    console.log('  Prompts: --prompts "p1|p2" or --prompts-file <path>');
    console.log(
      "  Optional: --eval <evalId> --checkpoint <checkpointId> --template <id> --asset-type <type> --width <n> --height <n> --variants <n> --auto-cleanup",
    );
    process.exit(1);
  }

  const local = loadLocalConfig();
  const dataRoot = local?.dataRoot ? path.resolve(local.dataRoot) : repoPath("data");

  const loraPath = path.join(dataRoot, "projects", projectId, "loras", `${loraId}.json`);
  const lora = await readJson(loraPath);
  const release = (lora.releases ?? []).find((r) => r.id === releaseId);
  if (!release) {
    console.error(`Release ${releaseId} not found in ${loraId}`);
    process.exit(1);
  }

  let promptList = parsePrompts(prompts);
  if (promptsFile) {
    const filePath = path.isAbsolute(promptsFile) ? promptsFile : path.resolve(promptsFile);
    const fileRaw = await fs.readFile(filePath, "utf8");
    promptList = promptList.concat(parsePrompts(fileRaw.replace(/\r?\n/g, "|")));
  }
  promptList = promptList.map((p) => p.trim()).filter(Boolean);
  if (promptList.length === 0) {
    console.error("No prompts provided. Use --prompts or --prompts-file.");
    process.exit(1);
  }

  const evalRecordId = evalId || ulid();
  const evalPath = path.join(dataRoot, "projects", projectId, "evals", `${evalRecordId}.json`);
  const evalRecord = {
    id: evalRecordId,
    loraId,
    releaseId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: "running",
    prompts: promptList,
    outputs: [],
    autoCleanup: Boolean(autoCleanup),
  };

  const checkpoint = checkpointName || lora.checkpointId;
  const type = assetType || (Array.isArray(lora.assetTypes) && lora.assetTypes[0]) || "ui_icon";
  const widthValue = toNumber(width);
  const heightValue = toNumber(height);
  const variantsValue = toNumber(variants);

  const jobsDir = path.join(dataRoot, "projects", projectId, "jobs");
  const specsDir = path.join(dataRoot, "projects", projectId, "specs");

  const createdJobs = [];
  const createdSpecs = [];

  for (let i = 0; i < promptList.length; i++) {
    const prompt = promptList[i];
    const specId = `eval_${evalRecordId}_${i + 1}`;
    const spec = {
      id: specId,
      projectId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      title: `Eval: ${loraId} (${i + 1})`,
      assetType: type,
      checkpointId: checkpoint,
      style: "default",
      scenario: "default",
      prompt: {
        positive: prompt,
        negative: "",
      },
      generationParams: {
        ...(widthValue ? { width: widthValue } : {}),
        ...(heightValue ? { height: heightValue } : {}),
        ...(variantsValue ? { variants: variantsValue } : {}),
      },
      status: "ready",
    };

    const jobId = ulid();
    const createdAt = new Date().toISOString();
    const job = {
      id: jobId,
      projectId,
      type: "generate",
      status: "queued",
      createdAt,
      updatedAt: createdAt,
      input: {
        specId,
        templateId,
        checkpointName: checkpoint,
        eval: { evalId: evalRecordId, prompt },
      },
    };

    createdSpecs.push({ specId, spec });
    createdJobs.push({ jobId, job });
  }

  if (dryRun) {
    console.log(`[eval-grid] Would write eval ${evalPath}`);
    console.log(`[eval-grid] Would create ${createdSpecs.length} specs + ${createdJobs.length} jobs`);
    return;
  }

  await writeJson(evalPath, evalRecord);
  await fs.mkdir(specsDir, { recursive: true });
  await fs.mkdir(jobsDir, { recursive: true });
  for (const { specId, spec } of createdSpecs) {
    await writeJson(path.join(specsDir, `${specId}.json`), spec);
  }
  for (const { jobId, job } of createdJobs) {
    await writeJson(path.join(jobsDir, `${jobId}.json`), job);
  }

  console.log(`[eval-grid] Created eval ${evalRecordId} with ${createdJobs.length} jobs.`);
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});
