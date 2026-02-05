# ComfyUI environment manifest

## Goal

Make ComfyUI workflows reproducible across machines by capturing:

- which ComfyUI version/commit is expected
- which custom nodes are required (repo + revision)
- which model files are required (identifiers + hashes)

## Manifest file (proposed)

- `pipeline/comfyui/manifest.json` (not necessarily committed for private setups)
- Example: `pipeline/comfyui/manifest.example.json`

## What it should contain

- `comfyui`: repo URL + revision/commit
- `customNodes[]`: name, repo URL, revision/commit, node IDs, python packages
- `models[]`: type (checkpoint/lora/vae/etc), identifier, sha256 (optional), notes

## Why

Without this, “workflow templates in Git” can still break if a teammate is missing a node or has a different node version.
