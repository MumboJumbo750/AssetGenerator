import path from "node:path";

import type { FastifyInstance } from "fastify";

import { getProjectEval, getSharedEval, listProjectEvals, listSharedEvals } from "../services/evals";

export async function registerEvalRoutes(app: FastifyInstance, opts: { dataRoot: string }) {
  const projectsRoot = path.join(opts.dataRoot, "projects");

  app.get("/api/projects/:projectId/evals", async (req) => {
    const { projectId } = req.params as { projectId: string };
    const evals = await listProjectEvals(projectsRoot, projectId);
    return { evals };
  });

  app.get("/api/projects/:projectId/evals/:evalId", async (req, reply) => {
    const { projectId, evalId } = req.params as { projectId: string; evalId: string };
    const evalRecord = await getProjectEval(projectsRoot, projectId, evalId);
    if (!evalRecord) return reply.code(404).send({ error: "Eval not found" });
    return evalRecord;
  });

  app.get("/api/shared/evals", async () => {
    const evals = await listSharedEvals(opts.dataRoot);
    return { evals };
  });

  app.get("/api/shared/evals/:evalId", async (req, reply) => {
    const { evalId } = req.params as { evalId: string };
    const evalRecord = await getSharedEval(opts.dataRoot, evalId);
    if (!evalRecord) return reply.code(404).send({ error: "Eval not found" });
    return evalRecord;
  });
}
