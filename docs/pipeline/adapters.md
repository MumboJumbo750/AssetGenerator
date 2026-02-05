# Pipeline adapters (generation + tools)

## Goal

Keep the system flexible by defining stable _interfaces_ for pipeline steps, while allowing multiple implementations.

## Generation adapter

The generation worker should call a single adapter interface:

- input: resolved prompt (+ negative), checkpointId, loraIds, generationParams, seed(s)
- output: one or more images + metadata

Initial adapter target:

- **ComfyUI** (see `docs/pipeline/comfyui.md`)

Regardless of backend, the worker must persist:

- resolved prompt
- checkpoint + LoRA identifiers/versions used
- seeds + sampler settings
- output file paths

## Post-processing tools

Background removal and atlas packing should also be adapters:

- `bg_remove(inputPath, params) -> alphaPath (+ maskPath optional)`
- `atlas_pack(frames[], packSettings) -> atlas.png + atlas.json`

## Why adapters

- swap tools without changing the UI/data model
- keep deterministic metadata storage consistent
