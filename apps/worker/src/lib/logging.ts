import fs from "node:fs/promises";
import path from "node:path";

export type LogLevel = "debug" | "info" | "warn" | "error";

export type JsonlLogger = {
  absPath: string;
  log: (level: LogLevel, msg: string, data?: unknown) => Promise<void>;
  debug: (msg: string, data?: unknown) => Promise<void>;
  info: (msg: string, data?: unknown) => Promise<void>;
  warn: (msg: string, data?: unknown) => Promise<void>;
  error: (msg: string, data?: unknown) => Promise<void>;
};

function nowIso() {
  return new Date().toISOString();
}

export async function createJsonlLogger(opts: {
  absPath: string;
  component: string;
  baseFields?: Record<string, unknown>;
}): Promise<JsonlLogger> {
  await fs.mkdir(path.dirname(opts.absPath), { recursive: true });

  const write = async (level: LogLevel, msg: string, data?: unknown) => {
    const entry = {
      ts: nowIso(),
      level,
      component: opts.component,
      ...(opts.baseFields ?? {}),
      msg,
      ...(data === undefined ? null : { data }),
    };
    await fs.appendFile(opts.absPath, JSON.stringify(entry) + "\n", "utf8");
  };

  return {
    absPath: opts.absPath,
    log: write,
    debug: (msg, data) => write("debug", msg, data),
    info: (msg, data) => write("info", msg, data),
    warn: (msg, data) => write("warn", msg, data),
    error: (msg, data) => write("error", msg, data),
  };
}

export function tailString(s: string, maxChars: number) {
  if (s.length <= maxChars) return s;
  return s.slice(s.length - maxChars);
}
