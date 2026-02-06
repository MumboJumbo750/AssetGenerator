import fs from "node:fs/promises";
import path from "node:path";

import { ulid } from "ulid";

import { fileExists, readJson, writeJsonAtomic } from "../lib/json";
import type { SchemaRegistry } from "../lib/schemas";

// ── Types ─────────────────────────────────────────────────────────────

export type CircuitBreakerType = "velocity" | "queue_depth";
export type CircuitBreakerState = "closed" | "open" | "half_open";

export type CircuitBreaker = {
  id: string;
  projectId: string;
  ruleId?: string;
  type: CircuitBreakerType;
  state: CircuitBreakerState;
  config?: {
    maxTriggersPerMinute?: number;
    maxQueueDepthRatio?: number;
    cooldownMs?: number;
    halfOpenTestCount?: number;
  };
  triggerLog?: string[];
  trippedAt?: string;
  trippedReason?: string;
  halfOpenAt?: string;
  halfOpenTestsRemaining?: number;
  stats?: {
    totalTrips?: number;
    lastTripAt?: string;
    blockedTriggers?: number;
  };
  createdAt: string;
  updatedAt: string;
};

export type CircuitBreakerPolicy = {
  enabled?: boolean;
  defaultMaxTriggersPerMinute?: number;
  defaultMaxQueueDepthRatio?: number;
  defaultCooldownMs?: number;
  defaultHalfOpenTestCount?: number;
};

function nowIso() {
  return new Date().toISOString();
}

// ── CRUD ──────────────────────────────────────────────────────────────

export async function listCircuitBreakers(projectsRoot: string, projectId: string): Promise<CircuitBreaker[]> {
  const dir = path.join(projectsRoot, projectId, "circuit-breakers");
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const items: CircuitBreaker[] = [];
    for (const e of entries) {
      if (!e.isFile() || !e.name.endsWith(".json")) continue;
      items.push(await readJson<CircuitBreaker>(path.join(dir, e.name)));
    }
    items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return items;
  } catch {
    return [];
  }
}

export async function getCircuitBreaker(
  projectsRoot: string,
  projectId: string,
  breakerId: string,
): Promise<CircuitBreaker | null> {
  const filePath = path.join(projectsRoot, projectId, "circuit-breakers", `${breakerId}.json`);
  if (!(await fileExists(filePath))) return null;
  return readJson<CircuitBreaker>(filePath);
}

export async function getCircuitBreakerForRule(
  projectsRoot: string,
  projectId: string,
  ruleId: string,
  type: CircuitBreakerType,
): Promise<CircuitBreaker | null> {
  const breakers = await listCircuitBreakers(projectsRoot, projectId);
  return breakers.find((b) => b.ruleId === ruleId && b.type === type) ?? null;
}

export async function createCircuitBreaker(opts: {
  projectsRoot: string;
  schemas: SchemaRegistry;
  projectId: string;
  ruleId?: string;
  type: CircuitBreakerType;
  config?: CircuitBreaker["config"];
}): Promise<CircuitBreaker> {
  const id = ulid();
  const now = nowIso();

  const breaker: CircuitBreaker = {
    id,
    projectId: opts.projectId,
    ruleId: opts.ruleId,
    type: opts.type,
    state: "closed",
    config: opts.config,
    triggerLog: [],
    stats: { totalTrips: 0, blockedTriggers: 0 },
    createdAt: now,
    updatedAt: now,
  };

  opts.schemas.validateOrThrow("circuit-breaker.schema.json", breaker);
  const filePath = path.join(opts.projectsRoot, opts.projectId, "circuit-breakers", `${id}.json`);
  await writeJsonAtomic(filePath, breaker);
  return breaker;
}

export async function updateCircuitBreaker(opts: {
  projectsRoot: string;
  schemas: SchemaRegistry;
  projectId: string;
  breakerId: string;
  patch: Partial<
    Pick<CircuitBreaker, "state" | "config" | "trippedAt" | "trippedReason" | "halfOpenAt" | "halfOpenTestsRemaining">
  >;
}): Promise<CircuitBreaker | null> {
  const filePath = path.join(opts.projectsRoot, opts.projectId, "circuit-breakers", `${opts.breakerId}.json`);
  if (!(await fileExists(filePath))) return null;
  const breaker = await readJson<CircuitBreaker>(filePath);

  if (opts.patch.state !== undefined) breaker.state = opts.patch.state;
  if (opts.patch.config !== undefined) breaker.config = { ...breaker.config, ...opts.patch.config };
  if (opts.patch.trippedAt !== undefined) breaker.trippedAt = opts.patch.trippedAt;
  if (opts.patch.trippedReason !== undefined) breaker.trippedReason = opts.patch.trippedReason;
  if (opts.patch.halfOpenAt !== undefined) breaker.halfOpenAt = opts.patch.halfOpenAt;
  if (opts.patch.halfOpenTestsRemaining !== undefined)
    breaker.halfOpenTestsRemaining = opts.patch.halfOpenTestsRemaining;
  breaker.updatedAt = nowIso();

  opts.schemas.validateOrThrow("circuit-breaker.schema.json", breaker);
  await writeJsonAtomic(filePath, breaker);
  return breaker;
}

// ── Core Logic ────────────────────────────────────────────────────────

/**
 * Load project-level circuit breaker policy defaults.
 */
export async function loadCircuitBreakerPolicy(projectsRoot: string, projectId: string): Promise<CircuitBreakerPolicy> {
  const projectPath = path.join(projectsRoot, projectId, "project.json");
  try {
    if (!(await fileExists(projectPath))) return { enabled: true };
    const project = await readJson<{ policies?: { circuitBreakerPolicy?: CircuitBreakerPolicy } }>(projectPath);
    return project.policies?.circuitBreakerPolicy ?? { enabled: true };
  } catch {
    return { enabled: true };
  }
}

/**
 * Record a trigger event on a circuit breaker and check if it should trip.
 * Returns { allowed: true } if the trigger can proceed, or { allowed: false, reason } if blocked.
 */
export async function recordTriggerAndCheck(opts: {
  projectsRoot: string;
  schemas: SchemaRegistry;
  projectId: string;
  ruleId: string;
  queueDepth?: number;
  throughputPerMin?: number;
}): Promise<{ allowed: boolean; reason?: string; breakerId?: string }> {
  const policy = await loadCircuitBreakerPolicy(opts.projectsRoot, opts.projectId);
  if (policy.enabled === false) return { allowed: true };

  const now = nowIso();
  const nowMs = Date.now();

  // Check velocity breaker
  const velocityResult = await checkVelocityBreaker(opts, policy, now, nowMs);
  if (!velocityResult.allowed) return velocityResult;

  // Check queue depth breaker
  if (opts.queueDepth !== undefined && opts.throughputPerMin !== undefined) {
    const depthResult = await checkQueueDepthBreaker(opts, policy, now);
    if (!depthResult.allowed) return depthResult;
  }

  return { allowed: true };
}

async function checkVelocityBreaker(
  opts: { projectsRoot: string; schemas: SchemaRegistry; projectId: string; ruleId: string },
  policy: CircuitBreakerPolicy,
  now: string,
  nowMs: number,
): Promise<{ allowed: boolean; reason?: string; breakerId?: string }> {
  let breaker = await getCircuitBreakerForRule(opts.projectsRoot, opts.projectId, opts.ruleId, "velocity");

  // Auto-create velocity breaker if it doesn't exist
  if (!breaker) {
    breaker = await createCircuitBreaker({
      projectsRoot: opts.projectsRoot,
      schemas: opts.schemas,
      projectId: opts.projectId,
      ruleId: opts.ruleId,
      type: "velocity",
      config: {
        maxTriggersPerMinute: policy.defaultMaxTriggersPerMinute ?? 10,
        cooldownMs: policy.defaultCooldownMs ?? 60000,
        halfOpenTestCount: policy.defaultHalfOpenTestCount ?? 3,
      },
    });
  }

  const maxRate = breaker.config?.maxTriggersPerMinute ?? policy.defaultMaxTriggersPerMinute ?? 10;
  const cooldownMs = breaker.config?.cooldownMs ?? policy.defaultCooldownMs ?? 60000;
  const halfOpenTests = breaker.config?.halfOpenTestCount ?? policy.defaultHalfOpenTestCount ?? 3;
  const filePath = path.join(opts.projectsRoot, opts.projectId, "circuit-breakers", `${breaker.id}.json`);

  // Prune old entries from trigger log (keep last 2 minutes)
  const windowMs = 2 * 60 * 1000;
  const cutoff = new Date(nowMs - windowMs).toISOString();
  breaker.triggerLog = (breaker.triggerLog ?? []).filter((ts) => ts >= cutoff);

  // Handle breaker states
  if (breaker.state === "open") {
    // Check if cooldown has elapsed -> transition to half_open
    if (breaker.trippedAt && nowMs - Date.parse(breaker.trippedAt) >= cooldownMs) {
      breaker.state = "half_open";
      breaker.halfOpenAt = now;
      breaker.halfOpenTestsRemaining = halfOpenTests;
      breaker.updatedAt = now;
    } else {
      // Still open — block
      breaker.stats = breaker.stats ?? { totalTrips: 0, blockedTriggers: 0 };
      breaker.stats.blockedTriggers = (breaker.stats.blockedTriggers ?? 0) + 1;
      breaker.updatedAt = now;
      await writeJsonAtomic(filePath, breaker);
      return { allowed: false, reason: `Velocity breaker open for rule ${opts.ruleId}`, breakerId: breaker.id };
    }
  }

  if (breaker.state === "half_open") {
    if ((breaker.halfOpenTestsRemaining ?? 0) <= 0) {
      // All test slots used — evaluate whether velocity stayed under threshold
      const recentCount = breaker.triggerLog.filter((ts) => Date.parse(ts) >= nowMs - 60_000).length;
      if (recentCount <= maxRate) {
        // Tests passed — reset to closed, allow this trigger
        breaker.state = "closed";
        delete breaker.trippedAt;
        delete breaker.trippedReason;
        delete breaker.halfOpenAt;
        delete breaker.halfOpenTestsRemaining;
        breaker.triggerLog.push(now);
        breaker.updatedAt = now;
        await writeJsonAtomic(filePath, breaker);
        return { allowed: true };
      } else {
        // Velocity still elevated — re-trip
        breaker.state = "open";
        breaker.trippedAt = now;
        breaker.trippedReason = "Half-open test failed: velocity still elevated";
        breaker.stats = breaker.stats ?? { totalTrips: 0, blockedTriggers: 0 };
        breaker.stats.totalTrips = (breaker.stats.totalTrips ?? 0) + 1;
        breaker.stats.lastTripAt = now;
        breaker.stats.blockedTriggers = (breaker.stats.blockedTriggers ?? 0) + 1;
        breaker.updatedAt = now;
        await writeJsonAtomic(filePath, breaker);
        return { allowed: false, reason: "Half-open test failed; breaker re-tripped", breakerId: breaker.id };
      }
    }

    // Still have test slots — allow trigger and decrement
    breaker.halfOpenTestsRemaining = (breaker.halfOpenTestsRemaining ?? 1) - 1;
    breaker.triggerLog.push(now);
    breaker.updatedAt = now;
    await writeJsonAtomic(filePath, breaker);
    return { allowed: true };
  }

  // Closed state — record trigger and check velocity
  breaker.triggerLog.push(now);
  const recentCount = breaker.triggerLog.filter((ts) => Date.parse(ts) >= nowMs - 60_000).length;

  if (recentCount > maxRate) {
    // Trip the breaker
    breaker.state = "open";
    breaker.trippedAt = now;
    breaker.trippedReason = `Velocity exceeded: ${recentCount} triggers/min > max ${maxRate}`;
    breaker.stats = breaker.stats ?? { totalTrips: 0, blockedTriggers: 0 };
    breaker.stats.totalTrips = (breaker.stats.totalTrips ?? 0) + 1;
    breaker.stats.lastTripAt = now;
    breaker.updatedAt = now;
    await writeJsonAtomic(filePath, breaker);
    return { allowed: false, reason: breaker.trippedReason, breakerId: breaker.id };
  }

  breaker.updatedAt = now;
  await writeJsonAtomic(filePath, breaker);
  return { allowed: true };
}

async function checkQueueDepthBreaker(
  opts: {
    projectsRoot: string;
    schemas: SchemaRegistry;
    projectId: string;
    ruleId: string;
    queueDepth?: number;
    throughputPerMin?: number;
  },
  policy: CircuitBreakerPolicy,
  now: string,
): Promise<{ allowed: boolean; reason?: string; breakerId?: string }> {
  const maxRatio = policy.defaultMaxQueueDepthRatio ?? 5;
  const cooldownMs = policy.defaultCooldownMs ?? 60000;
  const throughput = opts.throughputPerMin ?? 1;
  const queueDepth = opts.queueDepth ?? 0;
  const ratio = throughput > 0 ? queueDepth / throughput : 0;
  const nowMs = Date.parse(now);

  // Find existing breaker
  let breaker = await getCircuitBreakerForRule(opts.projectsRoot, opts.projectId, opts.ruleId, "queue_depth");

  // If ratio is OK and there's an open breaker, try to recover it
  if (ratio <= maxRatio) {
    if (breaker && breaker.state === "open" && breaker.trippedAt) {
      const elapsed = nowMs - Date.parse(breaker.trippedAt);
      if (elapsed >= cooldownMs) {
        // Cooldown elapsed and ratio is back to normal — reset to closed
        const filePath = path.join(opts.projectsRoot, opts.projectId, "circuit-breakers", `${breaker.id}.json`);
        breaker.state = "closed";
        delete breaker.trippedAt;
        delete breaker.trippedReason;
        breaker.updatedAt = now;
        await writeJsonAtomic(filePath, breaker);
      }
    }
    return { allowed: true };
  }

  // Ratio exceeds threshold — trip or keep open
  if (!breaker) {
    breaker = await createCircuitBreaker({
      projectsRoot: opts.projectsRoot,
      schemas: opts.schemas,
      projectId: opts.projectId,
      ruleId: opts.ruleId,
      type: "queue_depth",
      config: {
        maxQueueDepthRatio: maxRatio,
        cooldownMs,
      },
    });
  }

  const filePath = path.join(opts.projectsRoot, opts.projectId, "circuit-breakers", `${breaker.id}.json`);
  breaker.state = "open";
  breaker.trippedAt = now;
  breaker.trippedReason = `Queue depth ratio ${ratio.toFixed(1)} exceeds max ${maxRatio}`;
  breaker.stats = breaker.stats ?? { totalTrips: 0, blockedTriggers: 0 };
  breaker.stats.totalTrips = (breaker.stats.totalTrips ?? 0) + 1;
  breaker.stats.lastTripAt = now;
  breaker.stats.blockedTriggers = (breaker.stats.blockedTriggers ?? 0) + 1;
  breaker.updatedAt = now;
  await writeJsonAtomic(filePath, breaker);

  return { allowed: false, reason: breaker.trippedReason, breakerId: breaker.id };
}

/**
 * Reset a circuit breaker to closed state.
 */
export async function resetCircuitBreaker(opts: {
  projectsRoot: string;
  schemas: SchemaRegistry;
  projectId: string;
  breakerId: string;
}): Promise<CircuitBreaker | null> {
  const filePath = path.join(opts.projectsRoot, opts.projectId, "circuit-breakers", `${opts.breakerId}.json`);
  if (!(await fileExists(filePath))) return null;
  const breaker = await readJson<CircuitBreaker>(filePath);

  breaker.state = "closed";
  delete breaker.trippedAt;
  delete breaker.trippedReason;
  delete breaker.halfOpenAt;
  delete breaker.halfOpenTestsRemaining;
  breaker.updatedAt = nowIso();

  opts.schemas.validateOrThrow("circuit-breaker.schema.json", breaker);
  await writeJsonAtomic(filePath, breaker);
  return breaker;
}
