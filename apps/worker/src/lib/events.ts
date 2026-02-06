import fs from "node:fs/promises";
import path from "node:path";

import { ulid } from "ulid";

import { fileExists, readJson, writeJsonAtomic } from "./json";

type WorkerEventInput = {
  projectId: string;
  type: string;
  entityType: string;
  entityId: string;
  idempotencyKey: string;
  payload?: Record<string, unknown>;
  causalChainId?: string;
};

type SeqState = {
  projectId: string;
  lastSeq: number;
  updatedAt: string;
};

function nowIso() {
  return new Date().toISOString();
}

function eventsDir(dataRoot: string, projectId: string) {
  return path.join(dataRoot, "projects", projectId, "events");
}

async function withLock(dataRoot: string, projectId: string, fn: () => Promise<void>) {
  const dir = eventsDir(dataRoot, projectId);
  await fs.mkdir(dir, { recursive: true });
  const lock = path.join(dir, "writer.lock");
  for (let attempt = 1; attempt <= 50; attempt += 1) {
    try {
      const handle = await fs.open(lock, "wx");
      try {
        await fn();
        return;
      } finally {
        await handle.close();
        await fs.unlink(lock).catch(() => undefined);
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 10 * attempt));
    }
  }
  throw new Error(`worker could not acquire event writer lock for project=${projectId}`);
}

export async function appendWorkerEvent(dataRoot: string, input: WorkerEventInput) {
  await withLock(dataRoot, input.projectId, async () => {
    const dir = eventsDir(dataRoot, input.projectId);
    const seqPath = path.join(dir, "seq.json");
    const seqState: SeqState =
      (await fileExists(seqPath))
        ? await readJson<SeqState>(seqPath)
        : { projectId: input.projectId, lastSeq: 0, updatedAt: nowIso() };
    const seq = Number(seqState.lastSeq ?? 0) + 1;
    const event = {
      id: ulid(),
      projectId: input.projectId,
      seq,
      ts: nowIso(),
      type: input.type,
      entityType: input.entityType,
      entityId: input.entityId,
      causalChainId: input.causalChainId ?? ulid(),
      idempotencyKey: input.idempotencyKey,
      payload: input.payload ?? {},
    };
    await fs.appendFile(path.join(dir, "events.jsonl"), `${JSON.stringify(event)}\n`, "utf8");
    await writeJsonAtomic(seqPath, { projectId: input.projectId, lastSeq: seq, updatedAt: nowIso() });
  });
}

