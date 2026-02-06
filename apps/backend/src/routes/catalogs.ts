import path from "node:path";

import type { FastifyInstance } from "fastify";

import { fileExists } from "../lib/json";
import type { SchemaRegistry } from "../lib/schemas";
import { getCatalog, getCatalogEntry, putCatalog } from "../services/catalogs";

export async function registerCatalogRoutes(app: FastifyInstance, opts: { dataRoot: string; schemas: SchemaRegistry }) {
  const projectsRoot = path.join(opts.dataRoot, "projects");

  async function checkpointExists(projectId: string, checkpointId: string) {
    return fileExists(path.join(projectsRoot, projectId, "checkpoints", `${checkpointId}.json`));
  }

  async function getCatalogHandler(
    params: { projectId: string; catalogId: string },
    query: { checkpointId?: string; includeMeta?: string },
  ) {
    const { projectId, catalogId } = params;
    const entry = getCatalogEntry(catalogId);
    if (!entry) return { status: 404 as const, body: { error: "Unknown catalogId" } };
    if (query.checkpointId && !(await checkpointExists(projectId, query.checkpointId))) {
      return { status: 404 as const, body: { error: "Checkpoint not found" } };
    }
    const result = await getCatalog({
      projectsRoot,
      projectId,
      catalogId,
      checkpointId: query.checkpointId,
      resolveFallback: true,
    });
    if (!result) return { status: 404 as const, body: { error: "Catalog not found" } };
    if (query.includeMeta === "1") {
      return {
        status: 200 as const,
        body: {
          catalog: result.catalog,
          resolvedScope: result.resolvedScope,
          checkpointId: query.checkpointId ?? null,
        },
      };
    }
    return { status: 200 as const, body: result.catalog, resolvedScope: result.resolvedScope };
  }

  async function putCatalogHandler(
    params: { projectId: string; catalogId: string },
    query: { checkpointId?: string },
    body: unknown,
  ) {
    const { projectId, catalogId } = params;
    const entry = getCatalogEntry(catalogId);
    if (!entry) return { status: 404 as const, body: { error: "Unknown catalogId" } };
    if (query.checkpointId && !(await checkpointExists(projectId, query.checkpointId))) {
      return { status: 404 as const, body: { error: "Checkpoint not found" } };
    }

    const projectExists = await fileExists(path.join(projectsRoot, projectId, "project.json"));
    if (!projectExists) return { status: 404 as const, body: { error: "Project not found" } };

    const result = await putCatalog({
      projectsRoot,
      schemas: opts.schemas,
      projectId,
      catalogId,
      checkpointId: query.checkpointId,
      body,
    });
    if (!result) return { status: 404 as const, body: { error: "Unknown catalogId" } };
    return { status: 200 as const, body: result };
  }

  app.get("/api/projects/:projectId/catalogs/:catalogId", async (req, reply) => {
    const { projectId, catalogId } = req.params as { projectId: string; catalogId: string };
    const { checkpointId, includeMeta } = (req.query as { checkpointId?: string; includeMeta?: string }) ?? {};
    const result = await getCatalogHandler({ projectId, catalogId }, { checkpointId, includeMeta });
    if ((result as any).resolvedScope) reply.header("x-catalog-resolved-scope", (result as any).resolvedScope);
    return reply.code(result.status).send(result.body);
  });

  app.put("/api/projects/:projectId/catalogs/:catalogId", async (req, reply) => {
    const { projectId, catalogId } = req.params as { projectId: string; catalogId: string };
    const { checkpointId } = (req.query as { checkpointId?: string }) ?? {};
    const body = req.body as unknown;
    const result = await putCatalogHandler({ projectId, catalogId }, { checkpointId }, body);
    return reply.code(result.status).send(result.body);
  });

  app.get("/api/projects/:projectId/checkpoints/:checkpointId/catalogs/:catalogId", async (req, reply) => {
    const { projectId, checkpointId, catalogId } = req.params as {
      projectId: string;
      checkpointId: string;
      catalogId: string;
    };
    const { includeMeta } = (req.query as { includeMeta?: string }) ?? {};
    const result = await getCatalogHandler({ projectId, catalogId }, { checkpointId, includeMeta });
    if ((result as any).resolvedScope) reply.header("x-catalog-resolved-scope", (result as any).resolvedScope);
    return reply.code(result.status).send(result.body);
  });

  app.put("/api/projects/:projectId/checkpoints/:checkpointId/catalogs/:catalogId", async (req, reply) => {
    const { projectId, checkpointId, catalogId } = req.params as {
      projectId: string;
      checkpointId: string;
      catalogId: string;
    };
    const body = req.body as unknown;
    const result = await putCatalogHandler({ projectId, catalogId }, { checkpointId }, body);
    return reply.code(result.status).send(result.body);
  });
}
