import path from "node:path";

import type { FastifyInstance } from "fastify";

import { fileExists } from "../lib/json";
import type { SchemaRegistry } from "../lib/schemas";
import { getCatalog, getCatalogEntry, putCatalog } from "../services/catalogs";

export async function registerCatalogRoutes(app: FastifyInstance, opts: { dataRoot: string; schemas: SchemaRegistry }) {
  const projectsRoot = path.join(opts.dataRoot, "projects");

  app.get("/api/projects/:projectId/catalogs/:catalogId", async (req, reply) => {
    const { projectId, catalogId } = req.params as { projectId: string; catalogId: string };
    const entry = getCatalogEntry(catalogId);
    if (!entry) return reply.code(404).send({ error: "Unknown catalogId" });

    const catalog = await getCatalog({ projectsRoot, projectId, catalogId });
    if (!catalog) return reply.code(404).send({ error: "Catalog not found" });
    return catalog;
  });

  app.put("/api/projects/:projectId/catalogs/:catalogId", async (req, reply) => {
    const { projectId, catalogId } = req.params as { projectId: string; catalogId: string };
    const entry = getCatalogEntry(catalogId);
    if (!entry) return reply.code(404).send({ error: "Unknown catalogId" });
    const body = req.body as unknown;

    const projectExists = await fileExists(path.join(projectsRoot, projectId, "project.json"));
    if (!projectExists) return reply.code(404).send({ error: "Project not found" });

    const result = await putCatalog({ projectsRoot, schemas: opts.schemas, projectId, catalogId, body });
    if (!result) return reply.code(404).send({ error: "Unknown catalogId" });
    return reply.code(200).send(result);
  });
}
