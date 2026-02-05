# Logging & error visibility

Goal: if _anything_ fails (backend, worker, ComfyUI calls, Python tools), we can quickly answer:

- what failed?
- where did it fail?
- for which project/job/spec/asset?
- what should we do next?

This repo is intentionally **job-centric**: the primary unit of work is a Job, so the primary log stream is a **per-job log** that the UI can display.

## 1) What we log (minimum)

### Per-job logs (required)

- One log file per job (JSONL): `data/projects/<projectId>/files/logs/jobs/<jobId>.jsonl`
- The job JSON references it via `job.logPath` (schema: `schemas/job.schema.json`)
- Each line is a JSON object with:
  - `ts` (ISO time), `level` (`debug|info|warn|error`)
  - `component` (`worker|backend|comfyui|python|ui`)
  - `projectId`, `jobId`
  - `msg` and optional `data`

The job log should capture:

- job start/end + duration
- inputs (summarized; never dump raw ComfyUI workflow JSON into logs)
- external calls (ComfyUI submit/poll/download; Python tool executions)
- stdout/stderr tails for failing subprocesses (Python)
- full error stack on failure

### Runtime/service logs (recommended)

These are not tied to a single job (startup errors, request errors, unhandled exceptions):

- Backend: `data/runtime/logs/backend.jsonl`
- Worker: `data/runtime/logs/worker.jsonl`

## 2) How logs are shown in the UI

### Jobs view (must-have)

- Job list shows `status`, `type`, `error` (already)
- Clicking a job shows:
  - summarized `input` + `output`
  - log tail (last N KB) with basic filtering (level) and copy button

### System logs view (nice-to-have)

- “Backend logs” + “Worker logs” panels (tail view)
- Useful when something breaks outside of jobs (e.g. bad schema write, server crash)

Current implementation:

- Job log tail endpoint: `GET /api/projects/:projectId/jobs/:jobId/log?tailBytes=80000`
- System log tail endpoint: `GET /api/system/logs/:service?tailBytes=80000` where `service in {backend, worker}`

## 3) Redaction rules (important)

Never log:

- API tokens / secrets
- full absolute local paths to weights (keep weight resolution in `config/local.json`)
  Prefer:
- stable IDs (`projectId`, `jobId`, `specId`, `assetId`)
- relative paths under `data/`
- short “tails” of stderr/stdout for failures (truncate)

## 4) Retention / cleanup (planned)

Logs should not bloat Git history:

- log files live under `data/**/files/logs` and `data/runtime/logs` and are gitignored
- add a cleanup script later (keep last N MB or last N days)

## 5) Future upgrades (optional)

- Websocket streaming for near-real-time logs
- “events” table (JSONL) for structured app events (job failed, asset approved, export created)
- External observability (Sentry/OTel) once the architecture stabilizes
