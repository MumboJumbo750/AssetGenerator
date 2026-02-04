import { findListeningPids, killPidTree, waitForPortFree } from "../lib/ports.mjs";

function parseArgs() {
  const args = process.argv.slice(2);
  const ports = [];
  const dryRun = args.includes("--dry-run");

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--port") ports.push(args[++i]);
    if (a === "--ports") ports.push(...String(args[++i] ?? "").split(","));
  }

  const parsedPorts = ports
    .map((p) => Number(String(p).trim()))
    .filter((n) => Number.isFinite(n) && n > 0);

  return { ports: parsedPorts, dryRun };
}

async function main() {
  const { ports, dryRun } = parseArgs();
  if (ports.length === 0) {
    console.log("Usage: npm run ports:kill -- --port 8188 [--dry-run]");
    console.log("   or: npm run ports:kill -- --ports 8188,5173 [--dry-run]");
    process.exit(1);
  }

  for (const port of ports) {
    const pids = await findListeningPids(port);
    if (pids.size === 0) {
      console.log(`Port ${port}: already free`);
      continue;
    }

    console.log(`Port ${port}: killing LISTENING pids=${[...pids].join(",")}${dryRun ? " (dry-run)" : ""}`);
    if (!dryRun) {
      for (const pid of pids) await killPidTree(pid);
      await waitForPortFree(port);
      console.log(`Port ${port}: freed`);
    }
  }
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});

