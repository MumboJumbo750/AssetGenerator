import path from "node:path";

import type { FastifyInstance } from "fastify";

import type { SchemaRegistry } from "../lib/schemas";
import {
  createProjectCheckpoint,
  getProjectCheckpoint,
  listProjectCheckpoints,
  updateProjectCheckpoint,
  type CheckpointRecord,
} from "../services/checkpoints";

export async function registerCheckpointRoutes(
  app: FastifyInstance,
  opts: { dataRoot: string; schemas: SchemaRegistry },
) {
  const projectsRoot = path.join(opts.dataRoot, "projects");

  app.get("/api/projects/:projectId/checkpoints", async (req) => {
    const { projectId } = req.params as { projectId: string };
    const checkpoints = await listProjectCheckpoints(projectsRoot, projectId);
    return { checkpoints };
  });

  app.get("/api/projects/:projectId/checkpoints/:checkpointId", async (req, reply) => {
    const { projectId, checkpointId } = req.params as { projectId: string; checkpointId: string };
    const checkpoint = await getProjectCheckpoint(projectsRoot, projectId, checkpointId);
    if (!checkpoint) return reply.code(404).send({ error: "Checkpoint not found" });
    return checkpoint;
  });

  app.post("/api/projects/:projectId/checkpoints", async (req, reply) => {
    const { projectId } = req.params as { projectId: string };
    const body = (req.body as Partial<CheckpointRecord> | null) ?? {};
    try {
      const checkpoint = await createProjectCheckpoint({
        projectsRoot,
        schemas: opts.schemas,
        projectId,
        checkpoint: body,
      });
      return reply.code(201).send(checkpoint);
    } catch (err: any) {
      return reply.code(400).send({ error: err?.message ?? String(err) });
    }
  });

  app.patch("/api/projects/:projectId/checkpoints/:checkpointId", async (req, reply) => {
    const { projectId, checkpointId } = req.params as { projectId: string; checkpointId: string };
    const body = (req.body as Partial<CheckpointRecord> | null) ?? {};
    try {
      const checkpoint = await updateProjectCheckpoint({
        projectsRoot,
        schemas: opts.schemas,
        projectId,
        checkpointId,
        patch: body,
      });
      if (!checkpoint) return reply.code(404).send({ error: "Checkpoint not found" });
      return checkpoint;
    } catch (err: any) {
      return reply.code(400).send({ error: err?.message ?? String(err) });
    }
  });
}
