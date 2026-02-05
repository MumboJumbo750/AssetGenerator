import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

import { fileExists, readJson } from "../lib/json";
import type { LocalConfig } from "../lib/localConfig";
import { resolveWeightsPath, type WeightsRef } from "../lib/weights";

type CheckpointRecord = {
  id: string;
  name?: string;
  localPath?: string;
  weights?: WeightsRef;
};

type LoraRecord = {
  id: string;
  name?: string;
  activeReleaseId?: string;
  releases?: Array<{ id: string; weights?: WeightsRef; localPath?: string }>;
};

type FileCheck = {
  id: string;
  path: string | null;
  exists: boolean;
  reason?: string;
  hashExpected?: string;
  hashMatch?: boolean;
};
type CustomNodeCheck = { name: string; matched: boolean };
type PythonCheck = { package: string; installed: boolean };
type CustomNodeManifest = { name: string; repo: string; ref: string; nodes: string[]; pythonPackages: string[] };

async function fetchWithTimeout(url: string, timeoutMs: number) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    return res;
  } finally {
    clearTimeout(t);
  }
}

async function listJsonFiles(dirPath: string) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries.filter((e) => e.isFile() && e.name.endsWith(".json")).map((e) => path.join(dirPath, e.name));
  } catch {
    return [];
  }
}

async function listProjectFolders(projectsRoot: string) {
  try {
    const entries = await fs.readdir(projectsRoot, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

async function readJsonSafe<T>(filePath: string): Promise<T | null> {
  try {
    return await readJson<T>(filePath);
  } catch {
    return null;
  }
}

async function checkWeightsFiles(opts: {
  repoRoot: string;
  dataRoot: string;
  local: LocalConfig | null;
}): Promise<{ checkpoints: FileCheck[]; loras: FileCheck[] }> {
  const projectsRoot = path.join(opts.dataRoot, "projects");
  const projectIds = await listProjectFolders(projectsRoot);

  const checkpoints: FileCheck[] = [];
  for (const projectId of projectIds) {
    const checkpointsDir = path.join(projectsRoot, projectId, "checkpoints");
    const files = await listJsonFiles(checkpointsDir);
    for (const file of files) {
      const checkpoint = await readJsonSafe<CheckpointRecord>(file);
      if (!checkpoint?.id) continue;
      const resolved = resolveWeightsPath({
        repoRoot: opts.repoRoot,
        local: opts.local,
        weights: checkpoint.weights,
        legacyLocalPath: checkpoint.localPath,
      });
      if (!resolved) {
        checkpoints.push({ id: checkpoint.id, path: null, exists: false, reason: "missing_path_or_root" });
        continue;
      }
      const exists = await fileExists(resolved);
      const hashExpected = checkpoint.weights?.sha256;
      let hashMatch: boolean | undefined;
      if (exists && hashExpected) {
        const hash = await sha256File(resolved);
        hashMatch = hash === hashExpected;
      }
      checkpoints.push({ id: checkpoint.id, path: resolved, exists, hashExpected, hashMatch });
    }
  }

  const loras: FileCheck[] = [];
  const sharedLorasDir = path.join(opts.dataRoot, "shared", "loras");
  const sharedLoraFiles = await listJsonFiles(sharedLorasDir);
  const projectLoraFiles: string[] = [];
  for (const projectId of projectIds) {
    projectLoraFiles.push(...(await listJsonFiles(path.join(projectsRoot, projectId, "loras"))));
  }
  for (const file of [...sharedLoraFiles, ...projectLoraFiles]) {
    const lora = await readJsonSafe<LoraRecord>(file);
    if (!lora?.id) continue;
    const release =
      lora.releases?.find((r) => r.id === lora.activeReleaseId) ?? (lora.releases?.length ? lora.releases[0] : null);
    if (!release) {
      loras.push({ id: lora.id, path: null, exists: false, reason: "missing_release" });
      continue;
    }
    const resolved = resolveWeightsPath({
      repoRoot: opts.repoRoot,
      local: opts.local,
      weights: release.weights,
      legacyLocalPath: release.localPath,
    });
    if (!resolved) {
      loras.push({ id: lora.id, path: null, exists: false, reason: "missing_path_or_root" });
      continue;
    }
    const exists = await fileExists(resolved);
    const hashExpected = release.weights?.sha256;
    let hashMatch: boolean | undefined;
    if (exists && hashExpected) {
      const hash = await sha256File(resolved);
      hashMatch = hash === hashExpected;
    }
    loras.push({ id: `${lora.id}:${release.id}`, path: resolved, exists, hashExpected, hashMatch });
  }

  return { checkpoints, loras };
}

async function sha256File(filePath: string): Promise<string> {
  const crypto = await import("node:crypto");
  const hash = crypto.createHash("sha256");
  const handle = await fs.open(filePath, "r");
  try {
    const buffer = Buffer.alloc(1024 * 1024);
    let offset = 0;
    while (true) {
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, offset);
      if (bytesRead === 0) break;
      hash.update(buffer.subarray(0, bytesRead));
      offset += bytesRead;
    }
    return hash.digest("hex");
  } finally {
    await handle.close();
  }
}

async function listPythonPackages(pythonBin: string): Promise<string[] | null> {
  return new Promise((resolve) => {
    const child = spawn(pythonBin, ["-m", "pip", "list", "--format=json"], { stdio: ["ignore", "pipe", "pipe"] });
    const chunks: Buffer[] = [];
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      child.kill();
      resolve(null);
    }, 4000);

    child.stdout.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    child.on("close", () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        const parsed = JSON.parse(raw) as Array<{ name: string }>;
        resolve(parsed.map((p) => p.name.toLowerCase()));
      } catch {
        resolve(null);
      }
    });
  });
}

export async function verifyComfyUi(opts: {
  dataRoot: string;
  repoRoot: string;
  comfyBaseUrl: string;
  local: LocalConfig | null;
}) {
  const dataRootAbs = path.resolve(opts.dataRoot);
  const repoRootAbs = path.resolve(opts.repoRoot);

  const comfyBaseUrlRaw = opts.comfyBaseUrl;
  const comfyBaseUrl = /^[a-zA-Z]+:\/\//.test(comfyBaseUrlRaw) ? comfyBaseUrlRaw : `http://${comfyBaseUrlRaw}`;
  const comfyUrl = new URL("/system_stats", comfyBaseUrl).toString();

  let comfyOk = false;
  let comfyStatus: number | null = null;
  let comfyError: string | null = null;
  let objectInfoOk = false;
  let objectInfoError: string | null = null;
  let objectInfoNodeCount: number | null = null;
  let objectInfoCategories: string[] = [];
  let pythonOk = false;
  let pythonError: string | null = null;
  let pythonPackages: string[] | null = null;
  try {
    const res = await fetchWithTimeout(comfyUrl, 1500);
    comfyStatus = res.status;
    comfyOk = res.ok;
    if (!res.ok) comfyError = `HTTP ${res.status}`;
  } catch (err: any) {
    comfyOk = false;
    comfyError = err?.name === "AbortError" ? "timeout" : (err?.message ?? String(err));
  }

  const manifestPath = path.join(repoRootAbs, "pipeline", "comfyui", "manifest.json");
  const manifestExamplePath = path.join(repoRootAbs, "pipeline", "comfyui", "manifest.example.json");
  const manifestExists = await fileExists(manifestPath);
  const manifest = manifestExists ? await readJsonSafe<any>(manifestPath) : null;
  const manifestExampleExists = await fileExists(manifestExamplePath);

  const workflowFiles = [
    path.join(repoRootAbs, "pipeline", "comfyui", "workflows", "txt2img.json"),
    path.join(repoRootAbs, "pipeline", "comfyui", "workflows", "txt2img.bindings.json"),
  ];
  const workflowChecks = await Promise.all(
    workflowFiles.map(async (filePath) => ({
      path: filePath,
      exists: await fileExists(filePath),
    })),
  );

  const roots = {
    modelsRoot: opts.local?.paths?.modelsRoot ?? null,
    checkpointsRoot: opts.local?.paths?.checkpointsRoot ?? null,
    lorasRoot: opts.local?.paths?.lorasRoot ?? null,
  };
  const missingRoots = Object.entries(roots)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  const { checkpoints, loras } = await checkWeightsFiles({
    repoRoot: repoRootAbs,
    dataRoot: dataRootAbs,
    local: opts.local,
  });

  let customNodes: CustomNodeCheck[] = [];
  let pythonRequirements: PythonCheck[] = [];
  let manifestIssues: string[] = [];
  const expectedNodes: CustomNodeManifest[] = Array.isArray(manifest?.customNodes)
    ? manifest.customNodes.map((n: any) => ({
        name: String(n?.name ?? ""),
        repo: String(n?.repo ?? ""),
        ref: String(n?.ref ?? ""),
        nodes: Array.isArray(n?.nodes) ? n.nodes.map((x: any) => String(x)) : [],
        pythonPackages: Array.isArray(n?.pythonPackages) ? n.pythonPackages.map((x: any) => String(x)) : [],
      }))
    : [];

  for (const node of expectedNodes) {
    if (!node.name || !node.repo || !node.ref) {
      manifestIssues.push("customNodes entry missing name/repo/ref");
      break;
    }
    if (node.nodes.length === 0) manifestIssues.push(`customNodes ${node.name} missing nodes[]`);
    if (node.pythonPackages.length === 0) manifestIssues.push(`customNodes ${node.name} missing pythonPackages[]`);
  }

  if (comfyOk) {
    try {
      const objectInfoUrl = new URL("/object_info", comfyBaseUrl).toString();
      const res = await fetchWithTimeout(objectInfoUrl, 2000);
      if (res.ok) {
        const data = (await res.json()) as Record<string, { category?: string }>;
        const nodeKeys = Object.keys(data);
        const categories = new Set<string>();
        for (const entry of Object.values(data)) {
          if (entry?.category) categories.add(entry.category);
        }
        objectInfoOk = true;
        objectInfoNodeCount = nodeKeys.length;
        objectInfoCategories = Array.from(categories).slice(0, 25);

        customNodes = expectedNodes.map((node) => {
          const matched =
            node.nodes.length > 0 ? node.nodes.every((nodeId: string) => nodeKeys.includes(nodeId)) : false;
          return { name: node.name, matched };
        });
      } else {
        objectInfoOk = false;
        objectInfoError = `HTTP ${res.status}`;
      }
    } catch (err: any) {
      objectInfoOk = false;
      objectInfoError = err?.name === "AbortError" ? "timeout" : (err?.message ?? String(err));
    }
  }

  if (opts.local?.comfyui?.pythonBin) {
    const pkgs = await listPythonPackages(opts.local.comfyui.pythonBin);
    if (pkgs) {
      pythonOk = true;
      pythonPackages = pkgs;
      const required = expectedNodes.flatMap((node) => node.pythonPackages.map((pkg: string) => pkg.toLowerCase()));
      const unique = Array.from(new Set(required));
      pythonRequirements = unique.map((pkg: string) => ({ package: pkg, installed: pkgs.includes(pkg) }));
    } else {
      pythonOk = false;
      pythonError = "pip list failed";
    }
  } else {
    pythonOk = false;
    pythonError = "pythonBin not set";
  }

  return {
    now: new Date().toISOString(),
    comfyui: {
      baseUrl: comfyBaseUrlRaw,
      probeUrl: comfyUrl,
      ok: comfyOk,
      status: comfyStatus,
      error: comfyError,
    },
    objectInfo: {
      ok: objectInfoOk,
      error: objectInfoError,
      nodeCount: objectInfoNodeCount,
      categoriesSample: objectInfoCategories,
    },
    python: {
      ok: pythonOk,
      error: pythonError,
      packagesCount: pythonPackages ? pythonPackages.length : null,
    },
    manifest: {
      path: manifestPath,
      exists: manifestExists,
      examplePath: manifestExamplePath,
      exampleExists: manifestExampleExists,
      customNodes: Array.isArray(manifest?.customNodes) ? manifest.customNodes.length : null,
      models: Array.isArray(manifest?.models) ? manifest.models.length : null,
    },
    manifestIssues,
    customNodes,
    pythonRequirements,
    workflowFiles: workflowChecks,
    localConfig: {
      paths: roots,
      missingRoots,
    },
    checkpoints,
    loras,
  };
}
