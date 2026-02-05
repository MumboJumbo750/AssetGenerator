import path from "node:path";

import type { FastifyInstance } from "fastify";

import type { SchemaRegistry } from "../lib/schemas";
import {
  approveAssetVersion,
  getAsset,
  listAssets,
  setPrimaryVariant,
  updateAssetVariant,
  updateAssetVersion,
} from "../services/assets";
import { triggerAutomationEvent } from "../services/automation";

export async function registerAssetRoutes(app: FastifyInstance, opts: { dataRoot: string; schemas: SchemaRegistry }) {
  const projectsRoot = path.join(opts.dataRoot, "projects");

  app.get("/api/projects/:projectId/assets", async (req) => {
    const { projectId } = req.params as { projectId: string };
    const assets = await listAssets(projectsRoot, projectId);
    return { assets };
  });

  app.get("/api/projects/:projectId/assets/:assetId", async (req, reply) => {
    const { projectId, assetId } = req.params as { projectId: string; assetId: string };
    const asset = await getAsset(projectsRoot, projectId, assetId);
    if (!asset) return reply.code(404).send({ error: "Asset not found" });
    return asset;
  });

  app.post("/api/projects/:projectId/assets/:assetId/versions/:versionId/approve", async (req, reply) => {
    const { projectId, assetId, versionId } = req.params as { projectId: string; assetId: string; versionId: string };
    const asset = await approveAssetVersion({
      projectsRoot,
      schemas: opts.schemas,
      projectId,
      assetId,
      versionId,
    });
    if (!asset) return reply.code(404).send({ error: "Asset or version not found" });
    await triggerAutomationEvent({
      projectsRoot,
      schemas: opts.schemas,
      projectId,
      event: { type: "asset_approved", payload: { assetId, versionId } },
    });
    return { ok: true };
  });

  app.post("/api/projects/:projectId/assets/:assetId/versions/:versionId/primary", async (req, reply) => {
    const { projectId, assetId, versionId } = req.params as { projectId: string; assetId: string; versionId: string };
    const body = req.body as { variantId?: string } | null;
    const variantId = body?.variantId?.trim();
    if (!variantId) return reply.code(400).send({ error: "variantId is required" });

    const asset = await setPrimaryVariant({
      projectsRoot,
      schemas: opts.schemas,
      projectId,
      assetId,
      versionId,
      variantId,
    });
    if (!asset) return reply.code(404).send({ error: "Asset, version, or variant not found" });
    return { ok: true };
  });

  app.patch("/api/projects/:projectId/assets/:assetId/versions/:versionId/variants/:variantId", async (req, reply) => {
    const { projectId, assetId, versionId, variantId } = req.params as {
      projectId: string;
      assetId: string;
      versionId: string;
      variantId: string;
    };
    const body = req.body as {
      tags?: string[];
      rating?: number | null;
      status?: string;
      reviewNote?: string | null;
    } | null;

    const asset = await updateAssetVariant({
      projectsRoot,
      schemas: opts.schemas,
      projectId,
      assetId,
      versionId,
      variantId,
      patch: body ?? {},
    });
    if (!asset) return reply.code(404).send({ error: "Asset, version, or variant not found" });
    return { ok: true };
  });

  app.patch("/api/projects/:projectId/assets/:assetId/versions/:versionId", async (req, reply) => {
    const { projectId, assetId, versionId } = req.params as {
      projectId: string;
      assetId: string;
      versionId: string;
    };
    const body = req.body as { status?: string } | null;
    const before = await getAsset(projectsRoot, projectId, assetId);
    const prevStatus = before?.versions.find((v) => v.id === versionId)?.status;

    const asset = await updateAssetVersion({
      projectsRoot,
      schemas: opts.schemas,
      projectId,
      assetId,
      versionId,
      patch: body ?? {},
    });
    if (!asset) return reply.code(404).send({ error: "Asset or version not found" });
    const nextStatus = asset.versions.find((v) => v.id === versionId)?.status;
    if (prevStatus !== "approved" && nextStatus === "approved") {
      await triggerAutomationEvent({
        projectsRoot,
        schemas: opts.schemas,
        projectId,
        event: { type: "asset_approved", payload: { assetId, versionId } },
      });
    }
    return { ok: true };
  });
}
