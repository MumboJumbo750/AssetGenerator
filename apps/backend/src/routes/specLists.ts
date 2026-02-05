import path from "node:path";

import type { FastifyInstance } from "fastify";

import { fileExists } from "../lib/json";
import type { SchemaRegistry } from "../lib/schemas";
import { createSpecList, listSpecLists, updateSpecList } from "../services/specLists";

export async function registerSpecListRoutes(
  app: FastifyInstance,
  opts: { dataRoot: string; schemas: SchemaRegistry },
) {
  const projectsRoot = path.join(opts.dataRoot, "projects");

  app.get("/api/projects/:projectId/spec-lists", async (req) => {
    const { projectId } = req.params as { projectId: string };
    const specLists = await listSpecLists(projectsRoot, projectId);
    return { specLists };
  });

  app.post("/api/projects/:projectId/spec-lists", async (req, reply) => {
    const { projectId } = req.params as { projectId: string };
    const body = req.body as { title?: string; text?: string } | null;
    const title = body?.title?.trim();
    const text = body?.text?.trim();
    if (!title || !text) return reply.code(400).send({ error: "title and text are required" });

    const projectJsonPath = path.join(projectsRoot, projectId, "project.json");
    if (!(await fileExists(projectJsonPath))) return reply.code(404).send({ error: "Project not found" });

    const specList = await createSpecList({
      projectsRoot,
      schemas: opts.schemas,
      projectId,
      title,
      text,
    });
    return reply.code(201).send(specList);
  });

  app.patch("/api/projects/:projectId/spec-lists/:specListId", async (req, reply) => {
    const { projectId, specListId } = req.params as { projectId: string; specListId: string };
    const body = req.body as any;

    const projectJsonPath = path.join(projectsRoot, projectId, "project.json");
    if (!(await fileExists(projectJsonPath))) return reply.code(404).send({ error: "Project not found" });

    const updated = await updateSpecList({
      projectsRoot,
      schemas: opts.schemas,
      projectId,
      specListId,
      patch: body ?? {},
    });
    if (!updated) return reply.code(404).send({ error: "SpecList not found" });
    return reply.send(updated);
  });
}
