import fs from "node:fs/promises";
import path from "node:path";

import { readJson, fileExists } from "../lib/json";

// ── Types ─────────────────────────────────────────────────────────────

type ProjectEvent = {
  id: string;
  projectId: string;
  seq: number;
  ts: string;
  type: string;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
};

export type BacktestReport = {
  ruleId: string;
  ruleName: string;
  periodFrom: string;
  periodTo: string;
  totalEventsScanned: number;
  matchedEvents: number;
  wouldHaveTriggered: number;
  estimatedJobsEnqueued: number;
  triggerTimestamps: string[];
  peakTriggersPerMinute: number;
  avgTriggersPerHour: number;
  warning?: string;
};

export type ValidatorGapEntry = {
  assetId: string;
  versionId: string;
  specId?: string;
  assetType?: string;
  validatorStatus: string;
  validatorScore?: number;
  humanDecision: string;
  checkId?: string;
  checkScore?: number;
  checkThreshold?: number;
  suggestedAction?: string;
};

export type ValidatorGapReport = {
  projectId: string;
  totalValidatorPasses: number;
  humanRejectedAfterPass: number;
  gapRate: number;
  entries: ValidatorGapEntry[];
  suggestions: string[];
  generatedAt: string;
};

// ── Rule Backtesting (Simulation Mode) ────────────────────────────────

/**
 * Replay the project's event history against a rule's trigger + conditions
 * in simulation mode. Returns how many times the rule would have fired.
 */
export async function backtestRule(opts: {
  projectsRoot: string;
  projectId: string;
  ruleId: string;
  periodFrom?: string;
  periodTo?: string;
}): Promise<BacktestReport> {
  const rulesDir = path.join(opts.projectsRoot, opts.projectId, "automation-rules");
  const ruleFile = path.join(rulesDir, `${opts.ruleId}.json`);

  if (!(await fileExists(ruleFile))) {
    throw new Error(`Rule not found: ${opts.ruleId}`);
  }

  const rule = await readJson<{
    id: string;
    name: string;
    trigger: { type: string };
    conditions?: Record<string, unknown>;
    actions: Array<{ type: string; config?: Record<string, unknown> }>;
  }>(ruleFile);

  // Load events from JSONL
  const eventsPath = path.join(opts.projectsRoot, opts.projectId, "events.jsonl");
  const events = await loadEventsFromJsonl(eventsPath, opts.periodFrom, opts.periodTo);

  // Simulate matching
  const matchedEvents: ProjectEvent[] = [];
  for (const event of events) {
    if (matchesTrigger(event, rule.trigger, rule.conditions)) {
      matchedEvents.push(event);
    }
  }

  // Compute velocity stats
  const triggerTimestamps = matchedEvents.map((e) => e.ts);
  const peakTriggersPerMinute = computePeakRate(triggerTimestamps, 60_000);
  const periodMs = events.length > 0 ? Date.parse(events[events.length - 1].ts) - Date.parse(events[0].ts) : 0;
  const periodHours = Math.max(1, periodMs / (1000 * 60 * 60));
  const avgTriggersPerHour = matchedEvents.length / periodHours;

  // Estimate jobs that would be enqueued
  const jobActions = rule.actions.filter(
    (a) => a.type === "enqueue_job" || a.type === "run_eval_grid" || a.type === "enqueue_lora_renders",
  );
  const estimatedJobsEnqueued = matchedEvents.length * Math.max(1, jobActions.length);

  const warning =
    peakTriggersPerMinute > 10
      ? `High trigger velocity detected: ${peakTriggersPerMinute.toFixed(1)} triggers/min peak. Consider adding velocity breaker.`
      : undefined;

  return {
    ruleId: rule.id,
    ruleName: rule.name,
    periodFrom: opts.periodFrom ?? events[0]?.ts ?? "",
    periodTo: opts.periodTo ?? events[events.length - 1]?.ts ?? "",
    totalEventsScanned: events.length,
    matchedEvents: matchedEvents.length,
    wouldHaveTriggered: matchedEvents.length,
    estimatedJobsEnqueued,
    triggerTimestamps,
    peakTriggersPerMinute,
    avgTriggersPerHour,
    warning,
  };
}

// ── Validator Gap Analysis ────────────────────────────────────────────

/**
 * Cross-reference validator "pass" results with human "rejected" decisions
 * to identify false positives where the validator incorrectly passed assets
 * that humans later rejected.
 */
export async function analyzeValidatorGaps(opts: {
  projectsRoot: string;
  projectId: string;
}): Promise<ValidatorGapReport> {
  const validationDir = path.join(opts.projectsRoot, opts.projectId, "baseline-validation-results");
  const assetsDir = path.join(opts.projectsRoot, opts.projectId, "assets");

  // Load all validation results that passed
  const validatorPasses: Array<{
    id: string;
    assetId: string;
    versionId: string;
    specId?: string;
    assetType?: string;
    status: string;
    checks?: Array<{ id?: string; status?: string; score?: number; threshold?: number }>;
  }> = [];

  try {
    const entries = await fs.readdir(validationDir, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isFile() || !e.name.endsWith(".json")) continue;
      const result = await readJson<(typeof validatorPasses)[0]>(path.join(validationDir, e.name));
      if (result.status === "pass") {
        validatorPasses.push(result);
      }
    }
  } catch {
    // no validation results
  }

  // Build a map of asset versions that were human-rejected
  const rejectedVersions = new Set<string>();
  try {
    const entries = await fs.readdir(assetsDir, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isFile() || !e.name.endsWith(".json")) continue;
      const asset = await readJson<{
        id: string;
        versions?: Array<{ id: string; status?: string }>;
      }>(path.join(assetsDir, e.name));
      for (const v of asset.versions ?? []) {
        if (v.status === "rejected") {
          rejectedVersions.add(`${asset.id}:${v.id}`);
        }
      }
    }
  } catch {
    // no assets
  }

  // Cross-reference: validator passed but human rejected
  const gapEntries: ValidatorGapEntry[] = [];
  for (const vr of validatorPasses) {
    const key = `${vr.assetId}:${vr.versionId}`;
    if (rejectedVersions.has(key)) {
      // Find the weakest check (closest to threshold)
      let weakestCheck: { id?: string; score?: number; threshold?: number } | undefined;
      for (const check of vr.checks ?? []) {
        if (check.score !== undefined && check.threshold !== undefined) {
          if (
            !weakestCheck ||
            check.score - check.threshold < (weakestCheck.score ?? 1) - (weakestCheck.threshold ?? 0)
          ) {
            weakestCheck = check;
          }
        }
      }

      gapEntries.push({
        assetId: vr.assetId,
        versionId: vr.versionId,
        specId: vr.specId,
        assetType: vr.assetType,
        validatorStatus: vr.status,
        humanDecision: "rejected",
        checkId: weakestCheck?.id,
        checkScore: weakestCheck?.score,
        checkThreshold: weakestCheck?.threshold,
        suggestedAction: weakestCheck
          ? `Consider raising ${weakestCheck.id} threshold from ${weakestCheck.threshold} to ${Math.min(1, (weakestCheck.score ?? 0) + 0.05).toFixed(2)}`
          : "Review validator criteria",
      });
    }
  }

  // Generate aggregate suggestions
  const suggestions: string[] = [];
  const checkGaps = new Map<string, number>();
  for (const entry of gapEntries) {
    if (entry.checkId) {
      checkGaps.set(entry.checkId, (checkGaps.get(entry.checkId) ?? 0) + 1);
    }
  }
  for (const [checkId, count] of checkGaps.entries()) {
    if (count >= 2) {
      suggestions.push(`${checkId} has ${count} false positives — consider raising its threshold.`);
    }
  }
  if (gapEntries.length > 0 && suggestions.length === 0) {
    suggestions.push(`${gapEntries.length} validator gap(s) found. Review individual entries for targeted fixes.`);
  }

  const gapRate = validatorPasses.length > 0 ? gapEntries.length / validatorPasses.length : 0;

  return {
    projectId: opts.projectId,
    totalValidatorPasses: validatorPasses.length,
    humanRejectedAfterPass: gapEntries.length,
    gapRate,
    entries: gapEntries,
    suggestions,
    generatedAt: new Date().toISOString(),
  };
}

// ── Helpers ───────────────────────────────────────────────────────────

async function loadEventsFromJsonl(
  eventsPath: string,
  periodFrom?: string,
  periodTo?: string,
): Promise<ProjectEvent[]> {
  const events: ProjectEvent[] = [];
  try {
    const content = await fs.readFile(eventsPath, "utf-8");
    const lines = content.split("\n").filter((l) => l.trim());
    for (const line of lines) {
      try {
        const event = JSON.parse(line) as ProjectEvent;
        if (periodFrom && event.ts < periodFrom) continue;
        if (periodTo && event.ts > periodTo) continue;
        events.push(event);
      } catch {
        // skip malformed lines
      }
    }
  } catch {
    // file doesn't exist or can't be read
  }
  return events;
}

function matchesTrigger(event: ProjectEvent, trigger: { type: string }, conditions?: Record<string, unknown>): boolean {
  // Map event types to trigger types
  const eventToTriggerMap: Record<string, string> = {
    spec_refined: "spec_refined",
    spec_updated: "spec_refined",
    asset_approved: "asset_approved",
    asset_version_approved: "asset_approved",
    atlas_ready: "atlas_ready",
    atlas_packed: "atlas_ready",
    lora_release_activated: "lora_release_activated",
  };

  const mappedType = eventToTriggerMap[event.type] ?? event.type;
  if (mappedType !== trigger.type) return false;

  // Simple condition matching (subset check on payload)
  if (conditions) {
    for (const [key, value] of Object.entries(conditions)) {
      if (event.payload[key] !== value) return false;
    }
  }

  return true;
}

function computePeakRate(timestamps: string[], windowMs: number): number {
  if (timestamps.length === 0) return 0;

  const sorted = timestamps.map((ts) => Date.parse(ts)).sort((a, b) => a - b);
  let maxCount = 0;

  for (let i = 0; i < sorted.length; i++) {
    const windowEnd = sorted[i] + windowMs;
    let count = 0;
    for (let j = i; j < sorted.length && sorted[j] <= windowEnd; j++) {
      count++;
    }
    maxCount = Math.max(maxCount, count);
  }

  return maxCount;
}
