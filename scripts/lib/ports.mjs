import { run, runCapture } from "./exec.mjs";

const NON_LISTENING_TCP_STATES = new Set([
  "ESTABLISHED",
  "SYN_SENT",
  "SYN_RECEIVED",
  "FIN_WAIT_1",
  "FIN_WAIT_2",
  "TIME_WAIT",
  "CLOSE",
  "CLOSE_WAIT",
  "LAST_ACK",
  "CLOSING",
]);

function isNetstatListeningRow({ foreignAddress, state }) {
  const stateUpper = String(state ?? "").toUpperCase();
  if (stateUpper === "LISTENING") return true;

  // Windows netstat is localized (e.g. German "ABHÖREN"), and codepages can mangle
  // non-ASCII characters. Prefer a language-neutral check: LISTEN rows have a
  // "foreign address" of 0.0.0.0:0 or [::]:0.
  const foreign = String(foreignAddress ?? "").trim();
  const looksLikeListenPeer = foreign === "0.0.0.0:0" || foreign === "[::]:0";
  if (looksLikeListenPeer && !NON_LISTENING_TCP_STATES.has(stateUpper)) return true;

  return false;
}

function parseNetstatListeningPids(stdout, port) {
  const pids = new Set();
  for (const rawLine of stdout.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (!line.startsWith("TCP")) continue;

    const parts = line.split(/\s+/);
    if (parts.length < 5) continue;
    const localAddress = parts[1];
    const foreignAddress = parts[2];
    const state = parts[3];
    const pidRaw = parts[4];

    if (!isNetstatListeningRow({ foreignAddress, state })) continue;
    const m = localAddress.match(/:(\d+)$/);
    if (!m) continue;
    if (Number(m[1]) !== port) continue;
    const pid = Number(pidRaw);
    if (Number.isFinite(pid) && pid > 0) pids.add(pid);
  }
  return pids;
}

async function findListeningPidsWindows(port) {
  // Avoid `-p tcp` because it excludes IPv6 listeners (TCPv6) on Windows, which
  // is commonly what localhost binds to (e.g. Vite/Node on [::1]).
  const result = await runCapture("netstat", ["-ano"]);
  if (result.code !== 0) throw new Error(`netstat failed: ${result.stderr || result.stdout}`);
  return parseNetstatListeningPids(result.stdout, port);
}

async function findListeningPidsUnix(port) {
  const lsof = await runCapture("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"]);
  if (lsof.code === 0) {
    const pids = new Set();
    for (const line of lsof.stdout
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)) {
      const pid = Number(line);
      if (Number.isFinite(pid) && pid > 0) pids.add(pid);
    }
    return pids;
  }

  const ss = await runCapture("ss", ["-lptn", `sport = :${port}`]);
  if (ss.code === 0) {
    // Best-effort parse: look for pid=1234 patterns.
    const pids = new Set();
    const matches = ss.stdout.matchAll(/pid=(\d+)/g);
    for (const m of matches) pids.add(Number(m[1]));
    return pids;
  }

  throw new Error("Unable to find listening PIDs on this platform (missing lsof/ss).");
}

export async function findListeningPids(port) {
  const parsed = Number(port);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`Invalid port: ${port}`);

  if (process.platform === "win32") return findListeningPidsWindows(parsed);
  return findListeningPidsUnix(parsed);
}

export async function killPidTree(pid) {
  const parsed = Number(pid);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`Invalid PID: ${pid}`);

  if (process.platform === "win32") {
    await run("taskkill", ["/PID", String(parsed), "/T", "/F"]);
    return;
  }

  try {
    process.kill(parsed, "SIGTERM");
  } catch {
    return;
  }
}

export async function waitForPortFree(port, { timeoutMs = 8000, pollMs = 250 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const pids = await findListeningPids(port);
    if (pids.size === 0) return;
    await new Promise((r) => setTimeout(r, pollMs));
  }
  throw new Error(`Port ${port} is still in use after ${timeoutMs}ms.`);
}
