/**
 * Gate Test Pack 1 — Replay Determinism
 *
 * Verifies:
 * - Event idempotency: duplicate event injection returns the prior event (0 duplicates).
 * - Cursor-based reconnect: listing events with `since` returns only newer events.
 * - Sequence monotonicity: event seq values are strictly increasing.
 *
 * Pass criteria (from §15.5):
 *   - 0 duplicate jobs from replay
 *   - decision trace equivalence >= 99 %
 */

import { describe, it, before, after } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

import { loadSchemas } from "../apps/backend/src/lib/schemas";
import { appendProjectEvent, listProjectEvents, getProjectEventCursor } from "../apps/backend/src/services/events";
import type { SchemaRegistry } from "../apps/backend/src/lib/schemas";

const PROJECT_ID = "test_replay";

let schemas: SchemaRegistry;
let tmpRoot: string; // acts as projectsRoot

before(async () => {
  schemas = await loadSchemas(path.resolve("schemas"));
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ag-replay-"));
  // Ensure project directory exists
  await fs.mkdir(path.join(tmpRoot, PROJECT_ID, "events"), { recursive: true });
});

after(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

/* ─── helpers ────────────────────────────────────────────────────────── */

function makeEvent(type: string, entityId: string, key: string) {
  return {
    projectId: PROJECT_ID,
    type,
    entityType: "job",
    entityId,
    idempotencyKey: key,
    payload: { ts: Date.now() },
  };
}

/* ─── tests ──────────────────────────────────────────────────────────── */

describe("Replay Determinism — Idempotency", () => {
  it("duplicate event returns the same seq (no new event created)", async () => {
    const ev = makeEvent("job.queued", "job_1", "idem_1");
    const first = await appendProjectEvent({ projectsRoot: tmpRoot, schemas, event: ev });
    const second = await appendProjectEvent({ projectsRoot: tmpRoot, schemas, event: ev });

    assert.equal(first.seq, second.seq, "Duplicate should return same seq");
    assert.equal(first.id, second.id, "Duplicate should return same event id");
  });

  it("distinct idempotency keys produce distinct events", async () => {
    const a = await appendProjectEvent({
      projectsRoot: tmpRoot,
      schemas,
      event: makeEvent("job.queued", "job_2", "key_a"),
    });
    const b = await appendProjectEvent({
      projectsRoot: tmpRoot,
      schemas,
      event: makeEvent("job.queued", "job_2", "key_b"),
    });
    assert.notEqual(a.seq, b.seq);
  });

  it("100-event burst with duplicates produces 0 extra events", async () => {
    const UNIQUE = 50;
    const BURST = 100;
    const results = [];
    for (let i = 0; i < BURST; i++) {
      const idx = i % UNIQUE; // each key appears twice
      const ev = makeEvent("job.running", `burst_${idx}`, `burst_key_${idx}`);
      results.push(await appendProjectEvent({ projectsRoot: tmpRoot, schemas, event: ev }));
    }

    // Only UNIQUE distinct seqs should exist for the burst entity range
    const uniqueSeqs = new Set(results.map((r) => r.seq));
    assert.equal(uniqueSeqs.size, UNIQUE, `Expected ${UNIQUE} unique events, got ${uniqueSeqs.size}`);
  });
});

describe("Replay Determinism — Cursor reconnect", () => {
  it("listing since=0 returns all events", async () => {
    const all = await listProjectEvents({ projectsRoot: tmpRoot, projectId: PROJECT_ID, since: 0 });
    assert.ok(all.length > 0, "Should have events");
  });

  it("listing since=<lastSeq> returns empty (no gap, no duplicates)", async () => {
    const cursor = await getProjectEventCursor({ projectsRoot: tmpRoot, projectId: PROJECT_ID });
    const tail = await listProjectEvents({
      projectsRoot: tmpRoot,
      projectId: PROJECT_ID,
      since: cursor.lastSeq,
    });
    assert.equal(tail.length, 0, "No events after cursor tip");
  });

  it("listing since=<midpoint> returns only newer events", async () => {
    const all = await listProjectEvents({ projectsRoot: tmpRoot, projectId: PROJECT_ID, since: 0, limit: 5000 });
    if (all.length < 3) return; // guard
    const midSeq = all[Math.floor(all.length / 2)].seq;
    const after = await listProjectEvents({
      projectsRoot: tmpRoot,
      projectId: PROJECT_ID,
      since: midSeq,
    });
    for (const ev of after) {
      assert.ok(ev.seq > midSeq, `Event seq ${ev.seq} should be > ${midSeq}`);
    }
  });
});

describe("Replay Determinism — Sequence monotonicity", () => {
  it("event seqs are strictly increasing", async () => {
    const all = await listProjectEvents({ projectsRoot: tmpRoot, projectId: PROJECT_ID, since: 0, limit: 5000 });
    for (let i = 1; i < all.length; i++) {
      assert.ok(all[i].seq > all[i - 1].seq, `seq at index ${i} not monotonic`);
    }
  });
});
