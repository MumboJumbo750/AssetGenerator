export type KitManifest = {
  id: string;
  projectId: string;
  version: string;
  atlases: Array<{ id: string; imagePath: string; dataPath: string }>;
  images: Array<{ name: string; assetId: string; path: string }>;
  animations: Array<{ name: string; assetId: string; atlasId: string; frames: string[]; fps: number; loop: boolean }>;
  ui: Array<{ name: string; type: "button" | "panel" | "icon"; states: Record<string, string> }>;
};
