# ADR-0003: ComfyUI as the initial generation backend

Date: 2026-02-03

## Status

Accepted

## Context

We need an image generation backend that:

- supports multiple checkpoints and LoRAs
- can be driven programmatically
- can be extended with custom nodes/workflows over time

## Decision

Use **ComfyUI** as the initial image generation backend.

Our app will:

- store ComfyUI workflow templates in-repo (JSON)
- render workflows by injecting spec-derived parameters (prompt text, seed, checkpoint, LoRAs, resolution, steps, sampler)
- submit jobs to ComfyUI and persist outputs + metadata back into `data/`

## Consequences

- Fast iteration on workflows without changing core app code.
- Requires a clear “workflow template” convention and a stable adapter for submitting + tracking jobs.
