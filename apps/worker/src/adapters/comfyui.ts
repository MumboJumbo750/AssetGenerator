import { ulid } from "ulid";

export type ComfyImageRef = { filename: string; subfolder?: string; type?: string };

export type ComfyQueueResponse = { prompt_id?: string; promptId?: string; id?: string };

export async function submitWorkflow(opts: { baseUrl: string; workflow: unknown }) {
  const clientId = ulid();
  const res = await fetch(new URL("/prompt", opts.baseUrl), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt: opts.workflow, client_id: clientId }),
  });
  if (!res.ok) throw new Error(`ComfyUI /prompt failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as ComfyQueueResponse;
  const promptId = json.prompt_id ?? json.promptId ?? json.id;
  if (!promptId) throw new Error(`ComfyUI /prompt response missing prompt_id: ${JSON.stringify(json)}`);
  return { promptId, clientId };
}

export async function getHistory(opts: { baseUrl: string; promptId: string }) {
  const res = await fetch(new URL(`/history/${opts.promptId}`, opts.baseUrl));
  if (!res.ok) throw new Error(`ComfyUI /history failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as any;
}

export function extractImagesFromHistory(history: any, promptId: string): ComfyImageRef[] {
  const entry = history?.[promptId];
  const outputs = entry?.outputs ?? {};
  const images: ComfyImageRef[] = [];
  for (const output of Object.values(outputs)) {
    const imgs = (output as any)?.images;
    if (!Array.isArray(imgs)) continue;
    for (const img of imgs) {
      if (!img?.filename) continue;
      images.push({
        filename: String(img.filename),
        subfolder: img.subfolder ? String(img.subfolder) : "",
        type: img.type ? String(img.type) : "output",
      });
    }
  }
  return images;
}

export async function downloadImage(opts: { baseUrl: string; ref: ComfyImageRef }) {
  const url = new URL("/view", opts.baseUrl);
  url.searchParams.set("filename", opts.ref.filename);
  url.searchParams.set("subfolder", opts.ref.subfolder ?? "");
  url.searchParams.set("type", opts.ref.type ?? "output");

  const res = await fetch(url);
  if (!res.ok) throw new Error(`ComfyUI /view failed: ${res.status} ${await res.text()}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  return buf;
}
