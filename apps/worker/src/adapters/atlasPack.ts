import fs from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";
import { MaxRectsPacker } from "maxrects-packer";

export type FrameInput = { key: string; absPath: string };
export type PackedFrame = {
  key: string;
  sourcePath: string;
  rect: { x: number; y: number; w: number; h: number };
  sourceSize: { w: number; h: number };
  trimmed?: boolean;
  spriteSourceSize?: { x: number; y: number; w: number; h: number };
};

export async function packAtlas(opts: {
  frames: FrameInput[];
  atlasAbsPngPath: string;
  atlasAbsJsonPath: string;
  padding?: number;
  maxSize?: number;
  powerOfTwo?: boolean;
  trim?: boolean;
  extrude?: number;
  sort?: "area" | "maxside" | "w" | "h" | "name" | "none";
}) {
  const padding = opts.padding ?? 2;
  const maxSize = opts.maxSize ?? 2048;
  const powerOfTwo = opts.powerOfTwo ?? false;
  const trim = opts.trim ?? false;
  const extrude = opts.extrude ?? 0;
  const sort = opts.sort ?? "area";

  let meta = await Promise.all(
    opts.frames.map(async (f) => {
      const image = sharp(f.absPath);
      const info = await image.metadata();
      if (!info.width || !info.height) throw new Error(`Unable to read dimensions: ${f.absPath}`);
      if (!trim) return { ...f, width: info.width, height: info.height, trimInfo: null };

      const buffer = await image.png().toBuffer();
      const { data, info: rawInfo } = await sharp(buffer).raw().toBuffer({ resolveWithObject: true });
      const w = rawInfo.width;
      const h = rawInfo.height;
      let minX = w;
      let minY = h;
      let maxX = -1;
      let maxY = -1;
      for (let y = 0; y < h; y += 1) {
        for (let x = 0; x < w; x += 1) {
          const idx = (y * w + x) * 4 + 3;
          if (data[idx] > 0) {
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
          }
        }
      }
      if (maxX < 0 || maxY < 0) {
        return { ...f, width: info.width, height: info.height, trimInfo: null };
      }
      const trimW = maxX - minX + 1;
      const trimH = maxY - minY + 1;
      return {
        ...f,
        width: trimW,
        height: trimH,
        trimInfo: { x: minX, y: minY, w: trimW, h: trimH, sourceW: w, sourceH: h },
      };
    }),
  );

  if (sort !== "none") {
    const byName = (a: any, b: any) => String(a.key).localeCompare(String(b.key));
    const byW = (a: any, b: any) => b.width - a.width;
    const byH = (a: any, b: any) => b.height - a.height;
    const byMaxSide = (a: any, b: any) => Math.max(b.width, b.height) - Math.max(a.width, a.height);
    const byArea = (a: any, b: any) => b.width * b.height - a.width * a.height;
    const sorter =
      sort === "name" ? byName : sort === "w" ? byW : sort === "h" ? byH : sort === "maxside" ? byMaxSide : byArea;
    meta = [...meta].sort(sorter);
  }

  const packer = new MaxRectsPacker(maxSize, maxSize, padding);
  for (const f of meta) {
    packer.add(f.width + extrude * 2, f.height + extrude * 2, { key: f.key, absPath: f.absPath, trimInfo: f.trimInfo });
  }
  if (!packer.bins.length) throw new Error("No bins produced by packer.");
  if (packer.bins.length > 1)
    throw new Error(`Atlas requires multiple pages (${packer.bins.length}); increase maxSize.`);
  const bin = packer.bins[0];

  const pot = (n: number) => {
    let v = 1;
    while (v < n) v *= 2;
    return v;
  };

  const atlasW = powerOfTwo ? pot(bin.width) : bin.width;
  const atlasH = powerOfTwo ? pot(bin.height) : bin.height;

  const base = sharp({
    create: { width: atlasW, height: atlasH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  });

  const composites = await Promise.all(
    bin.rects.map(async (r) => {
      const absPath = (r.data as any).absPath as string;
      const trimInfo = (r.data as any).trimInfo as {
        x: number;
        y: number;
        w: number;
        h: number;
        sourceW: number;
        sourceH: number;
      } | null;
      let input = Buffer.from(await fs.readFile(absPath));
      let left = r.x + extrude;
      let top = r.y + extrude;

      if (trimInfo) {
        input = Buffer.from(
          await sharp(input)
            .extract({ left: trimInfo.x, top: trimInfo.y, width: trimInfo.w, height: trimInfo.h })
            .png()
            .toBuffer(),
        );
      }

      return { input, left, top };
    }),
  );

  await fs.mkdir(path.dirname(opts.atlasAbsPngPath), { recursive: true });
  let atlasImage = base.composite(composites);

  if (extrude > 0) {
    const extraComposites: Array<{ input: Buffer; left: number; top: number }> = [];
    for (const r of bin.rects) {
      const absPath = (r.data as any).absPath as string;
      const trimInfo = (r.data as any).trimInfo as {
        x: number;
        y: number;
        w: number;
        h: number;
        sourceW: number;
        sourceH: number;
      } | null;
      const buffer = Buffer.from(await fs.readFile(absPath));
      const image = sharp(buffer);
      const info = await image.metadata();
      if (!info.width || !info.height) continue;
      const src = trimInfo
        ? await image.extract({ left: trimInfo.x, top: trimInfo.y, width: trimInfo.w, height: trimInfo.h }).toBuffer()
        : buffer;
      for (let i = 1; i <= extrude; i += 1) {
        extraComposites.push({ input: src, left: r.x + extrude - i, top: r.y + extrude });
        extraComposites.push({ input: src, left: r.x + extrude + i, top: r.y + extrude });
        extraComposites.push({ input: src, left: r.x + extrude, top: r.y + extrude - i });
        extraComposites.push({ input: src, left: r.x + extrude, top: r.y + extrude + i });
      }
    }
    if (extraComposites.length > 0) atlasImage = atlasImage.composite(extraComposites);
  }

  await atlasImage.png().toFile(opts.atlasAbsPngPath);

  const frames: Record<
    string,
    {
      frame: { x: number; y: number; w: number; h: number };
      rotated: boolean;
      trimmed: boolean;
      spriteSourceSize: { x: number; y: number; w: number; h: number };
      sourceSize: { w: number; h: number };
    }
  > = {};

  for (const r of bin.rects) {
    const key = (r.data as any).key as string;
    const trimInfo = (r.data as any).trimInfo as {
      x: number;
      y: number;
      w: number;
      h: number;
      sourceW: number;
      sourceH: number;
    } | null;
    const trimmed = Boolean(trimInfo);
    const frameX = r.x + extrude;
    const frameY = r.y + extrude;
    const frameW = r.width - extrude * 2;
    const frameH = r.height - extrude * 2;
    frames[key] = {
      frame: { x: frameX, y: frameY, w: frameW, h: frameH },
      rotated: false,
      trimmed,
      spriteSourceSize: trimInfo
        ? { x: trimInfo.x, y: trimInfo.y, w: trimInfo.w, h: trimInfo.h }
        : { x: 0, y: 0, w: frameW, h: frameH },
      sourceSize: trimInfo ? { w: trimInfo.sourceW, h: trimInfo.sourceH } : { w: frameW, h: frameH },
    };
  }

  const pixiJson = {
    frames,
    meta: { image: path.basename(opts.atlasAbsPngPath), scale: "1" },
  };

  await fs.writeFile(opts.atlasAbsJsonPath, JSON.stringify(pixiJson, null, 2) + "\n", "utf8");

  const packedFrames: PackedFrame[] = bin.rects.map((r) => {
    const key = (r.data as any).key as string;
    const trimInfo = (r.data as any).trimInfo as {
      x: number;
      y: number;
      w: number;
      h: number;
      sourceW: number;
      sourceH: number;
    } | null;
    const frameX = r.x + extrude;
    const frameY = r.y + extrude;
    const frameW = r.width - extrude * 2;
    const frameH = r.height - extrude * 2;
    return {
      key,
      sourcePath: (r.data as any).absPath as string,
      rect: { x: frameX, y: frameY, w: frameW, h: frameH },
      sourceSize: trimInfo ? { w: trimInfo.sourceW, h: trimInfo.sourceH } : { w: frameW, h: frameH },
      trimmed: Boolean(trimInfo),
      spriteSourceSize: trimInfo
        ? { x: trimInfo.x, y: trimInfo.y, w: trimInfo.w, h: trimInfo.h }
        : { x: 0, y: 0, w: frameW, h: frameH },
    };
  });

  return { atlasW, atlasH, frames: packedFrames };
}
