import { loadLocalConfig } from "../lib/config.mjs";
import { findListeningPids, killPidTree, waitForPortFree } from "../lib/ports.mjs";

function getComfyPortFromLocalConfig() {
  const local = loadLocalConfig();
  const baseUrlRaw = local?.comfyui?.baseUrl ?? "http://127.0.0.1:8188";
  const baseUrl = /^[a-zA-Z]+:\/\//.test(baseUrlRaw) ? baseUrlRaw : `http://${baseUrlRaw}`;
  const url = new URL(baseUrl);
  const port = url.port ? Number(url.port) : 8188;
  return { baseUrlRaw, port };
}

async function main() {
  const { baseUrlRaw, port } = getComfyPortFromLocalConfig();
  const pids = await findListeningPids(port);
  if (pids.size === 0) {
    console.log(`[comfyui:stop] ComfyUI already stopped (port ${port} free). baseUrl=${baseUrlRaw}`);
    return;
  }

  console.log(`[comfyui:stop] Stopping ComfyUI on port ${port}. baseUrl=${baseUrlRaw}`);
  console.log(`[comfyui:stop] Killing pids=${[...pids].join(",")}`);

  for (const pid of pids) await killPidTree(pid);
  await waitForPortFree(port);
  console.log("[comfyui:stop] Done.");
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});

