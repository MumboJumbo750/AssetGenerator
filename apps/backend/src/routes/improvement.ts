import path from "node:path";

import type { FastifyInstance } from "fastify";

import { fileExists } from "../lib/json";
import type { SchemaRegistry } from "../lib/schemas";
import { appendProjectEvent } from "../services/events";
import {
  createImprovementRun,
  getImprovementRun,
  listImprovementRuns,
  updateImprovementRun,
  promoteImprovementRun,
  rollbackImprovementRun,
  sampleCohortMetrics,
  computeMetricDelta,
  type ImprovementRun,
} from "../services/improvementRuns";
import {
  listCircuitBreakers,
  getCircuitBreaker,
  createCircuitBreaker,
  resetCircuitBreaker,
  recordTriggerAndCheck,
} from "../services/circuitBreakers";
import { backtestRule, analyzeValidatorGaps } from "../services/backtestAndGap";
import { listTrendSnapshots, getTrendSnapshot, generateTrendSnapshot } from "../services/trends";

export async function registerImprovementRoutes(
  app: FastifyInstance,
  opts: { dataRoot: string; schemas: SchemaRegistry },
) {
  const projectsRoot = path.join(opts.dataRoot, "projects");

  // ── Improvement Runs ──────────────────────────────────────────────

  app.get("/api/projects/:projectId/improvement-runs", async (req) => {
    const { projectId } = req.params as { projectId: string };
    return { runs: await listImprovementRuns(projectsRoot, projectId) };
  });

  app.get("/api/projects/:projectId/improvement-runs/:runId", async (req, reply) => {
    const { projectId, runId } = req.params as { projectId: string; runId: string };
    const run = await getImprovementRun(projectsRoot, projectId, runId);
    if (!run) return reply.code(404).send({ error: "Improvement run not found" });
    return { run };
  });

  app.post("/api/projects/:projectId/improvement-runs", async (req, reply) => {
    const { projectId } = req.params as { projectId: string };
    const body = req.body as Partial<ImprovementRun> | null;
    if (!body?.name) return reply.code(400).send({ error: "name is required" });
    if (!body?.cohort) return reply.code(400).send({ error: "cohort is required" });
    if (!body?.intervention) return reply.code(400).send({ error: "intervention is required" });

    const projectJsonPath = path.join(projectsRoot, projectId, "project.json");
    if (!(await fileExists(projectJsonPath))) return reply.code(404).send({ error: "Project not found" });

    const run = await createImprovementRun({
      projectsRoot,
      schemas: opts.schemas,
      projectId,
      name: body.name,
      description: body.description,
      cohort: body.cohort as ImprovementRun["cohort"],
      intervention: body.intervention as ImprovementRun["intervention"],
      notes: body.notes,
    });
    return reply.code(201).send({ run });
  });

  app.patch("/api/projects/:projectId/improvement-runs/:runId", async (req, reply) => {
    const { projectId, runId } = req.params as { projectId: string; runId: string };
    const patch = (req.body ?? {}) as Partial<ImprovementRun>;
    const run = await updateImprovementRun({
      projectsRoot,
      schemas: opts.schemas,
      projectId,
      runId,
      patch,
    });
    if (!run) return reply.code(404).send({ error: "Improvement run not found" });
    return { run };
  });

  // Start run: sample "before" metrics
  app.post("/api/projects/:projectId/improvement-runs/:runId/start", async (req, reply) => {
    const { projectId, runId } = req.params as { projectId: string; runId: string };
    const run = await getImprovementRun(projectsRoot, projectId, runId);
    if (!run) return reply.code(404).send({ error: "Improvement run not found" });
    if (run.status !== "draft")
      return reply.code(400).send({ error: `Cannot start run in '${run.status}' status — must be 'draft'` });

    const before = await sampleCohortMetrics(projectsRoot, projectId, run.cohort.resolvedSpecIds ?? []);
    const updated = await updateImprovementRun({
      projectsRoot,
      schemas: opts.schemas,
      projectId,
      runId,
      patch: { status: "running", metrics: { before } },
    });
    await appendProjectEvent({
      projectsRoot,
      schemas: opts.schemas,
      event: {
        projectId,
        type: "improvement_run_started",
        entityType: "improvement_run",
        entityId: runId,
        idempotencyKey: `improvement_run:${runId}:started`,
        payload: { cohortSize: run.cohort.resolvedCount },
      },
    }).catch(() => undefined);
    return { run: updated };
  });

  // Complete run: sample "after" metrics and compute delta
  app.post("/api/projects/:projectId/improvement-runs/:runId/complete", async (req, reply) => {
    const { projectId, runId } = req.params as { projectId: string; runId: string };
    const run = await getImprovementRun(projectsRoot, projectId, runId);
    if (!run) return reply.code(404).send({ error: "Improvement run not found" });
    if (run.status !== "running")
      return reply.code(400).send({ error: `Cannot complete run in '${run.status}' status — must be 'running'` });
    if (!run.metrics?.before) return reply.code(400).send({ error: "Run has no before metrics; call /start first" });

    const after = await sampleCohortMetrics(projectsRoot, projectId, run.cohort.resolvedSpecIds ?? []);
    const delta = computeMetricDelta(run.metrics.before, after);
    const updated = await updateImprovementRun({
      projectsRoot,
      schemas: opts.schemas,
      projectId,
      runId,
      patch: { status: "completed", metrics: { before: run.metrics.before, after, delta } },
    });
    await appendProjectEvent({
      projectsRoot,
      schemas: opts.schemas,
      event: {
        projectId,
        type: "improvement_run_completed",
        entityType: "improvement_run",
        entityId: runId,
        idempotencyKey: `improvement_run:${runId}:completed`,
        payload: { qualityLiftPct: delta.qualityLiftPct },
      },
    }).catch(() => undefined);
    return { run: updated };
  });

  // Promote
  app.post("/api/projects/:projectId/improvement-runs/:runId/promote", async (req, reply) => {
    const { projectId, runId } = req.params as { projectId: string; runId: string };
    try {
      const run = await promoteImprovementRun({ projectsRoot, schemas: opts.schemas, projectId, runId });
      if (!run) return reply.code(404).send({ error: "Improvement run not found" });
      return { run };
    } catch (e: any) {
      return reply.code(400).send({ error: e?.message ?? "Promote failed" });
    }
  });

  // Rollback
  app.post("/api/projects/:projectId/improvement-runs/:runId/rollback", async (req, reply) => {
    const { projectId, runId } = req.params as { projectId: string; runId: string };
    try {
      const run = await rollbackImprovementRun({ projectsRoot, schemas: opts.schemas, projectId, runId });
      if (!run) return reply.code(404).send({ error: "Improvement run not found" });
      return { run };
    } catch (e: any) {
      return reply.code(400).send({ error: e?.message ?? "Rollback failed" });
    }
  });

  // ── Circuit Breakers ──────────────────────────────────────────────

  app.get("/api/projects/:projectId/circuit-breakers", async (req) => {
    const { projectId } = req.params as { projectId: string };
    return { breakers: await listCircuitBreakers(projectsRoot, projectId) };
  });

  app.get("/api/projects/:projectId/circuit-breakers/:breakerId", async (req, reply) => {
    const { projectId, breakerId } = req.params as { projectId: string; breakerId: string };
    const breaker = await getCircuitBreaker(projectsRoot, projectId, breakerId);
    if (!breaker) return reply.code(404).send({ error: "Circuit breaker not found" });
    return { breaker };
  });

  app.post("/api/projects/:projectId/circuit-breakers", async (req, reply) => {
    const { projectId } = req.params as { projectId: string };
    const body = req.body as { ruleId?: string; type?: string; config?: Record<string, unknown> } | null;
    if (!body?.type) return reply.code(400).send({ error: "type is required" });

    const breaker = await createCircuitBreaker({
      projectsRoot,
      schemas: opts.schemas,
      projectId,
      ruleId: body.ruleId,
      type: body.type as "velocity" | "queue_depth",
      config: body.config as any,
    });
    return reply.code(201).send({ breaker });
  });

  app.post("/api/projects/:projectId/circuit-breakers/:breakerId/reset", async (req, reply) => {
    const { projectId, breakerId } = req.params as { projectId: string; breakerId: string };
    const breaker = await resetCircuitBreaker({ projectsRoot, schemas: opts.schemas, projectId, breakerId });
    if (!breaker) return reply.code(404).send({ error: "Circuit breaker not found" });
    return { breaker };
  });

  // Check + record trigger (used by worker / automation service)
  app.post("/api/projects/:projectId/circuit-breakers/check", async (req) => {
    const { projectId } = req.params as { projectId: string };
    const body = req.body as { ruleId: string; queueDepth?: number; throughputPerMin?: number } | null;
    if (!body?.ruleId) return { allowed: true };
    return recordTriggerAndCheck({
      projectsRoot,
      schemas: opts.schemas,
      projectId,
      ruleId: body.ruleId,
      queueDepth: body.queueDepth,
      throughputPerMin: body.throughputPerMin,
    });
  });

  // ── Rule Backtesting ──────────────────────────────────────────────

  app.post("/api/projects/:projectId/automation/rules/:ruleId/backtest", async (req, reply) => {
    const { projectId, ruleId } = req.params as { projectId: string; ruleId: string };
    const body = req.body as { periodFrom?: string; periodTo?: string } | null;
    try {
      const report = await backtestRule({
        projectsRoot,
        projectId,
        ruleId,
        periodFrom: body?.periodFrom,
        periodTo: body?.periodTo,
      });
      return { report };
    } catch (e: any) {
      return reply.code(404).send({ error: e?.message ?? "Backtest failed" });
    }
  });

  // ── Validator Gap Analysis ────────────────────────────────────────

  app.get("/api/projects/:projectId/validator-gaps", async (req) => {
    const { projectId } = req.params as { projectId: string };
    const report = await analyzeValidatorGaps({ projectsRoot, projectId });
    return { report };
  });

  // ── Trend Snapshots ───────────────────────────────────────────────

  app.get("/api/projects/:projectId/trends", async (req) => {
    const { projectId } = req.params as { projectId: string };
    const query = req.query as { granularity?: string; limit?: string } | undefined;
    const snapshots = await listTrendSnapshots(projectsRoot, projectId, {
      granularity: query?.granularity,
      limit: query?.limit ? parseInt(query.limit, 10) : undefined,
    });
    return { snapshots };
  });

  app.get("/api/projects/:projectId/trends/:snapshotId", async (req, reply) => {
    const { projectId, snapshotId } = req.params as { projectId: string; snapshotId: string };
    const snapshot = await getTrendSnapshot(projectsRoot, projectId, snapshotId);
    if (!snapshot) return reply.code(404).send({ error: "Trend snapshot not found" });
    return { snapshot };
  });

  app.post("/api/projects/:projectId/trends/generate", async (req, reply) => {
    const { projectId } = req.params as { projectId: string };
    const body = req.body as {
      from?: string;
      to?: string;
      granularity?: "hourly" | "daily" | "weekly";
      scope?: { checkpointId?: string; assetType?: string; entityFamily?: string; tag?: string };
    } | null;

    if (!body?.from || !body?.to) return reply.code(400).send({ error: "from and to are required" });

    const snapshot = await generateTrendSnapshot({
      projectsRoot,
      schemas: opts.schemas,
      projectId,
      from: body.from,
      to: body.to,
      granularity: body.granularity ?? "daily",
      scope: body.scope,
    });
    return reply.code(201).send({ snapshot });
  });
}
