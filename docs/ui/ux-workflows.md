# UX workflows (noob‑first)

This document defines the **primary workflows** and how the UI should guide a new user through them.

## 1) First‑run / First export (noob path)
**Goal:** A new teammate exports a Pixi kit in <30 minutes.

Steps:
1) **Seed demo data** (or create a project).
2) **Create a SpecList** from a template.
3) **Refine** into AssetSpecs.
4) **Generate** variants.
5) **Review** + tag + set primary.
6) **Export** and preview in Pixi.

UX guidance:
- Show a persistent “Next” card in Overview.
- Add help tips on SpecList, Refinement, Checkpoint, Review.

## 2) Spec → Asset pipeline (core loop)
**Entry:** Specs page.

Steps:
- Pick a SpecList → refine → queue jobs.
- Monitor job status + logs.
- Review assets and set a primary.

UX guidance:
- Keep the pipeline state visible.
- Offer guardrails on checkpoint selection.

## 3) Review & tagging (quality loop)
**Entry:** Assets page.

Steps:
- Select an asset → choose variant → tag/rate → set primary.

UX guidance:
- Tag chips should be easy to toggle.
- Exclusive tag groups enforce only one active tag.

## 4) Import existing assets (upcoming)
**Entry:** Assets page → “Import” CTA.

Steps:
- Upload/bulk ingest assets.
- Map to asset types + tags.
- Generate thumbnails and enter review flow.

UX guidance:
- Provide a “safe import” wizard with previews and validation.

## 5) Export & Pixi preview (current/next)
**Entry:** Jobs or Export page (future).

Steps:
- Run export job.
- Load kit manifest in Pixi preview.

UX guidance:
- Surface direct link to latest export manifest.

## 6) Admin catalog changes (upcoming)
**Entry:** Admin section.

Steps:
- Add tags/catalogs/checkpoints/LoRAs.

UX guidance:
- Explain impact on specs and existing assets.

