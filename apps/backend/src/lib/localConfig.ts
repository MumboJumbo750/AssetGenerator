import fs from "node:fs/promises";

export type LocalConfig = {
  dataRoot?: string;
  comfyui: { baseUrl: string; apiKey?: string; pythonBin?: string };
  paths?: { modelsRoot?: string; checkpointsRoot?: string; lorasRoot?: string };
};

export async function loadLocalConfig(localConfigPath: string): Promise<LocalConfig | null> {
  try {
    const raw = await fs.readFile(localConfigPath, "utf8");
    return JSON.parse(raw) as LocalConfig;
  } catch {
    return null;
  }
}
