import fs from "node:fs/promises";
import path from "node:path";

import { ulid } from "ulid";

import { fileExists, readJson, writeJsonAtomic } from "../lib/json";
import type { SchemaRegistry } from "../lib/schemas";

export type ProjectEvent = {
  id: string;
  projectId: string;
  seq: number;
  ts: string;
  type: string;
  entityType: string;
  entityId: string;
  causalChainId: string;
  idempotencyKey: string;
  payload: Record<string, unknown>;
};

type AppendEventInput = {
  projectId: string;
  type: string;
  entityType: string;
  entityId: string;
  causalChainId?: string;
  idempotencyKey: string;
  payload?: Record<string, unknown>;
};

type SeqState = {
  projectId: string;
  lastSeq: number;
  updatedAt: string;
};

type IdempotencyEntry = {
  type: string;
  entityId: string;
  idempotencyKey: string;
  eventSeq: number;
  ts: string;
};

function nowIso() {
  return new Date().toISOString();
}

function eventsDir(projectsRoot: string, projectId: string) {
  return path.join(projectsRoot, projectId, "events");
}

function eventsJsonlPath(projectsRoot: string, projectId: string) {
  return path.join(eventsDir(projectsRoot, projectId), "events.jsonl");
}

function seqStatePath(projectsRoot: string, projectId: string) {
  return path.join(eventsDir(projectsRoot, projectId), "seq.json");
}

function lockPath(projectsRoot: string, projectId: string) {
  return path.join(eventsDir(projectsRoot, projectId), "writer.lock");
}

function idempotencyPath(projectsRoot: string, projectId: string) {
  return path.join(eventsDir(projectsRoot, projectId), "idempotency-index.json");
}

async function withWriterLock<T>(projectsRoot: string, projectId: string, fn: () => Promise<T>) {
  const dir = eventsDir(projectsRoot, projectId);
  await fs.mkdir(dir, { recursive: true });
  const lock = lockPath(projectsRoot, projectId);
  const maxAttempts = 50;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const handle = await fs.open(lock, "wx");
      try {
        return await fn();
      } finally {
        await handle.close();
        await fs.unlink(lock).catch(() => undefined);
      }
    } catch {
      if (attempt >= maxAttempts) {
        throw new Error(`Unable to acquire event writer lock for project=${projectId}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 10 * attempt));
    }
  }
  throw new Error(`Unable to acquire event writer lock for project=${projectId}`);
}

async function readSeqState(projectsRoot: string, projectId: string): Promise<SeqState> {
  const filePath = seqStatePath(projectsRoot, projectId);
  if (!(await fileExists(filePath))) {
    return { projectId, lastSeq: 0, updatedAt: nowIso() };
  }
  return readJson<SeqState>(filePath);
}

async function readIdempotencyIndex(projectsRoot: string, projectId: string): Promise<IdempotencyEntry[]> {
  const filePath = idempotencyPath(projectsRoot, projectId);
  if (!(await fileExists(filePath))) return [];
  const parsed = await readJson<{ items?: IdempotencyEntry[] }>(filePath);
  return Array.isArray(parsed.items) ? parsed.items : [];
}

async function writeIdempotencyIndex(projectsRoot: string, projectId: string, items: IdempotencyEntry[]) {
  await writeJsonAtomic(idempotencyPath(projectsRoot, projectId), { projectId, updatedAt: nowIso(), items });
}

async function getEventBySeq(projectsRoot: string, projectId: string, seq: number) {
  const filePath = eventsJsonlPath(projectsRoot, projectId);
  if (!(await fileExists(filePath))) return null;
  const raw = await fs.readFile(filePath, "utf8");
  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const parsed = JSON.parse(lines[i]) as ProjectEvent;
    if (parsed.seq === seq) return parsed;
    if (parsed.seq < seq) break;
  }
  return null;
}

export async function appendProjectEvent(opts: {
  projectsRoot: string;
  schemas: SchemaRegistry;
  event: AppendEventInput;
}) {
  const { projectsRoot, schemas, event } = opts;
  return withWriterLock(projectsRoot, event.projectId, async () => {
    const dedupeWindowMs = 30 * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - dedupeWindowMs;
    const idemItems = (await readIdempotencyIndex(projectsRoot, event.projectId)).filter((item) => {
      const ts = Date.parse(item.ts);
      return Number.isFinite(ts) && ts >= cutoff;
    });
    const existing = idemItems.find(
      (item) =>
        item.type === event.type && item.entityId === event.entityId && item.idempotencyKey === event.idempotencyKey,
    );
    if (existing) {
      const prior = await getEventBySeq(projectsRoot, event.projectId, existing.eventSeq);
      if (prior) return prior;
    }

    const seqState = await readSeqState(projectsRoot, event.projectId);
    const nextSeq = Number(seqState.lastSeq ?? 0) + 1;
    const outEvent: ProjectEvent = {
      id: ulid(),
      projectId: event.projectId,
      seq: nextSeq,
      ts: nowIso(),
      type: event.type,
      entityType: event.entityType,
      entityId: event.entityId,
      causalChainId: event.causalChainId ?? ulid(),
      idempotencyKey: event.idempotencyKey,
      payload: event.payload ?? {},
    };

    schemas.validateOrThrow("event.schema.json", outEvent);

    const jsonl = eventsJsonlPath(projectsRoot, event.projectId);
    await fs.mkdir(path.dirname(jsonl), { recursive: true });
    await fs.appendFile(jsonl, `${JSON.stringify(outEvent)}\n`, "utf8");

    const nextState: SeqState = { projectId: event.projectId, lastSeq: nextSeq, updatedAt: nowIso() };
    await writeJsonAtomic(seqStatePath(projectsRoot, event.projectId), nextState);
    idemItems.push({
      type: outEvent.type,
      entityId: outEvent.entityId,
      idempotencyKey: outEvent.idempotencyKey,
      eventSeq: outEvent.seq,
      ts: outEvent.ts,
    });
    await writeIdempotencyIndex(projectsRoot, event.projectId, idemItems);
    return outEvent;
  });
}

export async function listProjectEvents(opts: {
  projectsRoot: string;
  projectId: string;
  since?: number;
  limit?: number;
}) {
  const since = Math.max(0, Number(opts.since ?? 0));
  const limit = Math.max(1, Math.min(5000, Number(opts.limit ?? 200)));
  const filePath = eventsJsonlPath(opts.projectsRoot, opts.projectId);
  if (!(await fileExists(filePath))) return [];
  const raw = await fs.readFile(filePath, "utf8");
  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const events: ProjectEvent[] = [];
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const parsed = JSON.parse(lines[i]) as ProjectEvent;
    if (parsed.seq <= since) break;
    events.push(parsed);
    if (events.length >= limit) break;
  }
  return events.reverse();
}

export async function getProjectEventCursor(opts: { projectsRoot: string; projectId: string }) {
  const seqState = await readSeqState(opts.projectsRoot, opts.projectId);
  const cursor = { projectId: opts.projectId, lastSeq: seqState.lastSeq, updatedAt: nowIso() };
  return cursor;
}
