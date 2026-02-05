# Pony Diffusion V6 XL setup

Source model page: https://civitai.com/models/257749/pony-diffusion-v6-xl

## What to download

- Model: Pony Diffusion V6 XL (SDXL)
- File: `ponyDiffusionV6XL_v6StartWithThisOne.safetensors` (matches our checkpoint ID)
- VAE (recommended by author): https://civitai.com/api/download/models/290640?type=VAE

## Install (ComfyUI)

1. Place the checkpoint at:
   - `tools/comfyui/ComfyUI/models/checkpoints/ponyDiffusionV6XL_v6StartWithThisOne.safetensors`
2. Place the VAE at:
   - `tools/comfyui/ComfyUI/models/vae/` (keep the original filename)
3. Ensure `config/local.json` points `checkpointsRoot` to your ComfyUI checkpoints folder.
4. Restart ComfyUI if it is already running.

## Recommended generation settings (from model author)

- CLIP skip: 2 (required)
- Sampler: Euler a
- Steps: ~25
- Resolution: 1024px on the long edge (any SDXL-supported size works)
- Negative prompt: usually not needed

## Prompt template guidance

Author-recommended quality tags:

- `score_9, score_8_up, score_7_up, score_6_up, score_5_up, score_4_up, <your prompt>, tag1, tag2`

Other helpful tags:

- `source_pony`, `source_furry`, `source_cartoon`, `source_anime`
- `rating_safe`, `rating_questionable`, `rating_explicit`

Note: the model may generate pseudo signatures; inpainting can help if this is an issue.

## App wiring

The checkpoint definition lives at:

- data/projects/astroduck_demo/checkpoints/ponyDiffusionV6XL_v6StartWithThisOne.safetensors.json

Select `ponyDiffusionV6XL_v6StartWithThisOne.safetensors` as the checkpoint in the UI or set `checkpointId` to that value in a spec.
