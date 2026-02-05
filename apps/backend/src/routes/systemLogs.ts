import fs from "node:fs/promises";
import path from "node:path";

import type { FastifyInstance } from "fastify";

import { fileExists } from "../lib/json";

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

export async function registerSystemLogRoutes(app: FastifyInstance, opts: { dataRoot: string }) {
  app.get("/api/system/logs/:service", async (req, reply) => {
    const { service } = req.params as { service: string };
    const query = req.query as { tailBytes?: string } | undefined;
    const tailBytesRaw = Number(query?.tailBytes ?? 50_000);
    const tailBytes = Math.max(1_000, Math.min(250_000, Number.isFinite(tailBytesRaw) ? tailBytesRaw : 50_000));

    const fileName = service === "backend" ? "backend.jsonl" : service === "worker" ? "worker.jsonl" : null;
    if (!fileName) return reply.code(404).send({ error: "Unknown log service" });

    const logAbs = path.join(opts.dataRoot, "runtime", "logs", fileName);
    if (!(await fileExists(logAbs))) return reply.code(404).send({ error: "Log file not found" });

    const text = await readTailUtf8(logAbs, tailBytes);
    return reply.type("text/plain; charset=utf-8").send(text);
  });
}
