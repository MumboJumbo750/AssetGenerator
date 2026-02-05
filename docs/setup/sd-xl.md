# SD XL setup

Source model page: https://civitai.com/models/101055/sd-xl

## What to download

- Model: SDXL Base 1.0 (VAE fix)
- File: SDXL base checkpoint from the model page (SafeTensor)

## Install (ComfyUI)

1. Place the checkpoint at:
   - `tools/comfyui/ComfyUI/models/checkpoints/<your-sdxl-file>.safetensors`
2. Ensure `config/local.json` points `checkpointsRoot` to your ComfyUI checkpoints folder.
3. Restart ComfyUI if it is already running.

## Notes from the model page and official repo

- SDXL uses two text encoders (OpenCLIP-ViT/G and CLIP-ViT/L).
- The refiner is a separate model if you decide to use a two-step pipeline.
- The official Stability AI repo does not publish sampler/steps/CFG recommendations for SDXL base.
- Official weights:
  - Base: https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0/
  - Refiner: https://huggingface.co/stabilityai/stable-diffusion-xl-refiner-1.0/

## Suggested baseline generation settings

The SDXL Civitai page does not publish specific sampler/steps/CFG values. Use these as a solid starting point and tune per project:

- Sampler: DPM++ 2M Karras
- Steps: 30
- CFG: 5
- Resolution: 1024×1024 (or other SDXL-supported sizes)

## App wiring

Add a checkpoint record under:

- data/projects/<projectId>/checkpoints/<checkpointId>.json

Then select that `checkpointId` in the UI or set it in your specs.
