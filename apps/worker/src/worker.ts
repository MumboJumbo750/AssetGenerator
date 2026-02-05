import fs from "node:fs/promises";
import path from "node:path";

import { ulid } from "ulid";

import { repoPath, repoRootFromHere, toPosixPath } from "./lib/repo";
import { fileExists, readJson, writeJsonAtomic } from "./lib/json";
import { loadLocalConfig } from "./lib/localConfig";
import { sleep } from "./lib/sleep";
import { createJsonlLogger, type JsonlLogger } from "./lib/logging";

import { downloadImage, extractImagesFromHistory, getHistory, submitWorkflow } from "./adapters/comfyui";
import { removeBackground } from "./adapters/bgRemove";
import { packAtlas } from "./adapters/atlasPack";
import sharp from "sharp";

type Job = {
  id: string;
  projectId: string;
  type: "generate" | "bg_remove" | "atlas_pack" | "export";
  status: "queued" | "running" | "succeeded" | "failed" | "canceled";
  createdAt: string;
  updatedAt: string;
  input: Record<string, any>;
  output?: Record<string, any>;
  error?: string;
  logPath?: string;
};

type AssetSpec = {
  id: string;
  projectId: string;
  title: string;
  assetType: string;
  prompt: { positive: string; negative: string };
  generationParams?: Record<string, any>;
  output?: Record<string, any>;
};

type Asset = {
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
    generation: Record<string, any>;
    variants: Array<{
      id: string;
      originalPath: string;
      alphaPath?: string;
      previewPath?: string;
      tags?: string[];
      rating?: number;
      status?: "candidate" | "selected" | "rejected";
      processing?: Record<string, any>;
    }>;
  }>;
};

type ExportProfile = {
  id: string;
  projectId: string;
  name: string;
  type: "pixi_kit";
  createdAt: string;
  updatedAt: string;
  options: Record<string, any>;
};

function nowIso() {
  return new Date().toISOString();
}

type ComfyProgress = { value: number; max: number; percent: number };

function extractComfyProgress(history: any, promptId: string): ComfyProgress | null {
  const entry = history?.[promptId];
  if (!entry) return null;
  const status = entry?.status;
  if (status?.completed === true) return { value: 1, max: 1, percent: 100 };
  const messages: any[] = Array.isArray(status?.messages) ? status.messages : [];
  let lastProgress: any = null;
  for (const msg of messages) {
    if (!Array.isArray(msg) || msg.length < 2) continue;
    if (msg[0] === "progress" && msg[1]) lastProgress = msg[1];
  }
  if (!lastProgress) return null;
  const value = Number(lastProgress.value ?? lastProgress.step ?? 0);
  const max = Number(lastProgress.max ?? lastProgress.total ?? 0);
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return null;
  const percent = Math.max(0, Math.min(100, Math.round((value / max) * 100)));
  return { value, max, percent };
}

async function updateJobOutput(filePath: string, patch: Record<string, unknown>) {
  const job = await readJson<Job>(filePath);
  job.output = { ...(job.output ?? {}), ...patch };
  job.updatedAt = nowIso();
  await writeJsonAtomic(filePath, job);
}

async function writeWorkerHeartbeat(dataRoot: string, opts: { pid: number; intervalMs: number }) {
  const outPath = path.join(dataRoot, "runtime", "worker-heartbeat.json");
  const tmp = `${outPath}.tmp`;
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  const body = {
    ts: nowIso(),
    pid: opts.pid,
    pollIntervalMs: opts.intervalMs,
  };
  await fs.writeFile(tmp, JSON.stringify(body, null, 2) + "\n", "utf8");
  await fs.rename(tmp, outPath);
  return outPath;
}

async function listQueuedJobs(projectDir: string) {
  const jobsDir = path.join(projectDir, "jobs");
  try {
    const entries = await fs.readdir(jobsDir, { withFileTypes: true });
    const jobs: Array<{ filePath: string; job: Job }> = [];
    for (const e of entries) {
      if (!e.isFile() || !e.name.endsWith(".json")) continue;
      const filePath = path.join(jobsDir, e.name);
      const job = await readJson<Job>(filePath);
      if (job.status === "queued") jobs.push({ filePath, job });
    }
    jobs.sort((a, b) => a.job.createdAt.localeCompare(b.job.createdAt));
    return jobs;
  } catch {
    return [];
  }
}

function relToData(dataRoot: string, absPath: string) {
  return toPosixPath(path.relative(dataRoot, absPath));
}

async function upsertAsset(dataRoot: string, projectId: string, asset: Asset) {
  const assetPath = path.join(dataRoot, "projects", projectId, "assets", `${asset.id}.json`);
  await writeJsonAtomic(assetPath, asset);
}

async function loadAssetIfExists(dataRoot: string, projectId: string, assetId: string): Promise<Asset | null> {
  const assetPath = path.join(dataRoot, "projects", projectId, "assets", `${assetId}.json`);
  if (!(await fileExists(assetPath))) return null;
  return readJson<Asset>(assetPath);
}

function summarizeJobInput(input: Record<string, any>) {
  const out: Record<string, any> = { ...input };
  if (out.workflow) out.workflow = "[omitted workflow]";
  if (Array.isArray(out.nextJobs)) out.nextJobs = `[${out.nextJobs.length} chained jobs omitted]`;
  if (Array.isArray(out.framePaths) && out.framePaths.length > 100)
    out.framePaths = `[${out.framePaths.length} frames omitted]`;
  if (Array.isArray(out.assetIds) && out.assetIds.length > 200)
    out.assetIds = `[${out.assetIds.length} assetIds omitted]`;
  if (Array.isArray(out.atlasIds) && out.atlasIds.length > 200)
    out.atlasIds = `[${out.atlasIds.length} atlasIds omitted]`;
  return out;
}

type JobLoraInput = {
  loraId?: string;
  releaseId?: string;
  loraName?: string;
  weightPath?: string;
  localPath?: string;
  strengthModel?: number;
  strengthClip?: number;
  weight?: number;
};

type ResolvedJobLora = {
  loraId?: string;
  releaseId?: string;
  loraName: string;
  strengthModel: number;
  strengthClip: number;
};

function normalizePathLike(value: string) {
  return value.replace(/\\/g, "/");
}

function resolveJobLoras(raw: unknown): ResolvedJobLora[] {
  if (!Array.isArray(raw)) return [];
  const resolved: ResolvedJobLora[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const lora = entry as JobLoraInput;
    const loraNameRaw = String(lora.loraName ?? lora.weightPath ?? lora.localPath ?? lora.loraId ?? "").trim();
    if (!loraNameRaw) continue;
    const strengthModelRaw = Number(lora.strengthModel ?? lora.weight ?? 1);
    const strengthModel = Number.isFinite(strengthModelRaw) ? strengthModelRaw : 1;
    const strengthClipRaw = Number(lora.strengthClip ?? strengthModel);
    const strengthClip = Number.isFinite(strengthClipRaw) ? strengthClipRaw : strengthModel;
    resolved.push({
      ...(lora.loraId ? { loraId: String(lora.loraId) } : {}),
      ...(lora.releaseId ? { releaseId: String(lora.releaseId) } : {}),
      loraName: normalizePathLike(loraNameRaw),
      strengthModel,
      strengthClip,
    });
  }
  return resolved;
}

function applyLoraChainToWorkflow(opts: { workflow: any; baseNodeId: string; loras: ResolvedJobLora[] }) {
  const { workflow, baseNodeId, loras } = opts;
  if (!workflow?.[baseNodeId]?.inputs || loras.length === 0) return { addedNodes: 0, applied: 0 };

  const baseNode = workflow[baseNodeId];
  const baseInputs = baseNode.inputs ?? {};

  const first = loras[0];
  baseInputs.lora_name = first.loraName;
  baseInputs.strength_model = first.strengthModel;
  baseInputs.strength_clip = first.strengthClip;

  let prevNodeId = String(baseNodeId);
  const addedNodeIds: string[] = [];
  const nextNodeId = () => {
    const max = Object.keys(workflow)
      .map((key) => Number(key))
      .filter((num) => Number.isFinite(num))
      .reduce((acc, num) => Math.max(acc, num), 0);
    return String(max + 1);
  };

  for (let idx = 1; idx < loras.length; idx += 1) {
    const lora = loras[idx];
    const nodeId = nextNodeId();
    workflow[nodeId] = {
      class_type: baseNode.class_type,
      inputs: {
        ...baseInputs,
        model: [prevNodeId, 0],
        clip: [prevNodeId, 1],
        lora_name: lora.loraName,
        strength_model: lora.strengthModel,
        strength_clip: lora.strengthClip,
      },
    };
    addedNodeIds.push(nodeId);
    prevNodeId = nodeId;
  }

  if (addedNodeIds.length > 0) {
    for (const [nodeId, node] of Object.entries<any>(workflow)) {
      if (nodeId === String(baseNodeId) || addedNodeIds.includes(nodeId)) continue;
      if (!node?.inputs || typeof node.inputs !== "object") continue;
      for (const [inputKey, inputValue] of Object.entries<any>(node.inputs)) {
        if (
          Array.isArray(inputValue) &&
          inputValue.length >= 2 &&
          String(inputValue[0]) === String(baseNodeId) &&
          (inputValue[1] === 0 || inputValue[1] === 1)
        ) {
          node.inputs[inputKey] = [prevNodeId, inputValue[1]];
        }
      }
    }
  }

  return { addedNodes: addedNodeIds.length, applied: loras.length };
}

function resolveTemplateValue(
  value: unknown,
  ctx: { input: Record<string, any>; output: Record<string, any>; projectId: string; jobId: string },
): unknown {
  if (typeof value === "string") {
    if (value === "$projectId") return ctx.projectId;
    if (value === "$jobId") return ctx.jobId;
    const outputMatch = value.match(/^\$output\.([a-zA-Z0-9_]+)$/);
    if (outputMatch) return ctx.output?.[outputMatch[1]];
    const inputMatch = value.match(/^\$input\.([a-zA-Z0-9_]+)$/);
    if (inputMatch) return ctx.input?.[inputMatch[1]];
    return value;
  }
  if (Array.isArray(value)) return value.map((v) => resolveTemplateValue(v, ctx));
  if (value && typeof value === "object") {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) out[k] = resolveTemplateValue(v, ctx);
    return out;
  }
  return value;
}

async function enqueueNextJobs(opts: {
  dataRoot: string;
  projectId: string;
  jobId: string;
  input: Record<string, any>;
  output: Record<string, any>;
}) {
  const nextJobs = Array.isArray(opts.input.nextJobs)
    ? (opts.input.nextJobs as Array<{ type?: Job["type"]; input?: Record<string, any> }>)
    : [];
  if (nextJobs.length === 0) return [];
  const jobsDir = path.join(opts.dataRoot, "projects", opts.projectId, "jobs");
  await fs.mkdir(jobsDir, { recursive: true });

  const created: string[] = [];
  for (const next of nextJobs) {
    const type = next?.type;
    if (!type) continue;
    const input = resolveTemplateValue(next?.input ?? {}, {
      input: opts.input,
      output: opts.output ?? {},
      projectId: opts.projectId,
      jobId: opts.jobId,
    }) as Record<string, any>;
    const id = ulid();
    const createdAt = nowIso();
    const job: Job = {
      id,
      projectId: opts.projectId,
      type,
      status: "queued",
      createdAt,
      updatedAt: createdAt,
      input,
    };
    await writeJsonAtomic(path.join(jobsDir, `${id}.json`), job);
    created.push(id);
  }
  return created;
}

async function acquireProjectLock(opts: { dataRoot: string; projectId: string; ttlMs: number }) {
  const locksDir = path.join(opts.dataRoot, "runtime", "worker-locks");
  await fs.mkdir(locksDir, { recursive: true });
  const lockPath = path.join(locksDir, `${opts.projectId}.json`);
  const now = Date.now();
  try {
    const handle = await fs.open(lockPath, "wx");
    try {
      await handle.writeFile(JSON.stringify({ projectId: opts.projectId, ts: now }) + "\n", "utf8");
      return { acquired: true, lockPath };
    } finally {
      await handle.close();
    }
  } catch {
    try {
      const raw = await fs.readFile(lockPath, "utf8");
      const data = JSON.parse(raw) as { ts?: number };
      if (typeof data?.ts === "number" && now - data.ts < opts.ttlMs) return { acquired: false, lockPath };
    } catch {
      return { acquired: false, lockPath };
    }
    await fs.writeFile(lockPath, JSON.stringify({ projectId: opts.projectId, ts: now }) + "\n", "utf8");
    return { acquired: true, lockPath };
  }
}

async function releaseProjectLock(lockPath: string) {
  try {
    await fs.unlink(lockPath);
  } catch {
    // ignore
  }
}

async function processGenerateJob(opts: {
  repoRoot: string;
  dataRoot: string;
  comfyBaseUrl: string;
  job: Job;
  log?: JsonlLogger;
  jobFilePath?: string;
}) {
  const { job } = opts;
  const specId = String(job.input.specId ?? "");
  if (!specId) throw new Error("generate job missing input.specId");

  const specPath = path.join(opts.dataRoot, "projects", job.projectId, "specs", `${specId}.json`);
  if (!(await fileExists(specPath))) throw new Error(`Spec not found: ${specPath}`);
  const spec = await readJson<AssetSpec>(specPath);
  const resolvedLoras = resolveJobLoras(job.input.loras);
  const loraSelection =
    job.input.loraSelection && typeof job.input.loraSelection === "object" ? job.input.loraSelection : null;

  let workflow = job.input.workflow;
  if (!workflow) {
    const templateId = String(job.input.templateId ?? job.input.template ?? "txt2img");
    const templatePath = path.join(opts.repoRoot, "pipeline", "comfyui", "workflows", `${templateId}.json`);
    if (!(await fileExists(templatePath))) {
      throw new Error(`generate job missing input.workflow and template not found: ${templatePath}`);
    }

    workflow = await readJson<any>(templatePath);

    const bindingsPath = path.join(opts.repoRoot, "pipeline", "comfyui", "workflows", `${templateId}.bindings.json`);
    const bindings = (await fileExists(bindingsPath)) ? await readJson<any>(bindingsPath) : null;

    const checkpointName = String(job.input.checkpointName ?? "");
    if (!checkpointName) throw new Error("generate job missing input.checkpointName (ComfyUI ckpt_name)");

    const checkpointPath = path.join(opts.dataRoot, "projects", job.projectId, "checkpoints", `${checkpointName}.json`);
    const checkpoint = (await fileExists(checkpointPath)) ? await readJson<any>(checkpointPath) : null;

    const specPositive = String(spec.prompt?.positive ?? "");
    const specNegative = String(spec.prompt?.negative ?? "");
    const basePositive = String(checkpoint?.promptTemplates?.basePositive ?? "");
    const baseNegative = String(checkpoint?.promptTemplates?.baseNegative ?? "");
    const perAsset = checkpoint?.promptTemplates?.perAssetType?.[spec.assetType] ?? {};
    const perPositive = String(perAsset?.positive ?? "");
    const perNegative = String(perAsset?.negative ?? "");

    const renderTemplate = (template: string, fallback: string) => {
      if (!template) return fallback;
      if (template.includes("{specPrompt}")) return template.replace("{specPrompt}", fallback);
      return [template, fallback].filter(Boolean).join(", ");
    };

    const renderedPositive = renderTemplate(perPositive || basePositive, specPositive);
    const renderedNegative = renderTemplate(perNegative || baseNegative, specNegative);

    const positive = String(job.input.positive ?? renderedPositive);
    const negative = String(job.input.negative ?? renderedNegative);
    const width = Number(
      job.input.width ??
        spec.generationParams?.width ??
        spec.generationParams?.w ??
        checkpoint?.defaultGenerationParams?.width ??
        512,
    );
    const height = Number(
      job.input.height ??
        spec.generationParams?.height ??
        spec.generationParams?.h ??
        checkpoint?.defaultGenerationParams?.height ??
        512,
    );
    const variants = Number(
      job.input.variants ?? spec.generationParams?.variants ?? checkpoint?.defaultGenerationParams?.variants ?? 4,
    );
    const seed = Number(job.input.seed ?? Math.floor(Math.random() * 1_000_000_000));
    const steps = Number(
      job.input.steps ?? spec.generationParams?.steps ?? checkpoint?.defaultGenerationParams?.steps ?? 20,
    );
    const cfg = Number(job.input.cfg ?? spec.generationParams?.cfg ?? checkpoint?.defaultGenerationParams?.cfg ?? 7);
    const sampler = String(
      job.input.sampler_name ?? job.input.sampler ?? checkpoint?.defaultGenerationParams?.sampler ?? "euler",
    );
    const scheduler = String(job.input.scheduler ?? checkpoint?.defaultGenerationParams?.scheduler ?? "normal");
    const vae = String(job.input.vae ?? spec.generationParams?.vae ?? checkpoint?.defaultGenerationParams?.vae ?? "");
    const clipSkipRaw =
      job.input.clip_skip ??
      job.input.clipSkip ??
      spec.generationParams?.clip_skip ??
      spec.generationParams?.clipSkip ??
      checkpoint?.defaultGenerationParams?.clip_skip ??
      checkpoint?.defaultGenerationParams?.clipSkip ??
      null;
    const clipSkipVal = clipSkipRaw === "" || clipSkipRaw === null ? null : Number(clipSkipRaw);

    const filenamePrefix = String(job.input.filenamePrefix ?? `assetgen/${job.projectId}/${spec.id}`);

    const apply = (key: string, value: any) => {
      if (!bindings?.[key]) return;
      const { node, input } = bindings[key];
      if (!workflow?.[node]?.inputs) return;
      workflow[node].inputs[input] = value;
    };

    apply("checkpoint", checkpointName);
    if (vae) {
      apply("vae", vae);
      if (bindings?.vae?.node) {
        apply("vae_target", [bindings.vae.node, 0]);
      }
    }
    if (clipSkipVal !== null && Number.isFinite(clipSkipVal)) {
      const stopAt = clipSkipVal > 0 ? -clipSkipVal : clipSkipVal;
      apply("clip_skip", stopAt);
    }
    const primaryLora = resolvedLoras[0];
    if (primaryLora) {
      apply("lora_name", primaryLora.loraName);
      apply("lora_strength_model", primaryLora.strengthModel);
      apply("lora_strength_clip", primaryLora.strengthClip);
    }
    if (resolvedLoras.length > 0) {
      const loraNodeId = bindings?.lora_name?.node ? String(bindings.lora_name.node) : "";
      if (loraNodeId && workflow?.[loraNodeId]?.inputs) {
        const chainResult = applyLoraChainToWorkflow({ workflow, baseNodeId: loraNodeId, loras: resolvedLoras });
        if (chainResult.applied > 0) {
          await opts.log?.info("lora_chain_applied", {
            applied: chainResult.applied,
            addedNodes: chainResult.addedNodes,
          });
        }
      } else {
        await opts.log?.warn("lora_binding_missing", {
          templateId,
          reason: "bindings.lora_name is not defined",
          loras: resolvedLoras.map((item) => ({
            loraId: item.loraId ?? null,
            releaseId: item.releaseId ?? null,
            loraName: item.loraName,
          })),
        });
      }
    }
    apply("positive", positive);
    apply("negative", negative);
    apply("width", width);
    apply("height", height);
    apply("batch_size", variants);
    apply("seed", seed);
    apply("steps", steps);
    apply("cfg", cfg);
    apply("sampler_name", sampler);
    apply("scheduler", scheduler);
    apply("filename_prefix", filenamePrefix);
  }

  const assetId = String(job.input.assetId ?? ulid());
  const assetVersionId = ulid();
  const sequenceId = typeof job.input.sequenceId === "string" ? String(job.input.sequenceId) : "";
  const frameIndexRaw = job.input.frameIndex ?? job.input.frame ?? null;
  const frameIndex = Number(frameIndexRaw);
  const frameCountRaw = job.input.frameCount ?? null;
  const frameCount = Number(frameCountRaw);
  const frameName = typeof job.input.frameName === "string" ? String(job.input.frameName) : "";
  const framePrompt = typeof job.input.framePrompt === "string" ? String(job.input.framePrompt) : "";

  await opts.log?.info("comfyui_submit", { templateId: job.input.templateId ?? job.input.template ?? "txt2img" });
  const { promptId } = await submitWorkflow({ baseUrl: opts.comfyBaseUrl, workflow });
  await opts.log?.info("comfyui_submitted", { promptId });
  if (opts.jobFilePath) {
    await updateJobOutput(opts.jobFilePath, { promptId });
  }

  // Poll history for outputs.
  const timeoutMs = Number(job.input.timeoutMs ?? 10 * 60 * 1000);
  const start = Date.now();
  let images: any[] = [];
  let lastPercent = -1;
  let lastProgressWrite = 0;
  while (Date.now() - start < timeoutMs) {
    const history = await getHistory({ baseUrl: opts.comfyBaseUrl, promptId });
    images = extractImagesFromHistory(history, promptId);
    const progress = extractComfyProgress(history, promptId);
    if (progress && opts.jobFilePath) {
      const now = Date.now();
      if (progress.percent !== lastPercent && now - lastProgressWrite > 750) {
        await updateJobOutput(opts.jobFilePath, { promptId, progress });
        lastPercent = progress.percent;
        lastProgressWrite = now;
      }
    }
    if (images.length > 0) break;
    await sleep(750);
  }
  if (images.length === 0) throw new Error(`Timed out waiting for ComfyUI outputs (promptId=${promptId}).`);
  await opts.log?.info("comfyui_outputs_ready", { count: images.length });

  const originalsDir = path.join(opts.dataRoot, "projects", job.projectId, "files", "images", assetId, "original");
  await fs.mkdir(originalsDir, { recursive: true });

  const variants: Asset["versions"][number]["variants"] = [];
  let i = 0;
  for (const img of images) {
    i++;
    const variantId = ulid();
    const data = await downloadImage({ baseUrl: opts.comfyBaseUrl, ref: img });
    const outAbs = path.join(originalsDir, `${variantId}.png`);
    await fs.writeFile(outAbs, data);
    variants.push({ id: variantId, originalPath: relToData(opts.dataRoot, outAbs), status: "candidate" });
  }

  const existing = await loadAssetIfExists(opts.dataRoot, job.projectId, assetId);
  const base: Asset =
    existing ??
    ({
      id: assetId,
      projectId: job.projectId,
      specId: spec.id,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      versions: [],
    } satisfies Asset);

  base.updatedAt = nowIso();
  base.versions.push({
    id: assetVersionId,
    createdAt: nowIso(),
    status: "review",
    generation: {
      promptId,
      spec: { id: spec.id, title: spec.title, assetType: spec.assetType },
      workflow: job.input.workflow,
      // Keeping prompt examples here for traceability; the true resolved prompt should also be stored once we add templates.
      promptExample: { positive: spec.prompt.positive, negative: spec.prompt.negative },
      ...(resolvedLoras.length > 0
        ? {
            loras: resolvedLoras.map((item) => ({
              loraId: item.loraId ?? null,
              releaseId: item.releaseId ?? null,
              loraName: item.loraName,
              strengthModel: item.strengthModel,
              strengthClip: item.strengthClip,
            })),
          }
        : {}),
      ...(loraSelection ? { loraSelection } : {}),
      ...(sequenceId ? { sequenceId } : {}),
      ...(Number.isFinite(frameIndex) ? { frameIndex } : {}),
      ...(Number.isFinite(frameCount) ? { frameCount } : {}),
      ...(frameName ? { frameName } : {}),
      ...(framePrompt ? { framePrompt } : {}),
    },
    variants,
  });

  await upsertAsset(opts.dataRoot, job.projectId, base);

  await opts.log?.info("asset_written", { assetId, assetVersionId, variants: variants.length });

  const wantsTransparent = spec.output?.background === "transparent_required";
  const autoBgRemove =
    typeof spec.generationParams?.autoBgRemove === "boolean"
      ? Boolean(spec.generationParams.autoBgRemove)
      : wantsTransparent;
  if (autoBgRemove && variants.length > 0) {
    const nextJobs = variants.map((variant) => ({
      type: "bg_remove" as const,
      input: { originalPath: variant.originalPath },
    }));
    const chained = await enqueueNextJobs({
      dataRoot: opts.dataRoot,
      projectId: job.projectId,
      jobId: job.id,
      input: { nextJobs },
      output: {},
    });
    if (chained.length > 0) {
      await opts.log?.info("auto_bg_remove_queued", { count: chained.length });
    }
  }

  const evalMeta = job.input.eval && typeof job.input.eval === "object" ? job.input.eval : null;
  if (evalMeta?.evalId) {
    const evalId = String(evalMeta.evalId);
    const prompt = String(evalMeta.prompt ?? spec.prompt.positive ?? "");
    const evalPath = path.join(opts.dataRoot, "projects", job.projectId, "evals", `${evalId}.json`);
    if (await fileExists(evalPath)) {
      try {
        const evalRecord = await readJson<any>(evalPath);
        const outputs = Array.isArray(evalRecord.outputs) ? evalRecord.outputs : [];
        outputs.push({
          prompt,
          images: variants.map((v) => v.originalPath),
          assetId,
          assetVersionId,
        });
        evalRecord.outputs = outputs;
        evalRecord.updatedAt = nowIso();
        const totalPrompts = Array.isArray(evalRecord.prompts) ? evalRecord.prompts.length : 0;
        if (totalPrompts > 0 && outputs.length >= totalPrompts) {
          evalRecord.status = "complete";
        } else if (!evalRecord.status || evalRecord.status === "pending") {
          evalRecord.status = "running";
        }
        await writeJsonAtomic(evalPath, evalRecord);
        if (evalRecord.autoCleanup && evalRecord.status === "complete") {
          const specsDir = path.join(opts.dataRoot, "projects", job.projectId, "specs");
          try {
            const entries = await fs.readdir(specsDir, { withFileTypes: true });
            for (const entry of entries) {
              if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
              const specPath = path.join(specsDir, entry.name);
              try {
                const spec = await readJson<any>(specPath);
                if (spec?.id && typeof spec.id === "string" && spec.id.startsWith(`eval_${evalId}_`)) {
                  await fs.unlink(specPath);
                }
              } catch {
                // ignore
              }
            }
            await opts.log?.info("eval_auto_cleanup", { evalId });
          } catch (err) {
            const error = err as any;
            await opts.log?.warn("eval_auto_cleanup_failed", { evalId, error: error?.message ?? String(error) });
          }
        }
      } catch (err) {
        const error = err as any;
        await opts.log?.error("eval_update_failed", {
          evalId,
          error: { message: error?.message ?? String(error), stack: error?.stack },
        });
      }
    } else {
      await opts.log?.warn("eval_missing", { evalId, evalPath });
    }
  }

  return {
    assetId,
    assetVersionId,
    variantIds: variants.map((v) => v.id),
    originalsDir: relToData(opts.dataRoot, originalsDir),
  };
}

async function processBgRemoveJob(opts: { repoRoot: string; dataRoot: string; job: Job; log?: JsonlLogger }) {
  const { job } = opts;
  const originalPathRel = String(job.input.originalPath ?? "");
  if (!originalPathRel) throw new Error("bg_remove job missing input.originalPath (data-relative path)");
  const originalAbs = path.join(opts.dataRoot, originalPathRel);
  if (!(await fileExists(originalAbs))) throw new Error(`Original image not found: ${originalAbs}`);

  const outputRel = String(job.input.alphaPath ?? "");
  const alphaAbs = outputRel
    ? path.join(opts.dataRoot, outputRel)
    : originalAbs.replace(/\/original\//g, "/alpha/").replace(/\\original\\/g, "\\alpha\\");
  await fs.mkdir(path.dirname(alphaAbs), { recursive: true });

  const threshold = typeof job.input.threshold === "number" ? Number(job.input.threshold) : undefined;
  const feather = typeof job.input.feather === "number" ? Number(job.input.feather) : undefined;
  const erode = typeof job.input.erode === "number" ? Number(job.input.erode) : undefined;

  await opts.log?.info("bg_remove_start", {
    originalPath: originalPathRel,
    alphaPath: relToData(opts.dataRoot, alphaAbs),
    params: { threshold, feather, erode },
  });
  await removeBackground({
    repoRoot: opts.repoRoot,
    inputPath: originalAbs,
    outputPath: alphaAbs,
    threshold,
    feather,
    erode,
    log: opts.log,
  });
  await opts.log?.info("bg_remove_done", { alphaPath: relToData(opts.dataRoot, alphaAbs) });

  const assetId = job.input.assetId ? String(job.input.assetId) : "";
  const versionId = job.input.versionId ? String(job.input.versionId) : "";
  const variantId = job.input.variantId ? String(job.input.variantId) : "";
  if (assetId && versionId && variantId) {
    const asset = await loadAssetIfExists(opts.dataRoot, job.projectId, assetId);
    if (asset) {
      const version = asset.versions.find((v) => v.id === versionId);
      const variant = version?.variants.find((v) => v.id === variantId);
      if (version && variant) {
        variant.alphaPath = relToData(opts.dataRoot, alphaAbs);
        variant.processing = {
          ...(variant.processing ?? {}),
          bg_remove: { threshold, feather, erode },
        };
        asset.updatedAt = nowIso();
        await upsertAsset(opts.dataRoot, job.projectId, asset);
      }
    }
  }

  return { alphaPath: relToData(opts.dataRoot, alphaAbs), params: { threshold, feather, erode } };
}

async function processAtlasPackJob(opts: { dataRoot: string; job: Job; log?: JsonlLogger }) {
  const { job } = opts;
  const framePaths = job.input.framePaths as unknown;
  if (!Array.isArray(framePaths) || framePaths.length === 0)
    throw new Error("atlas_pack job missing input.framePaths[] (data-relative)");

  const atlasId = String(job.input.atlasId ?? ulid());
  const atlasDir = path.join(opts.dataRoot, "projects", job.projectId, "files", "atlases", atlasId);
  const atlasPng = path.join(atlasDir, "atlas.png");
  const atlasJson = path.join(atlasDir, "atlas.json");
  const padding = Number(job.input.padding ?? 2);
  const maxSize = Number(job.input.maxSize ?? 2048);
  const powerOfTwo = Boolean(job.input.powerOfTwo ?? false);
  const trim = Boolean(job.input.trim ?? false);
  const extrude = Number(job.input.extrude ?? 0);
  const sort = typeof job.input.sort === "string" ? String(job.input.sort) : undefined;

  const frames = framePaths.map((p: any, idx: number) => ({
    key: String(p.key ?? `frame_${idx}`),
    absPath: path.join(opts.dataRoot, String(p.path ?? p)),
  }));

  await opts.log?.info("atlas_pack_start", {
    atlasId,
    frames: frames.length,
    padding,
    maxSize,
    powerOfTwo,
    trim,
    extrude,
    sort,
  });
  const packed = await packAtlas({
    frames,
    atlasAbsPngPath: atlasPng,
    atlasAbsJsonPath: atlasJson,
    padding,
    maxSize,
    powerOfTwo,
    trim,
    extrude,
    sort: (sort as any) ?? "area",
  });
  await opts.log?.info("atlas_pack_done", {
    atlasId,
    frames: packed.frames.length,
    atlasImagePath: relToData(opts.dataRoot, atlasPng),
  });

  // Write engine-agnostic atlas record.
  const atlasRecord = {
    id: atlasId,
    projectId: job.projectId,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    imagePath: relToData(opts.dataRoot, atlasPng),
    packSettings: { padding, maxSize, powerOfTwo, trim, extrude, sort: sort ?? "area" },
    frames: packed.frames.map((f) => ({
      id: f.key,
      sourcePath: relToData(opts.dataRoot, f.sourcePath),
      rect: f.rect,
      sourceSize: { w: f.rect.w, h: f.rect.h },
    })),
  };

  await writeJsonAtomic(path.join(opts.dataRoot, "projects", job.projectId, "atlases", `${atlasId}.json`), atlasRecord);

  return {
    atlasId,
    atlasImagePath: relToData(opts.dataRoot, atlasPng),
    atlasDataPath: relToData(opts.dataRoot, atlasJson),
  };
}

async function processExportJob(opts: { dataRoot: string; job: Job; log?: JsonlLogger }) {
  const { job } = opts;
  const exportId = String(job.input.exportId ?? ulid());
  const kitRoot = path.join(opts.dataRoot, "projects", job.projectId, "files", "exports", exportId, "pixi-kit");
  const assetsDir = path.join(kitRoot, "assets");
  const imagesDir = path.join(assetsDir, "images");
  const atlasesDir = path.join(assetsDir, "atlases");
  const srcDir = path.join(kitRoot, "src");

  await fs.mkdir(imagesDir, { recursive: true });
  await fs.mkdir(atlasesDir, { recursive: true });
  await fs.mkdir(srcDir, { recursive: true });

  const assetIds = Array.isArray(job.input.assetIds) ? (job.input.assetIds as string[]) : [];
  const atlasIds = Array.isArray(job.input.atlasIds) ? (job.input.atlasIds as string[]) : [];

  const profileId = typeof job.input.profileId === "string" ? String(job.input.profileId) : "";
  const profileSnapshot =
    typeof job.input.profileSnapshot === "object" && job.input.profileSnapshot
      ? (job.input.profileSnapshot as ExportProfile)
      : null;
  const profileFromDisk = async () => {
    if (!profileId) return null;
    const filePath = path.join(opts.dataRoot, "projects", job.projectId, "export-profiles", `${profileId}.json`);
    if (!(await fileExists(filePath))) throw new Error(`export profile not found: ${profileId}`);
    return readJson<ExportProfile>(filePath);
  };
  const profile = profileSnapshot ?? (await profileFromDisk());
  const profileOptions = profile?.options ?? {};
  const scale = typeof profileOptions.scale === "number" && profileOptions.scale > 0 ? Number(profileOptions.scale) : 1;
  const trim = Boolean(profileOptions.trim ?? false);
  const padding =
    typeof profileOptions.padding === "number" && profileOptions.padding > 0 ? Number(profileOptions.padding) : 0;
  const namePrefix = typeof profileOptions.namePrefix === "string" ? profileOptions.namePrefix : "";
  const nameSuffix = typeof profileOptions.nameSuffix === "string" ? profileOptions.nameSuffix : "";

  const images: Array<{ name: string; assetId: string; path: string; tags?: string[] }> = [];
  const atlases: Array<{ id: string; imagePath: string; dataPath: string }> = [];

  await opts.log?.info("export_start", { exportId, assets: assetIds.length, atlases: atlasIds.length });
  const usedNames = new Map<string, number>();
  const slugify = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 48) || "asset";

  const uniqueName = (base: string) => {
    const key = slugify(`${namePrefix}${base}${nameSuffix}`);
    const n = usedNames.get(key) ?? 0;
    usedNames.set(key, n + 1);
    return n === 0 ? key : `${key}_${n + 1}`;
  };

  const pickVariantPath = (asset: Asset) => {
    const approved = asset.versions.filter((v) => v.status === "approved");
    const version = approved.length ? approved[approved.length - 1] : asset.versions[asset.versions.length - 1];
    if (!version) return null;

    const primary = version.primaryVariantId ? version.variants.find((v) => v.id === version.primaryVariantId) : null;
    const selected = version.variants.find((v) => v.status === "selected") ?? null;
    const candidate = version.variants[0] ?? null;
    const variant = primary ?? selected ?? candidate;
    if (!variant) return null;
    return { versionId: version.id, variant };
  };

  for (const assetId of assetIds) {
    const assetPath = path.join(opts.dataRoot, "projects", job.projectId, "assets", `${assetId}.json`);
    if (!(await fileExists(assetPath))) continue;
    const asset = await readJson<Asset>(assetPath);

    const pick = pickVariantPath(asset);
    if (!pick) continue;
    const sourceRel = pick.variant.alphaPath ?? pick.variant.originalPath;
    const sourceAbs = path.join(opts.dataRoot, sourceRel);
    if (!(await fileExists(sourceAbs))) continue;

    const name = uniqueName(assetId);
    const destAbs = path.join(imagesDir, `${name}.png`);
    if (scale !== 1 || trim || padding > 0) {
      let pipeline = sharp(sourceAbs);
      if (trim) pipeline = pipeline.trim();
      if (scale !== 1) {
        const meta = await pipeline.metadata();
        const targetW = Math.max(1, Math.round((meta.width ?? 1) * scale));
        const targetH = Math.max(1, Math.round((meta.height ?? 1) * scale));
        pipeline = pipeline.resize(targetW, targetH, { kernel: "lanczos3" });
      }
      if (padding > 0) {
        pipeline = pipeline.extend({
          top: padding,
          bottom: padding,
          left: padding,
          right: padding,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        });
      }
      await pipeline.png().toFile(destAbs);
    } else {
      await fs.copyFile(sourceAbs, destAbs);
    }

    images.push({ name, assetId, path: `assets/images/${name}.png`, tags: pick.variant.tags ?? [] });
  }

  for (const atlasId of atlasIds) {
    const srcDirAbs = path.join(opts.dataRoot, "projects", job.projectId, "files", "atlases", atlasId);
    const srcPng = path.join(srcDirAbs, "atlas.png");
    const srcJson = path.join(srcDirAbs, "atlas.json");
    if (!(await fileExists(srcPng)) || !(await fileExists(srcJson))) continue;

    const atlasName = uniqueName(atlasId);
    const destPng = path.join(atlasesDir, `${atlasName}.png`);
    const destJson = path.join(atlasesDir, `${atlasName}.json`);

    if (scale !== 1) {
      const atlasImage = sharp(srcPng);
      const meta = await atlasImage.metadata();
      const targetW = Math.max(1, Math.round((meta.width ?? 1) * scale));
      const targetH = Math.max(1, Math.round((meta.height ?? 1) * scale));
      await atlasImage.resize(targetW, targetH, { kernel: "lanczos3" }).png().toFile(destPng);
    } else {
      await fs.copyFile(srcPng, destPng);
    }

    const atlasData = await readJson<any>(srcJson);
    atlasData.meta = atlasData.meta ?? {};
    atlasData.meta.image = path.basename(destPng);
    if (scale !== 1 && atlasData?.frames) {
      for (const frame of Object.values<any>(atlasData.frames)) {
        const scaleRect = (rect: { x: number; y: number; w: number; h: number }) => ({
          x: Math.round(rect.x * scale),
          y: Math.round(rect.y * scale),
          w: Math.max(1, Math.round(rect.w * scale)),
          h: Math.max(1, Math.round(rect.h * scale)),
        });
        if (frame.frame) frame.frame = scaleRect(frame.frame);
        if (frame.spriteSourceSize) frame.spriteSourceSize = scaleRect(frame.spriteSourceSize);
        if (frame.sourceSize) {
          frame.sourceSize = {
            w: Math.max(1, Math.round(frame.sourceSize.w * scale)),
            h: Math.max(1, Math.round(frame.sourceSize.h * scale)),
          };
        }
      }
    }
    await fs.writeFile(destJson, JSON.stringify(atlasData, null, 2) + "\n", "utf8");

    atlases.push({
      id: atlasId,
      imagePath: `assets/atlases/${atlasName}.png`,
      dataPath: `assets/atlases/${atlasName}.json`,
    });
  }

  const manifest = {
    id: exportId,
    projectId: job.projectId,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    version: "0.2",
    atlases,
    images,
    animations: Array.isArray(job.input.animations) ? job.input.animations : [],
    ui: Array.isArray(job.input.ui) ? job.input.ui : [],
  };

  const manifestAbs = path.join(kitRoot, "manifest.json");
  await fs.writeFile(manifestAbs, JSON.stringify(manifest, null, 2) + "\n", "utf8");

  const kitPackageJson = {
    name: `assetgenerator-pixi-kit-${job.projectId}`,
    private: true,
    version: "0.0.0",
    type: "module",
    main: "./src/index.ts",
  };
  await fs.writeFile(path.join(kitRoot, "package.json"), JSON.stringify(kitPackageJson, null, 2) + "\n", "utf8");

  const kitIndexTs = `export { default as manifest } from "../manifest.json";\nexport * from "./runtime";\nexport * from "./types";\n`;
  await fs.writeFile(path.join(srcDir, "index.ts"), kitIndexTs, "utf8");

  const kitTypesTs = `import manifest from "../manifest.json";\n\nexport type KitManifest = typeof manifest;\nexport type KitAtlas = KitManifest["atlases"][number];\nexport type KitImage = KitManifest["images"][number];\nexport type KitAnimation = KitManifest["animations"][number];\nexport type KitUi = KitManifest["ui"][number];\n`;
  await fs.writeFile(path.join(srcDir, "types.ts"), kitTypesTs, "utf8");

  const kitRuntimeTs = `import { AnimatedSprite, Assets, Sprite, Texture } from "pixi.js";\nimport manifest from "../manifest.json";\n\nexport async function loadKit() {\n  const atlasLoads = manifest.atlases.map((atlas) => Assets.load(atlas.dataPath));\n  const imageLoads = manifest.images.map((img) => Assets.load(img.path));\n  await Promise.all([...atlasLoads, ...imageLoads]);\n  return manifest;\n}\n\nexport function createSprite(name: string) {\n  const entry = manifest.images.find((img) => img.name === name);\n  if (!entry) throw new Error(\`Unknown sprite: \${name}\`);\n  return Sprite.from(entry.path);\n}\n\nexport function createAnimation(name: string) {\n  const entry = manifest.animations.find((anim) => anim.name === name);\n  if (!entry) throw new Error(\`Unknown animation: \${name}\`);\n  const textures = entry.frames.map((frame) => Texture.from(frame));\n  const sprite = new AnimatedSprite(textures);\n  sprite.animationSpeed = entry.fps / 60;\n  sprite.loop = entry.loop;\n  sprite.play();\n  return sprite;\n}\n\nexport function createUiElement(name: string) {\n  const entry = manifest.ui.find((ui) => ui.name === name);\n  if (!entry) throw new Error(\`Unknown UI element: \${name}\`);\n  const [firstKey] = Object.values(entry.states);\n  const sprite = new Sprite(firstKey ? Texture.from(firstKey) : Texture.EMPTY);\n  return {\n    type: entry.type,\n    sprite,\n    setState: (state: string) => {\n      const key = entry.states[state];\n      if (!key) return;\n      sprite.texture = Texture.from(key);\n    }\n  };\n}\n`;
  await fs.writeFile(path.join(srcDir, "runtime.ts"), kitRuntimeTs, "utf8");

  const exportRecord = {
    id: exportId,
    projectId: job.projectId,
    type: "pixi_kit",
    status: "succeeded",
    createdAt: nowIso(),
    updatedAt: nowIso(),
    input: {
      assetIds,
      atlasIds,
      profileId: (profile?.id ?? profileId) || undefined,
      profileSnapshot: profile
        ? { id: profile.id, name: profile.name, type: profile.type, options: profile.options }
        : undefined,
    },
    output: { exportPath: relToData(opts.dataRoot, kitRoot), manifestPath: relToData(opts.dataRoot, manifestAbs) },
  };

  await writeJsonAtomic(
    path.join(opts.dataRoot, "projects", job.projectId, "exports", `${exportId}.json`),
    exportRecord,
  );

  await opts.log?.info("export_done", { exportId, manifestPath: exportRecord.output.manifestPath });
  return exportRecord.output;
}

async function runOnce(opts: { repoRoot: string; dataRoot: string; comfyBaseUrl: string }) {
  const projectsDir = path.join(opts.dataRoot, "projects");
  let projects: string[] = [];
  try {
    const entries = await fs.readdir(projectsDir, { withFileTypes: true });
    projects = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return;
  }

  const perProjectConcurrency = Number(process.env.ASSETGEN_WORKER_PROJECT_CONCURRENCY ?? 1);
  const lockTtlMs = Number(process.env.ASSETGEN_WORKER_PROJECT_LOCK_TTL_MS ?? 30_000);

  for (const projectId of projects) {
    const projectDir = path.join(projectsDir, projectId);
    const lock = await acquireProjectLock({ dataRoot: opts.dataRoot, projectId, ttlMs: lockTtlMs });
    if (!lock.acquired) continue;
    const queued = await listQueuedJobs(projectDir);
    const batch = queued.slice(0, Math.max(1, perProjectConcurrency));
    await Promise.all(
      batch.map(async ({ filePath, job }) => {
        const logAbs = path.join(opts.dataRoot, "projects", job.projectId, "files", "logs", "jobs", `${job.id}.jsonl`);
        const logRel = relToData(opts.dataRoot, logAbs);
        const log = await createJsonlLogger({
          absPath: logAbs,
          component: "worker",
          baseFields: { projectId: job.projectId, jobId: job.id },
        });

        const latest = await readJson<Job>(filePath);
        if (latest.status !== "queued") {
          await log.info("job_skip", { reason: "status_not_queued", status: latest.status });
          return;
        }

        const updatedAt = nowIso();
        latest.status = "running";
        latest.updatedAt = updatedAt;
        latest.logPath = latest.logPath ?? logRel;
        await writeJsonAtomic(filePath, latest);

        try {
          await log.info("job_start", { type: latest.type, input: summarizeJobInput(latest.input) });
          let output: any = {};
          if (latest.type === "generate")
            output = await processGenerateJob({
              repoRoot: opts.repoRoot,
              dataRoot: opts.dataRoot,
              comfyBaseUrl: opts.comfyBaseUrl,
              job: latest,
              log,
              jobFilePath: filePath,
            });
          else if (latest.type === "bg_remove")
            output = await processBgRemoveJob({ repoRoot: opts.repoRoot, dataRoot: opts.dataRoot, job: latest, log });
          else if (latest.type === "atlas_pack")
            output = await processAtlasPackJob({ dataRoot: opts.dataRoot, job: latest, log });
          else if (latest.type === "export")
            output = await processExportJob({ dataRoot: opts.dataRoot, job: latest, log });
          else throw new Error(`Unsupported job.type=${latest.type}`);

          const updated = await readJson<Job>(filePath);
          if (updated.status === "canceled") {
            updated.updatedAt = nowIso();
            updated.output = output;
            await writeJsonAtomic(filePath, updated);
            await log.info("job_canceled_after_run", { output });
            return;
          }

          updated.status = "succeeded";
          updated.updatedAt = nowIso();
          updated.output = { ...(updated.output ?? {}), ...output };
          await writeJsonAtomic(filePath, updated);
          const chained = await enqueueNextJobs({
            dataRoot: opts.dataRoot,
            projectId: updated.projectId,
            jobId: updated.id,
            input: updated.input,
            output,
          });
          await log.info("job_succeeded", { output, chainedJobs: chained });
        } catch (err: any) {
          const updated = await readJson<Job>(filePath);
          if (updated.status !== "canceled") {
            updated.status = "failed";
            updated.updatedAt = nowIso();
            updated.error = err?.message ?? String(err);
            await writeJsonAtomic(filePath, updated);
          }
          await log.error("job_failed", { error: { message: err?.message ?? String(err), stack: err?.stack } });
        }
      }),
    );
    await releaseProjectLock(lock.lockPath);
  }
}

async function main() {
  const repoRoot = repoRootFromHere(import.meta.url);
  const local = await loadLocalConfig(repoPath(repoRoot, "config", "local.json"));
  const dataRoot = local?.dataRoot ? path.resolve(local.dataRoot) : repoPath(repoRoot, "data");
  const comfyBaseUrlRaw = local?.comfyui?.baseUrl ?? "http://127.0.0.1:8188";
  const comfyBaseUrl = /^[a-zA-Z]+:\/\//.test(comfyBaseUrlRaw) ? comfyBaseUrlRaw : `http://${comfyBaseUrlRaw}`;

  const runtimeLog = await createJsonlLogger({
    absPath: path.join(dataRoot, "runtime", "logs", "worker.jsonl"),
    component: "worker",
  });
  await runtimeLog.info("startup", { dataRoot, comfyBaseUrl: comfyBaseUrlRaw });

  process.on("unhandledRejection", (reason) => {
    void runtimeLog.error("unhandled_rejection", { reason: String(reason) });
  });
  process.on("uncaughtException", (err) => {
    void runtimeLog
      .error("uncaught_exception", { error: { message: err?.message ?? String(err), stack: (err as any)?.stack } })
      .finally(() => {
        process.exit(1);
      });
  });

  const once = process.argv.includes("--once");
  const intervalMs = Number(process.env.ASSETGEN_WORKER_POLL_MS ?? 1500);

  let lastHeartbeatWrite = 0;
  const heartbeatEveryMs = 5_000;

  if (once) {
    try {
      await writeWorkerHeartbeat(dataRoot, { pid: process.pid, intervalMs });
      await runOnce({ repoRoot, dataRoot, comfyBaseUrl });
    } catch (err: any) {
      await runtimeLog.error("run_once_failed", { error: { message: err?.message ?? String(err), stack: err?.stack } });
      throw err;
    }
    return;
  }

  // eslint-disable-next-line no-console
  console.log(`[worker] Watching jobs. dataRoot=${dataRoot}`);
  await runtimeLog.info("watching", { intervalMs });

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const now = Date.now();
      if (now - lastHeartbeatWrite > heartbeatEveryMs) {
        await writeWorkerHeartbeat(dataRoot, { pid: process.pid, intervalMs });
        lastHeartbeatWrite = now;
      }
      await runOnce({ repoRoot, dataRoot, comfyBaseUrl });
    } catch (err: any) {
      // Keep the worker alive, but make sure the error is visible.
      // eslint-disable-next-line no-console
      console.error("[worker] loop error:", err?.message ?? err);
      await runtimeLog.error("loop_error", { error: { message: err?.message ?? String(err), stack: err?.stack } });
    }
    await sleep(intervalMs);
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err?.message ?? err);
  process.exit(1);
});
