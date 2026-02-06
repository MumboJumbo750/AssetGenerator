import path from "node:path";

import type { FastifyInstance } from "fastify";

import { fileExists } from "../lib/json";
import { getProjectEventCursor, listProjectEvents } from "../services/events";

function toInt(value: unknown, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.floor(n);
}

export async function registerEventRoutes(app: FastifyInstance, opts: { dataRoot: string }) {
  const projectsRoot = path.join(opts.dataRoot, "projects");

  app.get("/api/projects/:projectId/events", async (req, reply) => {
    const { projectId } = req.params as { projectId: string };
    const query = (req.query as { since?: string; limit?: string } | undefined) ?? {};
    const projectExists = await fileExists(path.join(projectsRoot, projectId, "project.json"));
    if (!projectExists) return reply.code(404).send({ error: "Project not found" });

    const since = Math.max(0, toInt(query.since, 0));
    const limit = Math.max(1, Math.min(2000, toInt(query.limit, 200)));
    const events = await listProjectEvents({ projectsRoot, projectId, since, limit });
    const cursor = await getProjectEventCursor({ projectsRoot, projectId });
    return { events, cursor };
  });

  app.get("/api/projects/:projectId/events/cursor", async (req, reply) => {
    const { projectId } = req.params as { projectId: string };
    const projectExists = await fileExists(path.join(projectsRoot, projectId, "project.json"));
    if (!projectExists) return reply.code(404).send({ error: "Project not found" });
    const cursor = await getProjectEventCursor({ projectsRoot, projectId });
    return cursor;
  });

  app.get("/api/projects/:projectId/events/stream", async (req, reply) => {
    const { projectId } = req.params as { projectId: string };
    const query = (req.query as { since?: string; heartbeatMs?: string } | undefined) ?? {};
    const projectExists = await fileExists(path.join(projectsRoot, projectId, "project.json"));
    if (!projectExists) return reply.code(404).send({ error: "Project not found" });

    let since = Math.max(0, toInt(query.since, 0));
    const heartbeatMs = Math.max(1000, Math.min(30_000, toInt(query.heartbeatMs, 3000)));

    reply.raw.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    });

    const send = (event: string, data: unknown) => {
      reply.raw.write(`event: ${event}\n`);
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    let closed = false;
    const onClose = () => {
      closed = true;
    };
    req.raw.on("close", onClose);

    send("ready", { projectId, since });

    while (!closed) {
      const events = await listProjectEvents({ projectsRoot, projectId, since, limit: 500 });
      if (events.length > 0) {
        for (const ev of events) {
          send("event", ev);
          since = ev.seq;
        }
      } else {
        const cursor = await getProjectEventCursor({ projectsRoot, projectId });
        send("heartbeat", { projectId, lastSeq: cursor.lastSeq });
      }
      await new Promise((resolve) => setTimeout(resolve, heartbeatMs));
    }

    req.raw.off("close", onClose);
    reply.raw.end();
    return reply;
  });
}
