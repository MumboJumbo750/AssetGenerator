# In-app guidance (noob-first)

This document defines the **minimum guidance layer** for the UI so first-time users can reach a demo without external help.

## 1) Core guidance principles

- Always show a **next action** when a list is empty.
- Use **short, task-oriented copy** (verbs over nouns).
- Offer **one primary CTA** and an optional secondary.
- Keep help tips close to the most error-prone fields.

## 2) Empty state rules (by workflow)

### Specs (Pipeline → SpecWizard → SpecDetail)

- If no specs: show "Create first Spec" CTA linking to the SpecWizard and explain the Pipeline flow.
- If specs exist but none are `ready`: remind the user to complete the spec checklist (see §6a) or use the SpecDetailPage tabs.
- The primary creation path is `Pipeline → New Spec (Wizard)`.

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

- Provide a stepper on the Dashboard page or Pipeline page with:
  - Verify ComfyUI connection
  - Create first Spec (via SpecWizard)
  - Fill spec policy tabs (SpecDetailPage: General, Prompt, Quality, LoRA, Seed, Entity)
  - Run Pipeline
  - Review Assets (Decision Sprint)
  - Export + Pixi preview
- Each step should include a direct CTA linking to the relevant route (`/pipeline`, `/review`, `/export`).

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

- "Create first Spec" (links to SpecWizard)
- "Open Pipeline" (links to /pipeline)
- "Run Pipeline" (primary action on Pipeline board)
- "Review assets" (links to /review)
- "View exceptions" (links to /exceptions)
- "View jobs" (links to /classic/jobs)
- "Preview Pixi export"

## 6) Copy/Paste QA Checklist (spec recreation + new specs)

Use this checklist in onboarding tips, review handoff notes, and release QA.

### 6a) Spec is autopilot-ready

- [ ] `checkpointId` is set.
- [ ] `checkpointProfileId` is set (or deterministically derived).
- [ ] `checkpointProfileVersion` matches current profile version.
- [ ] `baselineProfileId` is set (or explicitly defaulted).
- [ ] `loraPolicy.mode` is selected.
- [ ] `styleConsistency.mode` is selected.
- [ ] `seedPolicy.mode` is set (`random_recorded` recommended; `fixed` for repro tests; `derived` for entity-coherent batches).
- [ ] `entityLink` is set for identity-bearing assets (`entityId` + `role`).
- [ ] `qualityContract.backgroundPolicy` is set.
- [ ] `qualityContract.requiredStates` is set for stateful assets.
- [ ] `qualityContract.alignmentTolerancePx` is set when alignment matters.
- [ ] `output.kind` + output-specific fields are complete.
- [ ] `generationParams.width/height/variants` are set.
- [ ] `prompt.positive` + `prompt.negative` are both populated.

### 6b) Pipeline UI checks after first run

- [ ] Pipeline card shows policy badges (`Baseline`, `LoRA`, `Style`, `Quality`).
- [ ] Pipeline card shows evidence indicator (`none`, `X/4`, or `ready`).
- [ ] Primary action is correct for stage (`Run Pipeline`, `Review`, `Export`, etc.).

### 6c) Review UI checks

- [ ] Review header shows policy badges.
- [ ] Evidence badges appear when generation metadata is present.
- [ ] Keyboard controls work: Left/Right, `A`, `R`, `1-5`.

### 6d) Library discoverability checks

- [ ] Asset appears under expected policy filters:
  - LoRA policy
  - style consistency
  - quality background
- [ ] Detail drawer shows policy and evidence details for the latest version.

For the full recreation workflow and canonical spec template, see:

- `docs/workflows/spec-recreation-happy-loop.md`
