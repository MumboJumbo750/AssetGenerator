import path from "node:path";

import type { FastifyInstance } from "fastify";

import type { SchemaRegistry } from "../lib/schemas";
import { createExportProfile, getExportProfile, listExportProfiles, updateExportProfile, type ExportProfile } from "../services/exportProfiles";

export async function registerExportProfileRoutes(app: FastifyInstance, opts: { dataRoot: string; schemas: SchemaRegistry }) {
  const projectsRoot = path.join(opts.dataRoot, "projects");

  app.get("/api/projects/:projectId/export-profiles", async (req) => {
    const { projectId } = req.params as { projectId: string };
    const profiles = await listExportProfiles(projectsRoot, projectId);
    return { profiles };
  });

  app.get("/api/projects/:projectId/export-profiles/:profileId", async (req, reply) => {
    const { projectId, profileId } = req.params as { projectId: string; profileId: string };
    const profile = await getExportProfile(projectsRoot, projectId, profileId);
    if (!profile) return reply.code(404).send({ error: "Export profile not found" });
    return profile;
  });

  app.post("/api/projects/:projectId/export-profiles", async (req, reply) => {
    const { projectId } = req.params as { projectId: string };
    const body = (req.body ?? {}) as Partial<ExportProfile>;
    if (typeof body?.name === "string" && !body.name.trim()) return reply.code(400).send({ error: "name must not be empty" });
    const profile = await createExportProfile({
      projectsRoot,
      schemas: opts.schemas,
      projectId,
      body: { ...body, name: typeof body?.name === "string" ? body.name.trim() : body?.name }
    });
    return reply.code(201).send(profile);
  });

  app.patch("/api/projects/:projectId/export-profiles/:profileId", async (req, reply) => {
    const { projectId, profileId } = req.params as { projectId: string; profileId: string };
    const body = (req.body ?? {}) as Partial<ExportProfile>;
    if (typeof body?.name === "string" && !body.name.trim()) return reply.code(400).send({ error: "name must not be empty" });
    const profile = await updateExportProfile({
      projectsRoot,
      schemas: opts.schemas,
      projectId,
      profileId,
      patch: { ...body, name: typeof body?.name === "string" ? body.name.trim() : body?.name }
    });
    if (!profile) return reply.code(404).send({ error: "Export profile not found" });
    return reply.code(200).send(profile);
  });
}
