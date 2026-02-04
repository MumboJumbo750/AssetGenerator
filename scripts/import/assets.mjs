import fs from "node:fs/promises";
import path from "node:path";

import fg from "fast-glob";

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {
    projectId: "",
    dir: "",
    assetType: "ui_icon",
    status: "review",
    tag: [],
    source: "",
    author: "",
    license: "",
    url: "",
    notes: "",
    endpoint: "http://127.0.0.1:3030",
    dryRun: false
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--project") out.projectId = args[++i] ?? "";
    if (a === "--dir") out.dir = args[++i] ?? "";
    if (a === "--asset-type") out.assetType = args[++i] ?? "ui_icon";
    if (a === "--status") out.status = args[++i] ?? "review";
    if (a === "--tag") out.tag.push(args[++i] ?? "");
    if (a === "--source") out.source = args[++i] ?? "";
    if (a === "--author") out.author = args[++i] ?? "";
    if (a === "--license") out.license = args[++i] ?? "";
    if (a === "--url") out.url = args[++i] ?? "";
    if (a === "--notes") out.notes = args[++i] ?? "";
    if (a === "--endpoint") out.endpoint = args[++i] ?? out.endpoint;
    if (a === "--dry-run") out.dryRun = true;
  }
  return out;
}

async function main() {
  const args = parseArgs();
  if (!args.projectId || !args.dir) {
    console.log("Usage: npm run import:assets -- --project <projectId> --dir <folder>");
    console.log(
      "  Optional: --asset-type <type> --status <draft|review|approved> --tag <tag> (repeatable) --source <text> --author <text> --license <text> --url <url> --notes <text> --endpoint <url> --dry-run"
    );
    process.exit(1);
  }

  const absDir = path.resolve(args.dir);
  const entries = await fg(["**/*.{png,jpg,jpeg,webp}"], { cwd: absDir, absolute: true });
  if (entries.length === 0) {
    console.log(`[import] No images found in ${absDir}`);
    return;
  }

  const provenance =
    args.source || args.author || args.license || args.url || args.notes
      ? {
          source: args.source || undefined,
          author: args.author || undefined,
          license: args.license || undefined,
          url: args.url || undefined,
          notes: args.notes || undefined
        }
      : undefined;

  const items = entries.map((filePath) => ({
    sourcePath: filePath,
    title: path.basename(filePath, path.extname(filePath)),
    assetType: args.assetType,
    status: args.status,
    tags: args.tag.filter(Boolean),
    provenance
  }));

  if (args.dryRun) {
    console.log(`[import] Would import ${items.length} assets into ${args.projectId}`);
    return;
  }

  const endpoint = args.endpoint.replace(/\/+$/, "");
  const res = await fetch(`${endpoint}/api/projects/${args.projectId}/import/assets`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ items })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text);
  }
  const result = await res.json();
  const imported = Array.isArray(result.imported) ? result.imported.length : 0;
  const errors = Array.isArray(result.errors) ? result.errors.length : 0;
  console.log(`[import] Imported ${imported} assets. Errors: ${errors}`);
  if (errors) {
    await fs.writeFile(path.join(process.cwd(), "import-errors.json"), JSON.stringify(result.errors, null, 2) + "\n", "utf8");
    console.log("[import] Wrote import-errors.json");
  }
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});
