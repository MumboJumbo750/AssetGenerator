/**
 * Shared helpers for reading project data files (events, JSON entities).
 * Used by metrics, releaseGates, trends, and other services that scan project data.
 */
import fs from "node:fs/promises";
import path from "node:path";

import { readJson } from "./json";

// ── Types ─────────────────────────────────────────────────────────────

export type EventRecord = {
  id: string;
  projectId: string;
  seq: number;
  ts: string;
  type: string;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
};

// ── Helpers ───────────────────────────────────────────────────────────

/**
 * Load all events from a project's JSONL event log.
 */
export async function loadAllEvents(projectDir: string): Promise<EventRecord[]> {
  const eventsPath = path.join(projectDir, "events.jsonl");
  const result: EventRecord[] = [];
  try {
    const content = await fs.readFile(eventsPath, "utf-8");
    for (const line of content.split("\n")) {
      if (!line.trim()) continue;
      try {
        result.push(JSON.parse(line) as EventRecord);
      } catch {
        // skip malformed
      }
    }
  } catch {
    // no events file
  }
  return result;
}

/**
 * Safely read all JSON entity files from a directory.
 * Returns empty array if directory doesn't exist or is empty.
 */
export async function safeReadAllJson<T>(dir: string): Promise<T[]> {
  const items: T[] = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isFile() || !e.name.endsWith(".json")) continue;
      try {
        items.push(await readJson<T>(path.join(dir, e.name)));
      } catch {
        // skip unreadable
      }
    }
  } catch {
    // dir doesn't exist
  }
  return items;
}

/**
 * Count JSON entity files in a directory.
 */
export async function countJsonFiles(dir: string): Promise<number> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isFile() && e.name.endsWith(".json")).length;
  } catch {
    return 0;
  }
}
