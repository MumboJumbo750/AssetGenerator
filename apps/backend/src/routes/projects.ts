import path from "node:path";

import type { FastifyInstance } from "fastify";

import type { SchemaRegistry } from "../lib/schemas";
import { createProject, getProject, listProjects, updateProject } from "../services/projects";

export async function registerProjectRoutes(app: FastifyInstance, opts: { dataRoot: string; schemas: SchemaRegistry }) {
  const projectsRoot = path.join(opts.dataRoot, "projects");

  app.get("/api/projects", async () => {
    const projects = await listProjects(projectsRoot);
    return { projects };
  });

  app.get("/api/projects/:projectId", async (req, reply) => {
    const { projectId } = req.params as { projectId: string };
    const project = await getProject(projectsRoot, projectId);
    if (!project) return reply.code(404).send({ error: "Project not found" });
    return project;
  });

  app.post("/api/projects", async (req, reply) => {
    const body = req.body as { name?: string; defaults?: { style?: string; scenario?: string } } | null;
    const name = body?.name?.trim();
    if (!name) return reply.code(400).send({ error: "name is required" });

    const project = await createProject({
      projectsRoot,
      schemas: opts.schemas,
      name,
      defaults: body?.defaults,
    });
    return reply.code(201).send(project);
  });

  app.patch("/api/projects/:projectId", async (req, reply) => {
    const { projectId } = req.params as { projectId: string };
    const body = (req.body as { policies?: unknown; notes?: string | null } | null) ?? {};
    try {
      const updated = await updateProject({ projectsRoot, schemas: opts.schemas, projectId, patch: body });
      if (!updated) return reply.code(404).send({ error: "Project not found" });
      return updated;
    } catch (err: any) {
      return reply.code(400).send({ error: err?.message ?? String(err) });
    }
  });
}
