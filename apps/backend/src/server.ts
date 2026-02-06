import path from "node:path";

import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";

import { repoPath, repoRootFromHere } from "./lib/repo";
import { loadLocalConfig } from "./lib/localConfig";
import { createJsonlLogger } from "./lib/logging";
import { loadSchemas } from "./lib/schemas";
import { registerProjectRoutes } from "./routes/projects";
import { registerCatalogRoutes } from "./routes/catalogs";
import { registerSpecListRoutes } from "./routes/specLists";
import { registerJobRoutes } from "./routes/jobs";
import { registerSpecRoutes } from "./routes/specs";
import { registerAssetRoutes } from "./routes/assets";
import { registerAtlasRoutes } from "./routes/atlases";
import { registerCheckpointRoutes } from "./routes/checkpoints";
import { registerExportProfileRoutes } from "./routes/exportProfiles";
import { registerLoraRoutes } from "./routes/loras";
import { registerEvalRoutes } from "./routes/evals";
import { registerImportRoutes } from "./routes/imports";
import { registerSystemLogRoutes } from "./routes/systemLogs";
import { registerSystemStatusRoutes } from "./routes/systemStatus";
import { registerComfyUiVerifyRoutes } from "./routes/comfyuiVerify";
import { registerAutomationRoutes } from "./routes/automation";
import { registerBaselineProfileRoutes } from "./routes/baselineProfiles";
import { registerEventRoutes } from "./routes/events";
import { registerImprovementRoutes } from "./routes/improvement";
import { registerMetricsRoutes } from "./routes/metrics";

const repoRoot = repoRootFromHere(import.meta.url);

async function main() {
  const localConfigPath = repoPath(repoRoot, "config", "local.json");
  const local = await loadLocalConfig(localConfigPath);
  const dataRoot = local?.dataRoot ? path.resolve(local.dataRoot) : repoPath(repoRoot, "data");

  const schemas = await loadSchemas(repoPath(repoRoot, "schemas"));

  const runtimeLog = await createJsonlLogger({
    absPath: path.join(dataRoot, "runtime", "logs", "backend.jsonl"),
    component: "backend",
  });
  await runtimeLog.info("startup", { dataRoot });

  process.on("unhandledRejection", (reason) => {
    void runtimeLog.error("unhandled_rejection", { reason: String(reason) });
  });
  process.on("uncaughtException", (err) => {
    void runtimeLog
      .error("uncaught_exception", { error: { message: err?.message ?? String(err), stack: (err as any)?.stack } })
      .finally(() => {
        process.exit(1);
      });
  });

  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  // Serve data/ read-only for dev (images, export kits, etc.).
  await app.register(fastifyStatic, {
    root: dataRoot,
    prefix: "/data/",
    decorateReply: false,
  });

  app.addHook("onError", async (req, _reply, err) => {
    void runtimeLog.error("request_error", {
      method: req.method,
      url: req.url,
      error: { message: err?.message ?? String(err), stack: (err as any)?.stack },
    });
  });

  app.get("/api/health", async () => ({ ok: true }));

  await registerProjectRoutes(app, { dataRoot, schemas });
  await registerCatalogRoutes(app, { dataRoot, schemas });
  await registerSpecListRoutes(app, { dataRoot, schemas });
  await registerJobRoutes(app, { dataRoot, schemas });
  await registerSpecRoutes(app, { dataRoot, schemas });
  await registerAssetRoutes(app, { dataRoot, schemas });
  await registerAtlasRoutes(app, { dataRoot, schemas });
  await registerCheckpointRoutes(app, { dataRoot, schemas });
  await registerExportProfileRoutes(app, { dataRoot, schemas });
  await registerLoraRoutes(app, { dataRoot, schemas });
  await registerEvalRoutes(app, { dataRoot });
  await registerAutomationRoutes(app, { dataRoot, schemas });
  await registerBaselineProfileRoutes(app, { dataRoot, schemas });
  await registerImportRoutes(app, { dataRoot, schemas });
  await registerSystemLogRoutes(app, { dataRoot });
  await registerSystemStatusRoutes(app, { dataRoot, comfyBaseUrl: local?.comfyui?.baseUrl ?? "http://127.0.0.1:8188" });
  await registerComfyUiVerifyRoutes(app, {
    dataRoot,
    repoRoot,
    comfyBaseUrl: local?.comfyui?.baseUrl ?? "http://127.0.0.1:8188",
    local,
  });
  await registerEventRoutes(app, { dataRoot });
  await registerImprovementRoutes(app, { dataRoot, schemas });
  await registerMetricsRoutes(app, { dataRoot, schemas });

  const port = Number(process.env.ASSETGEN_BACKEND_PORT ?? 3030);
  const host = process.env.ASSETGEN_BACKEND_HOST ?? "127.0.0.1";
  try {
    await app.listen({ port, host });
    await runtimeLog.info("listening", { host, port, dataRoot });
  } catch (err: any) {
    await runtimeLog.error("listen_failed", {
      host,
      port,
      error: { message: err?.message ?? String(err), stack: err?.stack },
    });
    throw err;
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
