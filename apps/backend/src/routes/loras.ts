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
import { triggerAutomationEvent } from "../services/automation";
import { createJob } from "../services/jobs";
import { listSpecs } from "../services/specs";

export async function registerLoraRoutes(app: FastifyInstance, opts: { dataRoot: string; schemas: SchemaRegistry }) {
  const projectsRoot = path.join(opts.dataRoot, "projects");
  const normalizePathLike = (value: string) => value.replace(/\\/g, "/");
  const resolveReleaseWeightPath = (release: any) => {
    const weightPath = typeof release?.weights?.path === "string" ? release.weights.path.trim() : "";
    if (weightPath) return normalizePathLike(weightPath);
    const localPath = typeof release?.localPath === "string" ? release.localPath.trim() : "";
    if (localPath) return normalizePathLike(localPath);
    return "";
  };

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
      const before = await getProjectLora(projectsRoot, projectId, loraId);
      const previousActiveReleaseId = before?.activeReleaseId ?? null;
      const updated = await updateProjectLora(projectsRoot, opts.schemas, projectId, loraId, patch);
      if (!updated) return reply.code(404).send({ error: "LoRA not found" });
      const nextActiveReleaseId = updated.activeReleaseId ?? null;
      if (nextActiveReleaseId && nextActiveReleaseId !== previousActiveReleaseId) {
        const release = updated.releases.find((item) => item.id === nextActiveReleaseId);
        await triggerAutomationEvent({
          projectsRoot,
          schemas: opts.schemas,
          projectId,
          event: {
            type: "lora_release_activated",
            payload: {
              loraId: updated.id,
              releaseId: nextActiveReleaseId,
              releaseStatus: release?.status ?? null,
              checkpointId: updated.checkpointId,
              assetTypes: updated.assetTypes ?? [],
              scope: updated.scope,
            },
          },
        });
      }
      return updated;
    } catch (err: any) {
      return reply.code(400).send({ error: err?.message ?? String(err) });
    }
  });

  app.post("/api/projects/:projectId/loras/:loraId/activate-render", async (req, reply) => {
    const { projectId, loraId } = req.params as { projectId: string; loraId: string };
    const body =
      (req.body as {
        releaseId?: string;
        templateId?: string;
        statuses?: Array<"draft" | "ready" | "deprecated">;
        limit?: number;
        strengthModel?: number;
        strengthClip?: number;
      } | null) ?? {};

    try {
      const current = await getProjectLora(projectsRoot, projectId, loraId);
      if (!current) return reply.code(404).send({ error: "LoRA not found" });

      const requestedReleaseId = body.releaseId?.trim();
      const release =
        (requestedReleaseId
          ? current.releases.find((item) => item.id === requestedReleaseId)
          : current.activeReleaseId
            ? current.releases.find((item) => item.id === current.activeReleaseId)
            : null) ??
        current.releases
          .filter((item) => item.status === "approved")
          .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0];

      if (!release) return reply.code(400).send({ error: "No release available for activation" });
      if (release.status !== "approved") return reply.code(400).send({ error: "Release must be approved first" });

      const updated = await updateProjectLora(projectsRoot, opts.schemas, projectId, loraId, {
        activeReleaseId: release.id,
      });
      if (!updated) return reply.code(404).send({ error: "LoRA not found" });

      const statuses = Array.isArray(body.statuses) && body.statuses.length > 0 ? body.statuses : ["draft", "ready"];
      const limitRaw = Number(body.limit ?? 20);
      const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.floor(limitRaw)) : 20;
      const specs = await listSpecs(projectsRoot, projectId);
      const compatible = specs
        .filter((spec) => {
          const specStatus = String(spec.status ?? "draft") as "draft" | "ready" | "deprecated";
          if (!statuses.includes(specStatus)) return false;
          if (updated.assetTypes?.length && !updated.assetTypes.includes(spec.assetType)) return false;
          if (updated.checkpointId && spec.checkpointId && updated.checkpointId !== spec.checkpointId) return false;
          return true;
        })
        .slice(0, limit);

      const loraPath = resolveReleaseWeightPath(release);
      const strengthModel = Number(body.strengthModel ?? 1);
      const strengthClip = Number(body.strengthClip ?? strengthModel);

      const queuedJobs: string[] = [];
      const queuedSpecIds: string[] = [];
      for (const spec of compatible) {
        const checkpointName = String(spec.checkpointId ?? updated.checkpointId ?? "");
        if (!checkpointName) continue;
        const job = await createJob({
          projectsRoot,
          schemas: opts.schemas,
          projectId,
          type: "generate",
          input: {
            specId: spec.id,
            templateId: body.templateId ?? "txt2img",
            checkpointName,
            loras: [
              {
                loraId: updated.id,
                releaseId: release.id,
                loraName: loraPath || updated.id,
                strengthModel: Number.isFinite(strengthModel) ? strengthModel : 1,
                strengthClip: Number.isFinite(strengthClip) ? strengthClip : 1,
              },
            ],
            loraSelection: {
              mode: "activate_render",
              loraId: updated.id,
              releaseId: release.id,
            },
          },
        });
        queuedJobs.push(job.id);
        queuedSpecIds.push(spec.id);
      }

      const automationRuns = await triggerAutomationEvent({
        projectsRoot,
        schemas: opts.schemas,
        projectId,
        event: {
          type: "lora_release_activated",
          payload: {
            loraId: updated.id,
            releaseId: release.id,
            releaseStatus: release.status ?? null,
            checkpointId: updated.checkpointId,
            assetTypes: updated.assetTypes ?? [],
            scope: updated.scope,
            source: "activate_render_endpoint",
          },
        },
      });

      return {
        lora: updated,
        releaseId: release.id,
        queuedJobs,
        queuedSpecIds,
        automationRuns: automationRuns.map((run) => run.id),
      };
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
