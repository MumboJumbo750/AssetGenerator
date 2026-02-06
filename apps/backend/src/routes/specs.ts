import path from "node:path";

import type { FastifyInstance } from "fastify";

import { fileExists, readJson } from "../lib/json";
import type { SchemaRegistry } from "../lib/schemas";
import { createSpec, getSpec, listSpecs, updateSpec, type AssetSpec } from "../services/specs";
import { triggerAutomationEvent } from "../services/automation";

export async function registerSpecRoutes(app: FastifyInstance, opts: { dataRoot: string; schemas: SchemaRegistry }) {
  const projectsRoot = path.join(opts.dataRoot, "projects");

  app.get("/api/projects/:projectId/specs", async (req) => {
    const { projectId } = req.params as { projectId: string };
    const specs = await listSpecs(projectsRoot, projectId);
    return { specs };
  });

  app.get("/api/projects/:projectId/specs/:specId", async (req, reply) => {
    const { projectId, specId } = req.params as { projectId: string; specId: string };
    const spec = await getSpec(projectsRoot, projectId, specId);
    if (!spec) return reply.code(404).send({ error: "Spec not found" });
    return spec;
  });

  app.post("/api/projects/:projectId/specs", async (req, reply) => {
    const { projectId } = req.params as { projectId: string };
    const body = req.body as Partial<AssetSpec> | null;
    const title = body?.title?.trim();
    const assetType = body?.assetType?.trim();
    if (!title || !assetType) return reply.code(400).send({ error: "title and assetType are required" });

    const projectJsonPath = path.join(projectsRoot, projectId, "project.json");
    if (!(await fileExists(projectJsonPath))) return reply.code(404).send({ error: "Project not found" });
    const project = await readJson<any>(projectJsonPath);

    const spec = await createSpec({
      projectsRoot,
      schemas: opts.schemas,
      projectId,
      spec: {
        ...body,
        style: body?.style ?? project?.defaults?.style ?? "cartoon",
        scenario: body?.scenario ?? project?.defaults?.scenario ?? "fantasy",
        generationParams: body?.generationParams ?? { width: 512, height: 512, variants: 4 },
        status: body?.status ?? "ready",
      },
    });
    if (spec.status === "ready") {
      await triggerAutomationEvent({
        projectsRoot,
        schemas: opts.schemas,
        projectId,
        event: { type: "spec_refined", payload: { specId: spec.id, assetType: spec.assetType, status: spec.status } },
      });
    }
    return reply.code(201).send(spec);
  });

  app.patch("/api/projects/:projectId/specs/:specId", async (req, reply) => {
    const { projectId, specId } = req.params as { projectId: string; specId: string };
    const body = req.body as Partial<AssetSpec> | null;
    const before = await getSpec(projectsRoot, projectId, specId);
    const prevStatus = before?.status;
    const spec = await updateSpec({
      projectsRoot,
      schemas: opts.schemas,
      projectId,
      specId,
      patch: body ?? {},
    });
    if (!spec) return reply.code(404).send({ error: "Spec not found" });
    if (prevStatus !== "ready" && spec.status === "ready") {
      await triggerAutomationEvent({
        projectsRoot,
        schemas: opts.schemas,
        projectId,
        event: { type: "spec_refined", payload: { specId: spec.id, assetType: spec.assetType, status: spec.status } },
      });
    }
    return reply.code(200).send(spec);
  });
}
