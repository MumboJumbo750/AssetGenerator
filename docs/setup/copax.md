# Copax TimeLess (SDXL) setup

Source model page: https://civitai.com/models/118111/copax-timeless?modelVersionId=1108377

## What to download

- Model: Copax TimeLess (SDXL 1.0)
- File: `copaxTimeless_xivSDXL.safetensors` (matches our checkpoint ID)

## Install (ComfyUI)

1. Place the checkpoint at:
   - `tools/comfyui/ComfyUI/models/checkpoints/copaxTimeless_xivSDXL.safetensors`
2. Ensure `config/local.json` points `checkpointsRoot` to your ComfyUI checkpoints folder.
3. Restart ComfyUI if it is already running.

## Recommended generation settings (from model author)

These are the settings we wire into the Copax checkpoint defaults so the app uses them automatically:

- Steps: 25–50 (we default to 40)
- CFG: 5–7 (we default to 6)
- Sampler: Euler a or DPM++ 2M SDE Karras
- Scheduler: Karras (when using DPM++ 2M SDE)
- Optional: After Detailer for faces (ComfyUI custom node)

## Prompt guidance

Suggested negative prompt from the model page:

- `(worst quality, low quality, illustration, 3d, 2d), open mouth, tooth, ugly face, old face, long neck`

Keep positive prompts concise and let asset specs + tags do most of the work.

## App wiring

The Copax checkpoint definition lives at:

- data/projects/astroduck_demo/checkpoints/copaxTimeless_xivSDXL.safetensors.json

Defaults are applied automatically when you select this checkpoint in the UI or set `checkpointId` to `copaxTimeless_xivSDXL.safetensors` in a spec.
