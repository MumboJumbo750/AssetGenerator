# Workflow automation

## Goal
Reduce manual handoffs by automating multi-step tasks (e.g., generation -> bg removal -> atlas -> export).

## Concepts
- Rule: a trigger + conditions + actions.
- Trigger: an event (asset approved, spec refined, atlas ready) or schedule.
- Action: enqueue jobs, update status, apply tags, run eval grids, or export.
- Guardrails: dry-run, idempotency, project scoping, and opt-out flags.

## Recommended MVP rules
1) Asset approval -> bg removal -> atlas pack.
2) Atlas ready -> export with default profile.
3) New eval grid request -> enqueue eval generation jobs.

## Safety defaults
- Dry-run preview before enabling a rule.
- Per-project limits (max concurrent automation runs).
- Debounce repeated events on the same asset/spec.
- "Manual override" toggle on the target asset/spec/atlas.

## UI expectations
- List of rules (enabled/disabled, last run, failure count).
- Rule builder (trigger + conditions + actions).
- Run history with per-step logs + job links.

## Backend expectations
- Stored rules (JSON) in project scope.
- Scheduler/runner that is idempotent and resumable.
- Run log records with per-action status.
- Runner should record created job IDs for enqueue actions.
- Event endpoint to trigger rules from external systems.

## Action config (examples)
- enqueue job:
  - `{ "type": "enqueue_job", "config": { "type": "bg_remove", "input": { "assetId": "<assetId>" } } }`
- export:
  - `{ "type": "export", "config": { "assetIds": ["<assetId>"], "atlasIds": ["<atlasId>"], "profileId": "<profileId>" } }`
- run eval grid:
  - `{ "type": "run_eval_grid", "config": { "loraId": "<loraId>", "releaseId": "<releaseId>", "prompts": ["p1", "p2"], "checkpointId": "<checkpointId>" } }`
  - Works with project and baseline LoRAs (fallback to shared scope).
- apply tags:
  - `{ "type": "apply_tags", "config": { "assetId": "<assetId>", "versionId": "<versionId>", "variantId": "<variantId>", "add": ["quality:high"] } }`
- set status:
  - `{ "type": "set_status", "config": { "assetId": "<assetId>", "versionId": "<versionId>", "status": "approved" } }`
  - `{ "type": "set_status", "config": { "assetId": "<assetId>", "versionId": "<versionId>", "variantId": "<variantId>", "status": "selected" } }`

## Event trigger endpoint (example)
- `POST /api/projects/:projectId/automation/events` with:
  - `{ "type": "asset_approved", "payload": { "assetId": "<assetId>", "versionId": "<versionId>" } }`
