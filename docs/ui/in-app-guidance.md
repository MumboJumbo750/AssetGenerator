# In-app guidance (noob-first)

This document defines the **minimum guidance layer** for the UI so first-time users can reach a demo without external help.

## 1) Core guidance principles
- Always show a **next action** when a list is empty.
- Use **short, task-oriented copy** (verbs over nouns).
- Offer **one primary CTA** and an optional secondary.
- Keep help tips close to the most error-prone fields.

## 2) Empty state rules (by workflow)
### Specs (SpecLists → AssetSpecs)
- If no SpecLists: show “Create first SpecList” CTA and explain refinement.
- If no specs: remind the user to refine the SpecList or create a spec manually.

### Assets (Review + tagging)
- If no assets: link to Specs and explain that generation jobs create assets.
- If no variants: hint that jobs may still be running.
- Provide quick filter presets and saved filters for review batches.
- Encourage short review notes for approvals/rejections.
- Background removal should explain it runs on approved variants and defaults can be reset.

### Atlases
- If no atlases: explain that approved variants are required to pack frames.
- Show padding/max size tips for deterministic packing.

### Jobs
- If no jobs: link to Specs and explain how to queue a generate job.
- If selected job has no logPath: show a non-blocking note.

### Pixi
- Explain where to find the manifest path after an export.

### Exports
- Warn when animations are missing atlas mappings.
- Warn when UI states are missing texture mappings.
- Clarify that unmapped items are skipped in the manifest.

### Logs
- Explain when to use logs (job failures / ComfyUI status).

## 2b) Onboarding wizard
- Provide a stepper on the Overview page with:
  - Verify ComfyUI
  - Create SpecList
  - Refine into Specs
  - Queue Jobs
  - Review Assets
  - Export + Pixi preview
- Each step should include a direct CTA (link to Specs/Assets/Logs).

## 2c) Help Center (searchable FAQ)
- Provide a dedicated Help Center page linked from the main navigation.
- Organize content by category (Getting Started, Workflow, Data & Metadata, Training, Exports, Troubleshooting).
- Include a search box that filters by title, summary, and keywords.
- Use a list + detail layout: topic list on the left, full explanation on the right.
- Add a short summary + 2-4 actionable tips per topic for fast scanning.
- Map help tips in the UI to the most relevant Help Center topic.

## 3) Help tip placement
Place help tips next to:
- Checkpoint selection
- Prompt inputs (positive/negative)
- Variant count
- Tagging controls
 - Filters + bulk actions

Help tips should deep-link to the Help Center topic when possible (e.g., tagging → Tags & catalogs).

## 4) Copy patterns
- “Start here: …”
- “Next: …”
- “If you’re stuck: …”

## 5) CTA list (preferred)
- “Create first SpecList”
- “Go to Specs”
- “Review assets”
- “View jobs”
- “Preview Pixi export”
