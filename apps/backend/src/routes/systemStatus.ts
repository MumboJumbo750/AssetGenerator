import type { FastifyInstance } from "fastify";

import { getSystemStatus } from "../services/systemStatus";

export async function registerSystemStatusRoutes(
  app: FastifyInstance,
  opts: { dataRoot: string; comfyBaseUrl: string },
) {
  app.get("/api/system/status", async () => getSystemStatus(opts));
}
