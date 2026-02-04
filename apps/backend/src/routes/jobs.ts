import fs from "node:fs/promises";
import path from "node:path";

import type { FastifyInstance } from "fastify";

import { fileExists, readJson } from "../lib/json";
import type { SchemaRegistry } from "../lib/schemas";
import { cancelJob, createJob, getJob, listJobs, retryJob, type Job } from "../services/jobs";

async function readTailUtf8(filePath: string, tailBytes: number) {
  const stat = await fs.stat(filePath);
  const size = stat.size;
  const start = Math.max(0, size - tailBytes);
  const length = size - start;
  const handle = await fs.open(filePath, "r");
  try {
    const buffer = Buffer.alloc(length);
    await handle.read(buffer, 0, length, start);
    return buffer.toString("utf8");
  } finally {
    await handle.close();
  }
}

export async function registerJobRoutes(app: FastifyInstance, opts: { dataRoot: string; schemas: SchemaRegistry }) {
  const projectsRoot = path.join(opts.dataRoot, "projects");

  app.get("/api/projects/:projectId/jobs", async (req) => {
    const { projectId } = req.params as { projectId: string };
    const jobs = await listJobs(projectsRoot, projectId);
    return { jobs };
  });

  app.get("/api/projects/:projectId/jobs/:jobId/log", async (req, reply) => {
    const { projectId, jobId } = req.params as { projectId: string; jobId: string };
    const query = req.query as { tailBytes?: string } | undefined;
    const tailBytesRaw = Number(query?.tailBytes ?? 50_000);
    const tailBytes = Math.max(1_000, Math.min(250_000, Number.isFinite(tailBytesRaw) ? tailBytesRaw : 50_000));

    const jobPath = path.join(projectsRoot, projectId, "jobs", `${jobId}.json`);
    if (!(await fileExists(jobPath))) return reply.code(404).send({ error: "Job not found" });
    const job = await readJson<Job>(jobPath);

    if (!job.logPath) return reply.code(404).send({ error: "No job log available" });
    const logAbs = path.join(opts.dataRoot, job.logPath);
    const dataRootAbs = path.resolve(opts.dataRoot) + path.sep;
    const logAbsResolved = path.resolve(logAbs);
    if (!logAbsResolved.startsWith(dataRootAbs)) return reply.code(400).send({ error: "Invalid logPath" });
    if (!(await fileExists(logAbs))) return reply.code(404).send({ error: "Job log file missing" });

    const text = await readTailUtf8(logAbs, tailBytes);
    return reply.type("text/plain; charset=utf-8").send(text);
  });

  app.post("/api/projects/:projectId/jobs/:jobId/cancel", async (req, reply) => {
    const { projectId, jobId } = req.params as { projectId: string; jobId: string };
    const job = await cancelJob({ projectsRoot, schemas: opts.schemas, projectId, jobId });
    if (!job) return reply.code(404).send({ error: "Job not found" });
    return { job };
  });

  app.post("/api/projects/:projectId/jobs/:jobId/retry", async (req, reply) => {
    const { projectId, jobId } = req.params as { projectId: string; jobId: string };
    const job = await retryJob({ projectsRoot, schemas: opts.schemas, projectId, jobId });
    if (!job) return reply.code(404).send({ error: "Job not found" });
    return { job };
  });

  app.post("/api/projects/:projectId/jobs", async (req, reply) => {
    const { projectId } = req.params as { projectId: string };
    const body = req.body as { type?: Job["type"]; input?: Record<string, unknown> } | null;
    const type = body?.type;
    if (!type) return reply.code(400).send({ error: "type is required" });

    const projectJsonPath = path.join(projectsRoot, projectId, "project.json");
    if (!(await fileExists(projectJsonPath))) return reply.code(404).send({ error: "Project not found" });

    const job = await createJob({
      projectsRoot,
      schemas: opts.schemas,
      projectId,
      type,
      input: body?.input ?? {}
    });
    return reply.code(201).send(job);
  });
}
