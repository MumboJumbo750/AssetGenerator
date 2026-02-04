import path from "node:path";
import fg from "fast-glob";

export const id = "2026-02-04-backfill-import-provenance";
export const description = "Backfill provenance for imported assets using generation.source/sourcePath.";

function normalize(p) {
  return p.replaceAll("\\", "/");
}

export async function run(ctx) {
  const assetsGlob = path.join(ctx.dataRoot, "projects", "*", "assets", "*.json");
  const files = await fg([assetsGlob], { absolute: true });
  let updated = 0;

  for (const file of files) {
    const asset = await ctx.readJson(file);
    if (asset?.provenance) continue;
    const version = Array.isArray(asset?.versions) ? asset.versions[0] : null;
    const generation = version?.generation ?? {};
    if (generation?.source !== "import" && !generation?.sourcePath) continue;

    asset.provenance = {
      source: generation?.source ?? "import",
      url: typeof generation?.sourcePath === "string" ? generation.sourcePath : undefined
    };
    asset.updatedAt = new Date().toISOString();
    updated += 1;

    if (!ctx.dryRun) await ctx.writeJson(file, asset);
  }

  ctx.log?.info?.(`[migrate] Updated ${updated} asset(s).`);
}
