# Local machine configuration (not in Git)

## Goal

Avoid committing machine-specific paths/endpoints (especially for model weights) while still allowing the app to run consistently across a team.

## File location

Create a local config file (not committed):

- `config/local.json`

Schema:

- `schemas/local-config.schema.json`

An example is provided:

- `config/local.example.json`

## What goes in local config

- ComfyUI endpoint (`comfyui.baseUrl`)
- Optional ComfyUI venv python (`comfyui.pythonBin`) for dependency verification
- Optional roots for model storage (`paths.*Root`)

## How model weights are referenced (recommended)

Do **not** store absolute paths in shared JSON unless everyone has the same machine layout.

Instead, checkpoints/LoRAs should reference weights via a small indirection:

- `weights.kind = config_relative`
- `weights.base = checkpointsRoot` or `lorasRoot`
- `weights.path = <relative file name>`

This lets each contributor point `checkpointsRoot` / `lorasRoot` to their local storage without changing project JSON.
