import fs from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const dataRoot = path.join(repoRoot, "data");

async function walk(dir, out = []) {
  let entries = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full, out);
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
}

function hasBom(buf) {
  return buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
}

async function main() {
  const files = await walk(dataRoot);
  const jsonFiles = files.filter((f) => f.toLowerCase().endsWith(".json"));
  const bad = [];
  for (const file of jsonFiles) {
    const buf = await fs.readFile(file);
    if (hasBom(buf)) bad.push(path.relative(repoRoot, file));
  }

  if (bad.length) {
    console.error("BOM found in JSON files:");
    for (const file of bad) console.error(`- ${file}`);
    process.exit(1);
  }
  console.log("BOM check OK (no BOMs in data JSON). ");
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});
