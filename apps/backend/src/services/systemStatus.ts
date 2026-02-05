import fs from "node:fs/promises";
import path from "node:path";

import { fileExists, readJson } from "../lib/json";

async function listProjectIds(projectsRoot: string) {
  try {
    const entries = await fs.readdir(projectsRoot, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

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

export async function getSystemStatus(opts: { dataRoot: string; comfyBaseUrl: string }) {
  const dataRootAbs = path.resolve(opts.dataRoot);
  const projectsRoot = path.join(dataRootAbs, "projects");

  const projectIds = await listProjectIds(projectsRoot);
  const astroduckProjectJson = path.join(projectsRoot, "astroduck_demo", "project.json");
  const seeded = await fileExists(astroduckProjectJson);

  const heartbeatPath = path.join(dataRootAbs, "runtime", "worker-heartbeat.json");
  let workerHeartbeat: any = null;
  if (await fileExists(heartbeatPath)) {
    try {
      workerHeartbeat = await readJson<any>(heartbeatPath);
    } catch {
      workerHeartbeat = null;
    }
  }

  const now = Date.now();
  const hbTs = typeof workerHeartbeat?.ts === "string" ? Date.parse(workerHeartbeat.ts) : NaN;
  const hbAgeMs = Number.isFinite(hbTs) ? now - hbTs : null;
  const workerOk = hbAgeMs !== null ? hbAgeMs < 15_000 : false;

  const comfyBaseUrlRaw = opts.comfyBaseUrl;
  const comfyBaseUrl = /^[a-zA-Z]+:\/\//.test(comfyBaseUrlRaw) ? comfyBaseUrlRaw : `http://${comfyBaseUrlRaw}`;
  const comfyUrl = new URL("/system_stats", comfyBaseUrl).toString();

  let comfyOk = false;
  let comfyStatus: number | null = null;
  let comfyError: string | null = null;
  try {
    const res = await fetchWithTimeout(comfyUrl, 1500);
    comfyStatus = res.status;
    comfyOk = res.ok;
    if (!res.ok) comfyError = `HTTP ${res.status}`;
  } catch (err: any) {
    comfyOk = false;
    comfyError = err?.name === "AbortError" ? "timeout" : (err?.message ?? String(err));
  }

  return {
    now: new Date().toISOString(),
    dataRoot: dataRootAbs,
    projects: { count: projectIds.length, ids: projectIds.slice(0, 50) },
    seeded: { astroduckDemo: seeded },
    worker: {
      heartbeatPath: path.relative(dataRootAbs, heartbeatPath).replaceAll("\\", "/"),
      heartbeat: workerHeartbeat,
      ok: workerOk,
      ageMs: hbAgeMs,
    },
    comfyui: {
      baseUrl: comfyBaseUrlRaw,
      probeUrl: comfyUrl,
      ok: comfyOk,
      status: comfyStatus,
      error: comfyError,
    },
  };
}
