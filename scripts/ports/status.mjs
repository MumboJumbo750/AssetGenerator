import { findListeningPids } from "../lib/ports.mjs";

function parsePortsFromArgs() {
  const ports = [];
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--port") ports.push(args[++i]);
    if (a === "--ports") ports.push(...String(args[++i] ?? "").split(","));
  }
  return ports.map((p) => Number(String(p).trim())).filter((n) => Number.isFinite(n) && n > 0);
}

async function main() {
  const ports = parsePortsFromArgs();
  if (ports.length === 0) {
    console.log("Usage: npm run ports:status -- --port 8188");
    console.log("   or: npm run ports:status -- --ports 8188,5173");
    process.exit(1);
  }

  for (const port of ports) {
    const pids = await findListeningPids(port);
    if (pids.size === 0) {
      console.log(`Port ${port}: free`);
      continue;
    }
    console.log(`Port ${port}: LISTENING pids=${[...pids].join(",")}`);
  }
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});

