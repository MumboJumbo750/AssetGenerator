import fs from "node:fs/promises";
import path from "node:path";

import type { FastifyInstance } from "fastify";

import { getAtlas, listAtlases } from "../services/atlases";

export async function registerAtlasRoutes(app: FastifyInstance, opts: { dataRoot: string }) {
  const projectsRoot = path.join(opts.dataRoot, "projects");

  app.get("/api/projects/:projectId/atlases", async (req) => {
    const { projectId } = req.params as { projectId: string };
    const atlases = await listAtlases(projectsRoot, projectId);
    return { atlases };
  });

  app.get("/api/projects/:projectId/atlases/:atlasId", async (req, reply) => {
    const { projectId, atlasId } = req.params as { projectId: string; atlasId: string };
    const atlas = await getAtlas(projectsRoot, projectId, atlasId);
    if (!atlas) return reply.code(404).send({ error: "Atlas not found" });
    return atlas;
  });

  app.patch("/api/projects/:projectId/atlases/:atlasId", async (req, reply) => {
    const { projectId, atlasId } = req.params as { projectId: string; atlasId: string };
    const body = req.body as { frames?: Array<{ id: string; pivot?: { x: number; y: number } }> } | null;
    const atlas = await getAtlas(projectsRoot, projectId, atlasId);
    if (!atlas) return reply.code(404).send({ error: "Atlas not found" });
    if (!body?.frames) return reply.code(400).send({ error: "frames are required" });

    const framesById = new Map(body.frames.map((f) => [f.id, f]));
    const updated = {
      ...atlas,
      updatedAt: new Date().toISOString(),
      frames: atlas.frames.map((frame) => {
        const incoming = framesById.get(frame.id);
        if (!incoming?.pivot) return frame;
        return { ...frame, pivot: incoming.pivot };
      })
    };

    const atlasPath = path.join(projectsRoot, projectId, "atlases", `${atlasId}.json`);
    await fs.mkdir(path.dirname(atlasPath), { recursive: true });
    await fs.writeFile(atlasPath, JSON.stringify(updated, null, 2) + "\n", "utf8");
    return reply.code(200).send(updated);
  });
}
