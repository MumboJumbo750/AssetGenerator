import path from "node:path";

import type { FastifyInstance } from "fastify";

import type { SchemaRegistry } from "../lib/schemas";
import {
  getProjectLora,
  getSharedLora,
  listProjectLoras,
  listSharedLoras,
  updateProjectLora,
  updateSharedLora,
  type LoraUpdatePatch,
} from "../services/loras";

export async function registerLoraRoutes(app: FastifyInstance, opts: { dataRoot: string; schemas: SchemaRegistry }) {
  const projectsRoot = path.join(opts.dataRoot, "projects");

  app.get("/api/projects/:projectId/loras", async (req) => {
    const { projectId } = req.params as { projectId: string };
    const loras = await listProjectLoras(projectsRoot, projectId);
    return { loras };
  });

  app.get("/api/projects/:projectId/loras/:loraId", async (req, reply) => {
    const { projectId, loraId } = req.params as { projectId: string; loraId: string };
    const lora = await getProjectLora(projectsRoot, projectId, loraId);
    if (!lora) return reply.code(404).send({ error: "LoRA not found" });
    return lora;
  });

  app.patch("/api/projects/:projectId/loras/:loraId", async (req, reply) => {
    const { projectId, loraId } = req.params as { projectId: string; loraId: string };
    const patch = (req.body as LoraUpdatePatch | null) ?? {};
    try {
      const updated = await updateProjectLora(projectsRoot, opts.schemas, projectId, loraId, patch);
      if (!updated) return reply.code(404).send({ error: "LoRA not found" });
      return updated;
    } catch (err: any) {
      return reply.code(400).send({ error: err?.message ?? String(err) });
    }
  });

  app.get("/api/shared/loras", async () => {
    const loras = await listSharedLoras(opts.dataRoot);
    return { loras };
  });

  app.get("/api/shared/loras/:loraId", async (req, reply) => {
    const { loraId } = req.params as { loraId: string };
    const lora = await getSharedLora(opts.dataRoot, loraId);
    if (!lora) return reply.code(404).send({ error: "LoRA not found" });
    return lora;
  });

  app.patch("/api/shared/loras/:loraId", async (req, reply) => {
    const { loraId } = req.params as { loraId: string };
    const patch = (req.body as LoraUpdatePatch | null) ?? {};
    try {
      const updated = await updateSharedLora(opts.dataRoot, opts.schemas, loraId, patch);
      if (!updated) return reply.code(404).send({ error: "LoRA not found" });
      return updated;
    } catch (err: any) {
      return reply.code(400).send({ error: err?.message ?? String(err) });
    }
  });
}
