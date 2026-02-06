/**
 * Gate Test Pack 4 — Idempotency
 *
 * Verifies:
 * - Duplicate event injection is blocked (dedup via idempotencyKey triple).
 * - Reconnect bursts do not create phantom events.
 * - classifyError correctly categorises retryable vs non-retryable.
 * - computeBackoffMs produces bounded, jittered values.
 *
 * Pass criteria (from §15.5):
 *   - duplicate-action rate <= 0.1 %
 *   - reconnect recovery without manual cleanup in 100 % test cases
 */

import { describe, it, before, after } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

import { loadSchemas } from "../apps/backend/src/lib/schemas";
import { appendProjectEvent, listProjectEvents } from "../apps/backend/src/services/events";
import { classifyError, computeBackoffMs, type RetryPolicy, type ErrorClass } from "../apps/worker/src/worker";
import type { SchemaRegistry } from "../apps/backend/src/lib/schemas";

const PROJECT_ID = "test_idem";

let schemas: SchemaRegistry;
let tmpRoot: string;

before(async () => {
  schemas = await loadSchemas(path.resolve("schemas"));
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ag-idem-"));
  await fs.mkdir(path.join(tmpRoot, PROJECT_ID, "events"), { recursive: true });
});

after(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

/* ─── helpers ────────────────────────────────────────────────────────── */

function ev(entityId: string, key: string) {
  return {
    projectId: PROJECT_ID,
    type: "job.queued",
    entityType: "job",
    entityId,
    idempotencyKey: key,
    payload: {},
  };
}

/* ─── Idempotency dedup ─────────────────────────────────────────────── */

describe("Idempotency — duplicate event injection", () => {
  it("sends 200 events (100 unique × 2) and gets exactly 100 distinct seqs", async () => {
    const uniqueIds: string[] = [];
    for (let i = 0; i < 100; i++) uniqueIds.push(`idem_ent_${i}`);

    const allResults = [];
    // First pass: 100 unique
    for (const id of uniqueIds) {
      allResults.push(await appendProjectEvent({ projectsRoot: tmpRoot, schemas, event: ev(id, `key_${id}`) }));
    }
    // Second pass: exact duplicates
    for (const id of uniqueIds) {
      allResults.push(await appendProjectEvent({ projectsRoot: tmpRoot, schemas, event: ev(id, `key_${id}`) }));
    }

    const uniqueSeqs = new Set(allResults.map((r) => r.seq));
    assert.equal(uniqueSeqs.size, 100, `Expected 100 unique events, got ${uniqueSeqs.size}`);

    const dupeRate = (allResults.length - uniqueSeqs.size) / allResults.length;
    // dupeRate should be ~50% (100 dupes out of 200 calls), but 0 extra events created
    // What matters is uniqueSeqs.size equals the number of unique inputs
    assert.equal(uniqueSeqs.size, uniqueIds.length, "Every unique input should produce exactly 1 event");
  });
});

describe("Idempotency — reconnect burst", () => {
  it("simulates rapid reconnect: 10 bursts of same event produce 1 event", async () => {
    const event = ev("reconnect_entity", "reconnect_key");
    const results = [];
    for (let i = 0; i < 10; i++) {
      results.push(await appendProjectEvent({ projectsRoot: tmpRoot, schemas, event }));
    }
    const seqs = new Set(results.map((r) => r.seq));
    assert.equal(seqs.size, 1, "Reconnect burst should not create duplicates");
  });

  it("after burst, listProjectEvents returns exactly 1 event for that entity", async () => {
    const all = await listProjectEvents({ projectsRoot: tmpRoot, projectId: PROJECT_ID, since: 0, limit: 5000 });
    const reconnectEvents = all.filter((e) => e.entityId === "reconnect_entity");
    assert.equal(reconnectEvents.length, 1, "Only 1 reconnect event should exist");
  });
});

/* ─── Error classification ──────────────────────────────────────────── */

describe("Idempotency — classifyError", () => {
  const cases: Array<{ input: any; expected: ErrorClass; label: string }> = [
    { input: new Error("schema validation failed"), expected: "non_retryable", label: "schema error" },
    { input: new Error("invalid input field"), expected: "non_retryable", label: "invalid input" },
    { input: { message: "connect ETIMEDOUT", code: "ETIMEDOUT" }, expected: "timeout", label: "ETIMEDOUT" },
    { input: { message: "socket hang up", code: "ECONNRESET" }, expected: "upstream_unavailable", label: "ECONNRESET" },
    { input: { message: "server error", status: 503 }, expected: "upstream_unavailable", label: "503 status" },
    { input: { message: "server error", statusCode: 502 }, expected: "upstream_unavailable", label: "502 status" },
    { input: new Error("random transient glitch"), expected: "non_retryable", label: "unknown (fallback)" },
  ];

  for (const { input, expected, label } of cases) {
    it(`classifies "${label}" as ${expected}`, () => {
      const result = classifyError(input);
      assert.equal(result, expected);
    });
  }
});

/* ─── Backoff computation ────────────────────────────────────────────── */

describe("Idempotency — computeBackoffMs bounded", () => {
  const policy: RetryPolicy = {
    maxAttempts: 5,
    backoffMode: "exponential",
    baseDelayMs: 1000,
    maxDelayMs: 30000,
    jitterPct: 0.15,
    retryOn: ["retryable", "timeout"],
    escalateTo: "exception_inbox",
  };

  it("backoff never exceeds maxDelayMs + jitter ceiling", () => {
    const jitterCeiling = policy.maxDelayMs * policy.jitterPct;
    for (let attempt = 1; attempt <= 20; attempt++) {
      const ms = computeBackoffMs(policy, attempt);
      assert.ok(ms >= 100, `Attempt ${attempt}: ${ms} < 100 floor`);
      assert.ok(
        ms <= policy.maxDelayMs + jitterCeiling + 1,
        `Attempt ${attempt}: ${ms} > max+jitter (${policy.maxDelayMs + jitterCeiling})`,
      );
    }
  });

  it("exponential backoff: attempt 1 < attempt 3 (on average)", () => {
    // Run 100 samples and compare averages
    let sum1 = 0;
    let sum3 = 0;
    for (let i = 0; i < 100; i++) {
      sum1 += computeBackoffMs(policy, 1);
      sum3 += computeBackoffMs(policy, 3);
    }
    assert.ok(sum1 / 100 < sum3 / 100, "Average backoff for attempt 1 should be less than attempt 3");
  });

  it("fixed backoff mode: all attempts have similar base delay", () => {
    const fixedPolicy: RetryPolicy = { ...policy, backoffMode: "fixed" };
    const values = Array.from({ length: 50 }, (_, i) => computeBackoffMs(fixedPolicy, i + 1));
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    // All values should be near baseDelayMs (±jitter)
    assert.ok(avg > policy.baseDelayMs * 0.7, `Fixed avg ${avg} too low`);
    assert.ok(avg < policy.baseDelayMs * 1.3, `Fixed avg ${avg} too high`);
  });

  it("minimum floor is 100ms", () => {
    const tinyPolicy: RetryPolicy = { ...policy, baseDelayMs: 1, maxDelayMs: 1, jitterPct: 0 };
    const ms = computeBackoffMs(tinyPolicy, 1);
    assert.ok(ms >= 100, `Expected >= 100, got ${ms}`);
  });
});
