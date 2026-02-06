import path from "node:path";

import type { FastifyInstance } from "fastify";

import { fileExists } from "../lib/json";
import type { SchemaRegistry } from "../lib/schemas";
import {
  createAutomationRule,
  createAutomationRun,
  getAutomationRule,
  listAutomationRules,
  listAutomationRuns,
  triggerAutomationEvent,
  updateAutomationRule,
  updateAutomationRun,
  type AutomationRule,
} from "../services/automation";

export async function registerAutomationRoutes(
  app: FastifyInstance,
  opts: { dataRoot: string; schemas: SchemaRegistry },
) {
  const projectsRoot = path.join(opts.dataRoot, "projects");

  app.get("/api/projects/:projectId/automation/rules", async (req) => {
    const { projectId } = req.params as { projectId: string };
    const rules = await listAutomationRules(projectsRoot, projectId);
    return { rules };
  });

  app.get("/api/projects/:projectId/automation/rules/:ruleId", async (req, reply) => {
    const { projectId, ruleId } = req.params as { projectId: string; ruleId: string };
    const rule = await getAutomationRule(projectsRoot, projectId, ruleId);
    if (!rule) return reply.code(404).send({ error: "Rule not found" });
    return { rule };
  });

  app.post("/api/projects/:projectId/automation/rules", async (req, reply) => {
    const { projectId } = req.params as { projectId: string };
    const body = req.body as Partial<AutomationRule> | null;
    if (!body?.name) return reply.code(400).send({ error: "name is required" });
    if (!body?.trigger) return reply.code(400).send({ error: "trigger is required" });
    if (!body?.actions?.length) return reply.code(400).send({ error: "actions are required" });

    const projectJsonPath = path.join(projectsRoot, projectId, "project.json");
    if (!(await fileExists(projectJsonPath))) return reply.code(404).send({ error: "Project not found" });

    const rule = await createAutomationRule({
      projectsRoot,
      schemas: opts.schemas,
      projectId,
      name: body.name,
      description: body.description,
      enabled: body.enabled,
      trigger: body.trigger as AutomationRule["trigger"],
      actions: body.actions as AutomationRule["actions"],
      conditions: body.conditions as Record<string, unknown> | undefined,
      notes: body.notes,
    });
    return reply.code(201).send({ rule });
  });

  app.put("/api/projects/:projectId/automation/rules/:ruleId", async (req, reply) => {
    const { projectId, ruleId } = req.params as { projectId: string; ruleId: string };
    const patch = (req.body ?? {}) as Partial<AutomationRule>;
    const rule = await updateAutomationRule({
      projectsRoot,
      schemas: opts.schemas,
      projectId,
      ruleId,
      patch: {
        name: patch.name,
        description: patch.description,
        enabled: patch.enabled,
        trigger: patch.trigger as AutomationRule["trigger"] | undefined,
        actions: patch.actions as AutomationRule["actions"] | undefined,
        conditions: patch.conditions as Record<string, unknown> | undefined,
        notes: patch.notes,
        lastRunAt: patch.lastRunAt,
      },
    });
    if (!rule) return reply.code(404).send({ error: "Rule not found" });
    return { rule };
  });

  app.get("/api/projects/:projectId/automation/runs", async (req) => {
    const { projectId } = req.params as { projectId: string };
    const runs = await listAutomationRuns(projectsRoot, projectId);
    return { runs };
  });

  app.post("/api/projects/:projectId/automation/runs", async (req, reply) => {
    const { projectId } = req.params as { projectId: string };
    const body = req.body as { ruleId?: string; dryRun?: boolean; meta?: Record<string, unknown> } | null;
    if (!body?.ruleId) return reply.code(400).send({ error: "ruleId is required" });

    const projectJsonPath = path.join(projectsRoot, projectId, "project.json");
    if (!(await fileExists(projectJsonPath))) return reply.code(404).send({ error: "Project not found" });

    const run = await createAutomationRun({
      projectsRoot,
      schemas: opts.schemas,
      projectId,
      ruleId: body.ruleId,
      dryRun: body.dryRun,
      meta: body.meta,
    });
    return reply.code(201).send({ run });
  });

  /**
   * Execute a single run — now queue-only (sets status to "queued").
   * The worker picks up queued runs asynchronously.
   */
  app.post("/api/projects/:projectId/automation/runs/:runId/execute", async (req, reply) => {
    const { projectId, runId } = req.params as { projectId: string; runId: string };
    const run = await updateAutomationRun({
      projectsRoot,
      schemas: opts.schemas,
      projectId,
      runId,
      patch: { status: "queued" },
    });
    if (!run) return reply.code(404).send({ error: "Run not found" });
    return { run };
  });

  /**
   * Create + queue a run — now queue-only (creates with status "queued").
   * The worker picks up queued runs asynchronously.
   */
  app.post("/api/projects/:projectId/automation/runs/execute", async (req, reply) => {
    const { projectId } = req.params as { projectId: string };
    const body = req.body as { ruleId?: string; dryRun?: boolean; meta?: Record<string, unknown> } | null;
    if (!body?.ruleId) return reply.code(400).send({ error: "ruleId is required" });

    const projectJsonPath = path.join(projectsRoot, projectId, "project.json");
    if (!(await fileExists(projectJsonPath))) return reply.code(404).send({ error: "Project not found" });

    const run = await createAutomationRun({
      projectsRoot,
      schemas: opts.schemas,
      projectId,
      ruleId: body.ruleId,
      dryRun: body.dryRun,
      meta: body.meta,
    });
    // Run stays queued — worker will execute it asynchronously
    return reply.code(201).send({ run });
  });

  app.post("/api/projects/:projectId/automation/events", async (req, reply) => {
    const { projectId } = req.params as { projectId: string };
    const body = req.body as { type?: AutomationRule["trigger"]["type"]; payload?: Record<string, unknown> } | null;
    if (!body?.type) return reply.code(400).send({ error: "type is required" });

    const projectJsonPath = path.join(projectsRoot, projectId, "project.json");
    if (!(await fileExists(projectJsonPath))) return reply.code(404).send({ error: "Project not found" });

    const runs = await triggerAutomationEvent({
      projectsRoot,
      schemas: opts.schemas,
      projectId,
      event: { type: body.type, payload: body.payload ?? {} },
    });
    return reply.code(201).send({ runs });
  });
}
