import path from "node:path";

import type { FastifyInstance } from "fastify";

import type { SchemaRegistry } from "../lib/schemas";
import { listMetricsSnapshots, getMetricsSnapshot, generateMetricsSnapshot } from "../services/metrics";
import { listReleaseGateReports, getReleaseGateReport, evaluateReleaseGates } from "../services/releaseGates";

export async function registerMetricsRoutes(app: FastifyInstance, opts: { dataRoot: string; schemas: SchemaRegistry }) {
  const projectsRoot = path.join(opts.dataRoot, "projects");

  // ── Operational metrics snapshots ──────────────────────────────────

  app.get<{ Params: { projectId: string }; Querystring: { limit?: string } }>(
    "/api/projects/:projectId/metrics",
    async (req) => {
      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      const snapshots = await listMetricsSnapshots(projectsRoot, req.params.projectId, { limit });
      return { snapshots };
    },
  );

  app.get<{ Params: { projectId: string; snapshotId: string } }>(
    "/api/projects/:projectId/metrics/:snapshotId",
    async (req, reply) => {
      const snapshot = await getMetricsSnapshot(projectsRoot, req.params.projectId, req.params.snapshotId);
      if (!snapshot) return reply.status(404).send({ error: "Metrics snapshot not found" });
      return { snapshot };
    },
  );

  app.post<{ Params: { projectId: string } }>("/api/projects/:projectId/metrics/generate", async (req) => {
    const snapshot = await generateMetricsSnapshot({
      projectsRoot,
      schemas: opts.schemas,
      projectId: req.params.projectId,
    });
    return { snapshot };
  });

  // ── Release gate reports ───────────────────────────────────────────

  app.get<{ Params: { projectId: string }; Querystring: { limit?: string } }>(
    "/api/projects/:projectId/release-gates",
    async (req) => {
      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      const reports = await listReleaseGateReports(projectsRoot, req.params.projectId, { limit });
      return { reports };
    },
  );

  app.get<{ Params: { projectId: string; reportId: string } }>(
    "/api/projects/:projectId/release-gates/:reportId",
    async (req, reply) => {
      const report = await getReleaseGateReport(projectsRoot, req.params.projectId, req.params.reportId);
      if (!report) return reply.status(404).send({ error: "Release gate report not found" });
      return { report };
    },
  );

  app.post<{ Params: { projectId: string } }>("/api/projects/:projectId/release-gates/evaluate", async (req) => {
    const report = await evaluateReleaseGates({
      projectsRoot,
      schemas: opts.schemas,
      projectId: req.params.projectId,
    });
    return { report };
  });
}
