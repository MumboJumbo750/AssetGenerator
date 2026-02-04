import fs from "node:fs";
import { repoPath } from "./paths.mjs";

export function loadLocalConfig() {
  const localConfigPath = repoPath("config", "local.json");
  if (!fs.existsSync(localConfigPath)) return null;
  const raw = fs.readFileSync(localConfigPath, "utf8");
  return JSON.parse(raw);
}

