# Juggernaut XL setup

Source model page: https://civitai.com/models/133005/juggernaut-xl

## What to download

- Model: Juggernaut XL (SDXL)
- File: `juggernautXL_ragnarokBy.safetensors` (matches our checkpoint ID)
- VAE: baked in (no separate VAE needed)

## Install (ComfyUI)

1. Place the checkpoint at:
   - `tools/comfyui/ComfyUI/models/checkpoints/juggernautXL_ragnarokBy.safetensors`
2. Ensure `config/local.json` points `checkpointsRoot` to your ComfyUI checkpoints folder.
3. Restart ComfyUI if it is already running.

## Recommended generation settings (from model author)

- Resolution: 832×1216 for portrait (any SDXL resolution works)
- Sampler: DPM++ 2M SDE
- Steps: 30–40
- CFG: 3–6 (lower values look more realistic)
- Negative prompt: start with none and add only what you want to avoid
- VAE: baked in
- Optional Hi-Res: 4xNMKD-Siax_200k, 15 steps, 0.3 denoise, 1.5× upscale

## Prompt guidance

- Start without a negative prompt, then add targeted exclusions as needed.

## App wiring

The checkpoint definition lives at:

- data/projects/astroduck_demo/checkpoints/juggernautXL_ragnarokBy.safetensors.json

Select `juggernautXL_ragnarokBy.safetensors` as the checkpoint in the UI or set `checkpointId` to that value in a spec.
