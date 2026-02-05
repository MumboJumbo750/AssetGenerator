import fs from "node:fs/promises";
import path from "node:path";

import { ulid } from "ulid";

import { repoPath, platformPaths } from "../lib/paths.mjs";
import { loadLocalConfig } from "../lib/config.mjs";
import { run } from "../lib/exec.mjs";

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
    dataset: "",
    releaseId: "",
    status: "candidate",
    dryRun: false,
    setActive: false,
    notes: "",
    adapter: "manual",
    runTraining: false,
    adapterArgs: "",
    accelerateConfig: "",
    weightsKind: "",
    weightsBase: "",
    weightsPath: "",
    weightsUri: "",
    sha256: "",
    configFile: "",
    configJson: "",
    resolution: "",
    steps: "",
    rank: "",
    learningRate: "",
    batchSize: "",
    epochs: "",
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--project") out.projectId = args[++i] ?? "";
    if (a === "--scope") out.scope = args[++i] ?? "project";
    if (a === "--lora") out.loraId = args[++i] ?? "";
    if (a === "--dataset") out.dataset = args[++i] ?? "";
    if (a === "--release") out.releaseId = args[++i] ?? "";
    if (a === "--status") out.status = args[++i] ?? "candidate";
    if (a === "--dry-run") out.dryRun = true;
    if (a === "--set-active") out.setActive = true;
    if (a === "--notes") out.notes = args[++i] ?? "";
    if (a === "--adapter") out.adapter = args[++i] ?? "manual";
    if (a === "--run") out.runTraining = true;
    if (a === "--adapter-args") out.adapterArgs = args[++i] ?? "";
    if (a === "--accelerate-config") out.accelerateConfig = args[++i] ?? "";
    if (a === "--weights-kind") out.weightsKind = args[++i] ?? "";
    if (a === "--weights-base") out.weightsBase = args[++i] ?? "";
    if (a === "--weights-path") out.weightsPath = args[++i] ?? "";
    if (a === "--weights-uri") out.weightsUri = args[++i] ?? "";
    if (a === "--sha256") out.sha256 = args[++i] ?? "";
    if (a === "--config") out.configJson = args[++i] ?? "";
    if (a === "--config-file") out.configFile = args[++i] ?? "";
    if (a === "--resolution") out.resolution = args[++i] ?? "";
    if (a === "--steps") out.steps = args[++i] ?? "";
    if (a === "--rank") out.rank = args[++i] ?? "";
    if (a === "--lr") out.learningRate = args[++i] ?? "";
    if (a === "--batch") out.batchSize = args[++i] ?? "";
    if (a === "--epochs") out.epochs = args[++i] ?? "";
  }
  return out;
}

function toNumber(value) {
  if (value === "" || value == null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function looksLikePath(value) {
  return value.includes("/") || value.includes("\\") || value.endsWith(".json") || value.startsWith(".");
}

async function resolveDatasetPath({ dataRoot, projectId, dataset }) {
  if (!dataset) return null;
  if (looksLikePath(dataset)) {
    const abs = path.isAbsolute(dataset) ? dataset : path.resolve(dataset);
    return abs;
  }
  if (projectId) {
    const projectPath = path.join(dataRoot, "projects", projectId, "datasets", `${dataset}.json`);
    try {
      await fs.access(projectPath);
      return projectPath;
    } catch {
      // ignore
    }
  }
  const sharedPath = path.join(dataRoot, "shared", "datasets", `${dataset}.json`);
  try {
    await fs.access(sharedPath);
    return sharedPath;
  } catch {
    return null;
  }
}

async function main() {
  const args = parseArgs();
  const {
    projectId,
    scope,
    loraId,
    dataset,
    releaseId,
    status,
    dryRun,
    setActive,
    notes,
    adapter,
    runTraining,
    adapterArgs,
    accelerateConfig,
    weightsKind,
    weightsBase,
    weightsPath,
    weightsUri,
    sha256,
    configFile,
    configJson,
    resolution,
    steps,
    rank,
    learningRate,
    batchSize,
    epochs,
  } = args;

  if (!loraId) {
    console.log(
      "Usage: npm run lora:train -- --lora <loraId> --dataset <datasetId|path> [--project <projectId>] [--scope project|baseline]",
    );
    console.log(
      "  Optional: --release <releaseId> --status <candidate|approved|deprecated> --set-active --notes <text>",
    );
    console.log(
      "  Config: --config <json> or --config-file <path> and/or --resolution/--steps/--rank/--lr/--batch/--epochs",
    );
    console.log(
      "  Adapter: --adapter <manual|kohya_ss> [--run] [--adapter-args <jsonArray>] [--accelerate-config <path>]",
    );
    console.log(
      "  Weights: --weights-kind <repo_relative|config_relative|absolute|external> --weights-base <modelsRoot|checkpointsRoot|lorasRoot> --weights-path <path> --weights-uri <uri>",
    );
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
  if (!["candidate", "approved", "deprecated"].includes(status)) {
    console.log("--status must be one of: candidate, approved, deprecated");
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
  } catch (err) {
    console.error(`Could not read LoRA at ${loraPath}`);
    process.exit(1);
  }

  const datasetPath = await resolveDatasetPath({ dataRoot, projectId, dataset });
  if (!datasetPath) {
    console.error("Dataset manifest not found. Provide --dataset <datasetId|path>.");
    process.exit(1);
  }

  let datasetManifest;
  try {
    datasetManifest = await readJson(datasetPath);
  } catch (err) {
    console.error(`Could not read dataset manifest at ${datasetPath}`);
    process.exit(1);
  }

  let config = {};
  if (configFile) {
    const configPath = path.isAbsolute(configFile) ? configFile : path.resolve(configFile);
    config = { ...config, ...(await readJson(configPath)) };
  }
  if (configJson) {
    try {
      config = { ...config, ...JSON.parse(configJson) };
    } catch {
      console.error("--config must be valid JSON");
      process.exit(1);
    }
  }
  const numericConfig = {
    resolution: toNumber(resolution),
    steps: toNumber(steps),
    rank: toNumber(rank),
    learningRate: toNumber(learningRate),
    batchSize: toNumber(batchSize),
    epochs: toNumber(epochs),
  };
  for (const [key, value] of Object.entries(numericConfig)) {
    if (value !== undefined) config[key] = value;
  }

  const release = {
    id: releaseId || ulid(),
    createdAt: new Date().toISOString(),
    status,
    notes: notes || undefined,
    training: {
      adapter: { kind: adapter },
      dataset: {
        id: datasetManifest?.id ?? null,
        scope: datasetManifest?.scope ?? null,
        projectId: datasetManifest?.projectId ?? null,
        path: datasetPath,
      },
      selection: datasetManifest?.selection ?? null,
      config,
    },
    evaluation: { status: "pending" },
  };

  if (weightsKind) {
    release.weights = {
      kind: weightsKind,
      base: weightsBase || undefined,
      path: weightsPath || undefined,
      uri: weightsUri || undefined,
      sha256: sha256 || undefined,
    };
  }

  if (runTraining && adapter === "kohya_ss") {
    if (!configFile) {
      console.error("kohya_ss adapter requires --config-file for training.");
      process.exit(1);
    }
    const kohyaDir = repoPath("tools", "lora", "kohya_ss");
    const venvDir = repoPath("tools", "lora", "kohya_ss", ".venv");
    const { venvPython } = platformPaths();
    const pythonInVenv = venvPython(venvDir);
    const trainScript = path.join(kohyaDir, "train_network.py");
    try {
      await fs.access(trainScript);
      await fs.access(pythonInVenv);
    } catch {
      console.error("kohya_ss not installed. Run: npm run lora:setup");
      process.exit(1);
    }

    let extraArgs = [];
    if (adapterArgs) {
      try {
        const parsed = JSON.parse(adapterArgs);
        if (!Array.isArray(parsed)) throw new Error("adapter-args must be a JSON array");
        extraArgs = parsed.map(String);
      } catch (err) {
        console.error('--adapter-args must be a JSON array, e.g. "[\\"--foo\\", \\"bar\\"]"');
        process.exit(1);
      }
    }

    const configPath = path.isAbsolute(configFile) ? configFile : path.resolve(configFile);
    const env = { ...process.env, ASSETGEN_DATASET: datasetPath, ASSETGEN_PROJECT: projectId ?? "" };
    if (accelerateConfig) {
      const acceleratePath = path.isAbsolute(accelerateConfig) ? accelerateConfig : path.resolve(accelerateConfig);
      await run(
        pythonInVenv,
        [
          "-m",
          "accelerate.commands.launch",
          "--config_file",
          acceleratePath,
          trainScript,
          "--config_file",
          configPath,
          ...extraArgs,
        ],
        { cwd: kohyaDir, env },
      );
    } else {
      await run(pythonInVenv, [trainScript, "--config_file", configPath, ...extraArgs], { cwd: kohyaDir, env });
    }
  }

  if (!Array.isArray(lora.releases)) lora.releases = [];
  if (lora.releases.some((r) => r.id === release.id)) {
    console.error(`Release id ${release.id} already exists for ${loraId}`);
    process.exit(1);
  }

  lora.releases.push(release);
  lora.updatedAt = release.createdAt;
  if (setActive) lora.activeReleaseId = release.id;

  if (dryRun) {
    console.log(`[lora] Would append release ${release.id} to ${loraPath}`);
    console.log(`[lora] dataset=${datasetPath}`);
    return;
  }

  await writeJson(loraPath, lora);
  console.log(`[lora] Updated ${loraPath}`);
  console.log(`[lora] release=${release.id}`);
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});
