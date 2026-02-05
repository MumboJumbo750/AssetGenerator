import path from "node:path";

import type { FastifyInstance } from "fastify";

import type { SchemaRegistry } from "../lib/schemas";
import { importAssets } from "../services/imports";

export async function registerImportRoutes(app: FastifyInstance, opts: { dataRoot: string; schemas: SchemaRegistry }) {
  const projectsRoot = path.join(opts.dataRoot, "projects");

  app.post("/api/projects/:projectId/import/assets", async (req, reply) => {
    const { projectId } = req.params as { projectId: string };
    const body = (req.body as { items?: Array<Record<string, unknown>> } | null) ?? {};
    const items = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) return reply.code(400).send({ error: "items[] is required" });

    try {
      const result = await importAssets({
        dataRoot: opts.dataRoot,
        projectsRoot,
        schemas: opts.schemas,
        projectId,
        items: items.map((item) => ({
          sourcePath: String(item.sourcePath ?? ""),
          title: typeof item.title === "string" ? item.title : undefined,
          assetType: typeof item.assetType === "string" ? item.assetType : undefined,
          style: typeof item.style === "string" ? item.style : undefined,
          scenario: typeof item.scenario === "string" ? item.scenario : undefined,
          tags: Array.isArray(item.tags) ? item.tags.map(String) : undefined,
          status: typeof item.status === "string" ? (item.status as any) : undefined,
          provenance:
            typeof item.provenance === "object" && item.provenance
              ? {
                  source:
                    typeof (item.provenance as any).source === "string" ? (item.provenance as any).source : undefined,
                  author:
                    typeof (item.provenance as any).author === "string" ? (item.provenance as any).author : undefined,
                  license:
                    typeof (item.provenance as any).license === "string" ? (item.provenance as any).license : undefined,
                  url: typeof (item.provenance as any).url === "string" ? (item.provenance as any).url : undefined,
                  notes:
                    typeof (item.provenance as any).notes === "string" ? (item.provenance as any).notes : undefined,
                }
              : undefined,
        })),
      });
      return reply.code(201).send(result);
    } catch (err: any) {
      return reply.code(400).send({ error: err?.message ?? String(err) });
    }
  });
}
