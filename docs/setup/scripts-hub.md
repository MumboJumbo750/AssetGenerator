# Script hub (`package.json`)

## Goal
Run all repo tooling from a single place (no random one-off commands).

The root `package.json` is the central hub for:
- ComfyUI setup/start
- backend/frontend/worker dev commands
- validation/CI helpers
- optional formatting hooks (Husky + lint-staged)

## Commands
- `npm run help`
  - Prints the available commands.

- `npm run dev`
  - Starts backend + worker + frontend together (dev mode).

- `npm run backend:dev`
  - Starts the backend API (Fastify).

- `npm run worker:dev`
  - Starts the worker job runner.

- `npm run frontend:dev`
  - Starts the web UI (Vite).

- `npm run comfyui:setup`
  - Clones ComfyUI into `tools/comfyui/ComfyUI/` (not committed)
  - Creates a repo-local Python venv in `tools/comfyui/.venv/` (not committed)
  - Installs ComfyUI Python dependencies into that venv

- `npm run comfyui:start`
  - Starts ComfyUI using the repo-local venv Python (not your global Python)
  - Reads `config/local.json` for `comfyui.baseUrl` (see `docs/setup/local-config.md`)

- `npm run comfyui:stop`
  - Stops ComfyUI by killing the process(es) listening on its configured port

- `npm run comfyui:restart`
  - Convenience command: stop then start ComfyUI

- `npm run comfyui:nodes`
  - Installs ComfyUI custom nodes from `pipeline/comfyui/manifest.json` (or the example).

- `npm run ports:status -- --port <port>`
  - Shows which PID(s) are listening on a port

- `npm run ports:kill -- --port <port>`
  - Frees a port by killing the listening PID(s)

- `npm run validate:data`
  - Validates JSON DB files under `data/` against `schemas/`

- `npm run typecheck`
  - Runs TypeScript typechecking

- `npm run format`
  - Formats the repo using Prettier

- `npm run format:check`
  - Checks formatting without writing changes
  - Pre-commit hook uses `lint-staged` to format staged files when Husky is installed

- `npm run migrate:run`
  - Runs data migrations from `scripts/migrate/steps/`
  - `--all` to run everything not yet applied
  - `--id <migrationId>` to run one
  - `--dry-run` to preview

- `npm run migrate:list`
  - Lists available migrations

- `npm run dataset:build`
  - Builds a dataset manifest from assets (used for LoRA training)
  - Optional filters:
    - `--status <draft|review|approved|rejected|deprecated>` (default: approved)
    - `--asset-type <type[,type]>`
    - `--checkpoint <checkpointId[,checkpointId]>`
    - `--tag <tag[,tag]>` with `--tag-any` to match any tag (default: all tags)
  - Caption options:
    - `--caption <tags|tags+spec|tags+spec+title>` (default: tags)
    - `--no-spec-tags` to exclude spec tags from captions
    - `--with-tokens` to append prompt tokens from style/scenario/tag catalogs
  - Provenance:
    - `--provenance-source <text>` `--provenance-author <text>` `--provenance-license <text>` `--provenance-url <url>` `--provenance-notes <text>`

- `npm run backup:snapshot`
  - Creates a timestamped backup of `data/` into `backups/`
  - Optional: `--data-root <path>` `--out <path>` `--include-runtime` `--dry-run`

- `npm run onboarding:check`
  - Verifies git + git-lfs availability and basic LFS configuration

- `npm run import:assets`
  - Bulk-imports existing image files into the data DB (creates specs + assets)
  - Required: `--project <projectId> --dir <folder>`
  - Optional: `--asset-type <type> --status <draft|review|approved> --tag <tag>` (repeatable) `--source <text> --author <text> --license <text> --url <url> --notes <text>` `--endpoint <url>` `--dry-run`

- `npm run lora:train`
  - Records a LoRA training run as a `candidate` release on a LoRA JSON record
  - Required:
    - `--lora <loraId>`
    - `--dataset <datasetId|path>`
  - Optional:
    - `--project <projectId>` (required for `--scope project`)
    - `--scope <project|baseline>` (default: project)
    - `--release <releaseId>` (default: ULID)
    - `--set-active` to set `activeReleaseId`
    - `--notes <text>`
    - `--config <json>` or `--config-file <path>`
    - `--resolution/--steps/--rank/--lr/--batch/--epochs`
    - `--weights-kind/--weights-base/--weights-path/--weights-uri/--sha256`

- `npm run lora:setup`
  - Clones the `kohya_ss` trainer into `tools/lora/kohya_ss/` (not committed)
  - Creates a repo-local Python venv in `tools/lora/kohya_ss/.venv/`
  - Installs kohya_ss requirements

- `npm run lora:eval`
  - Creates an eval grid record for a LoRA release and links it from the LoRA JSON
  - Required: `--lora <loraId> --release <releaseId>`
  - Optional: `--project <projectId> --scope <project|baseline> --prompts "<p1|p2|p3>" --prompts-file <path>`

- `npm run lora:eval-grid`
  - Creates eval specs + queued generate jobs for a LoRA eval grid
  - Required: `--project <projectId> --lora <loraId> --release <releaseId>`
  - Optional: `--prompts "<p1|p2>" --prompts-file <path> --checkpoint <checkpointId> --template <id> --auto-cleanup`

- `npm run lora:cleanup-eval`
  - Removes eval specs created for a specific eval grid
  - Required: `--project <projectId> --eval <evalId>` (use `--dry-run` to preview)

- `npm run lora:normalize-evals`
  - Normalizes eval `status` based on prompts vs outputs
  - Optional: `--scope <all|project|baseline>` `--project <projectId>` `--dry-run`

## Why a repo-local Python venv?
It avoids “Python mess” and keeps dependencies consistent per project while still allowing the main app stack to be Node.js/TypeScript.
