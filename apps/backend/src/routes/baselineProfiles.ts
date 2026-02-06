import path from "node:path";

import type { FastifyInstance } from "fastify";

import type { SchemaRegistry } from "../lib/schemas";
import {
  createBaselineProfile,
  getBaselineProfile,
  listBaselineProfiles,
  updateBaselineProfile,
  type BaselineProfile,
} from "../services/baselineProfiles";

export async function registerBaselineProfileRoutes(
  app: FastifyInstance,
  opts: { dataRoot: string; schemas: SchemaRegistry },
) {
  const projectsRoot = path.join(opts.dataRoot, "projects");

  app.get("/api/projects/:projectId/baseline-profiles", async (req) => {
    const { projectId } = req.params as { projectId: string };
    const profiles = await listBaselineProfiles(projectsRoot, projectId);
    return { profiles };
  });

  app.get("/api/projects/:projectId/baseline-profiles/:profileId", async (req, reply) => {
    const { projectId, profileId } = req.params as { projectId: string; profileId: string };
    const profile = await getBaselineProfile(projectsRoot, projectId, profileId);
    if (!profile) return reply.code(404).send({ error: "Baseline profile not found" });
    return profile;
  });

  app.post("/api/projects/:projectId/baseline-profiles", async (req, reply) => {
    const { projectId } = req.params as { projectId: string };
    const body = (req.body ?? {}) as Partial<BaselineProfile>;
    if (typeof body?.name === "string" && !body.name.trim())
      return reply.code(400).send({ error: "name must not be empty" });
    try {
      const profile = await createBaselineProfile({
        projectsRoot,
        schemas: opts.schemas,
        projectId,
        body: { ...body, name: typeof body?.name === "string" ? body.name.trim() : body?.name },
      });
      return reply.code(201).send(profile);
    } catch (err: any) {
      return reply.code(400).send({ error: err?.message ?? String(err) });
    }
  });

  app.patch("/api/projects/:projectId/baseline-profiles/:profileId", async (req, reply) => {
    const { projectId, profileId } = req.params as { projectId: string; profileId: string };
    const body = (req.body ?? {}) as Partial<BaselineProfile>;
    if (typeof body?.name === "string" && !body.name.trim())
      return reply.code(400).send({ error: "name must not be empty" });
    try {
      const profile = await updateBaselineProfile({
        projectsRoot,
        schemas: opts.schemas,
        projectId,
        profileId,
        patch: { ...body, name: typeof body?.name === "string" ? body.name.trim() : body?.name },
      });
      if (!profile) return reply.code(404).send({ error: "Baseline profile not found" });
      return reply.code(200).send(profile);
    } catch (err: any) {
      return reply.code(400).send({ error: err?.message ?? String(err) });
    }
  });
}
