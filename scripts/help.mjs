import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageJsonPath = path.resolve(__dirname, "..", "package.json");

console.log("AssetGenerator script hub");
console.log("");
console.log("Repo:", path.resolve(__dirname, ".."));
console.log("package.json:", packageJsonPath);
console.log("");
console.log("Common commands:");
console.log("- npm run dev            # start backend + worker + frontend (concurrently)");
console.log("- npm run backend:dev    # start backend (Fastify)");
console.log("- npm run worker:dev     # start worker (job runner)");
console.log("- npm run frontend:dev   # start frontend (Vite)");
console.log("- npm run comfyui:setup   # clone ComfyUI + create repo-local venv + install deps");
console.log("- npm run comfyui:start   # start ComfyUI using the repo-local venv");
console.log("- npm run comfyui:stop    # stop ComfyUI (kills pids listening on its port)");
console.log("- npm run comfyui:restart # stop then start ComfyUI");
console.log("- npm run comfyui:nodes   # install ComfyUI custom nodes from manifest");
console.log("- npm run ports:status -- --port 8188   # check which pid uses a port");
console.log("- npm run ports:kill -- --port 8188     # kill pid(s) listening on a port");
console.log("- npm run validate:data   # validate JSON under data/ against schemas/");
console.log("- npm run typecheck       # TypeScript typecheck");
console.log("- npm run dataset:build   # build a dataset manifest from approved assets");
console.log(
  "- npm run demo:astroduck:queue-atlases -- --project <projectId>   # queue 4 atlas_pack jobs + export job for the AstroDuck demo",
);
console.log("- npm run seed            # create a deterministic demo project in data/");
