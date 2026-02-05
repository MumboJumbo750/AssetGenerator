import type { FastifyInstance } from "fastify";

import { verifyComfyUi } from "../services/comfyuiVerify";
import type { LocalConfig } from "../lib/localConfig";

export async function registerComfyUiVerifyRoutes(
  app: FastifyInstance,
  opts: { dataRoot: string; repoRoot: string; comfyBaseUrl: string; local: LocalConfig | null },
) {
  app.get("/api/system/comfyui/verify", async () => verifyComfyUi(opts));
}
