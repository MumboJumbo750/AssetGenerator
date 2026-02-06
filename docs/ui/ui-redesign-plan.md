# UI Redesign Plan - Pipeline Studio (Aligned)

Purpose: define the UX/product direction for the frontend.

Execution source of truth: `docs/ui/happy-loop-implementation-backlog.md`.
If this document conflicts with the master plan timeline, follow the master plan.

---

## 1) UX Goal

Build a pipeline-first, image-first experience where users:

1. run asset generation with one primary action,
2. answer binary review questions only when needed,
3. export cohesive results with minimal manual configuration.

Default mode must be exceptions-only and no-tune.

---

## 2) Product Principles

1. Pipeline-first IA, not tool-first IA.
2. Images are primary; controls are secondary.
3. One obvious next action per screen state.
4. Binary review first; advanced controls on demand.
5. Automation by default; humans handle uncertainty and failures.
6. Checkpoint switching is simple for users but deterministic in behavior.
7. No raw JSON editing in default workflows.

---

## 3) Information Architecture

Primary zones:

1. `Pipeline` — stage-based board, spec creation, run control
2. `Dashboard` — project overview and status
3. `Review` — binary decision sprint, evidence-based approval
4. `Library` — visual grid with faceted filters
5. `Export` — atlas packing, manifest generation
6. `Exceptions` — exception inbox for escalated items
7. `Trends` — trend dashboards (improvement runs, drift)
8. `Metrics` — quality-gate metrics and snapshots
9. `Settings` (secondary/power-user)

Design requirement:

1. Primary user loop is `Pipeline -> Review -> Export`.
2. `Exceptions`, `Trends`, and `Metrics` are supporting zones for monitoring and quality.
3. Legacy/classic pages remain only as migration fallback under `/classic/*` routes.

---

## 4) Core UX Flows

## 4.1 Pipeline Board

1. Stage-based cards (`draft`, `generating`, `review`, `alpha`, `atlas`, `exported`).
2. One primary action per stage.
3. Live status chips and evidence badges.
4. Stage transitions should be mostly automatic from backend events.

## 4.2 Review and Decision Sprint

1. Large image focus with keyboard-first actions.
2. Binary question flow (`yes/no/skip/undo`) for uncertain outputs.
3. Apply-to-similar batch actions where confidence and grouping permit.
4. Review questions are generated from contracts/tags, not ad-hoc forms.

## 4.3 Library

1. Visual grid with faceted filters and URL-synced state.
2. Tabs for assets/atlases/LoRAs/exports.
3. Detail drawer with history, evidence, and policy metadata.

## 4.4 Spec Creation

1. Wizard-first creation with smart defaults.
2. Checkpoint-aware policy fields:
   - `checkpointId`
   - `checkpointProfileId` / `checkpointProfileVersion`
   - compatible `baselineProfileId`
   - `promptPolicy`
   - `seedPolicy` (mode: fixed / derived / random_recorded)
   - `entityLink` (entityId + role)
3. Ready-state gate blocks incompatible checkpoint/policy combinations.

## 4.4.1 SpecDetailPage (6-tab editor)

The `SpecDetailPage` (route `/specs/:specId`) provides a tabbed editor:

| Tab              | Content                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------- |
| General          | title, assetType, style, scenario, output, generationParams, status                               |
| Prompt Policy    | compileMode, tagOrderMode, tagOrder, promptPresetId                                               |
| Quality Contract | backgroundPolicy, requiredStates, alignmentTolerancePx, perspectiveMode, silhouetteDriftTolerance |
| LoRA Policy      | mode, preferRecommended, maxActiveLoras, releasePolicy                                            |
| Seed Policy      | mode, baseSeed, deriveFrom, hashAlgo                                                              |
| Entity & Style   | entityLink (entityId, role), styleConsistency (mode, anchorRefs)                                  |

## 4.5 Settings and Admin

1. Structured forms for automation/configuration.
2. Progressive disclosure for expert controls.
3. Diagnostics and logs remain available but non-primary.

---

## 5) Checkpoint-Aware UX Requirements

For local multi-checkpoint use (for example `copax` and `pony`):

1. Checkpoint selector must stay simple in UI.
2. Backend must switch prompt dialect/policy via checkpoint profile automatically.
3. Baseline profile choices must be checkpoint-compatible only.
4. Tag-to-prompt order and fragments must be checkpoint-dependent and explainable.
5. Evidence UI must show:
   - checkpoint profile used,
   - prompt compile trace,
   - resolver compatibility decisions.

---

## 6) Automation UX Requirements

1. Show users what is happening now without exposing raw internals.
2. Route low-confidence/failing items to Decision Sprint or Exception Inbox.
3. Keep advanced tuning hidden in default mode.
4. Support deterministic retries before human interruption.

---

## 7) Visual Direction

1. Keep the established "mission control" identity.
2. Maintain clear tiered surfaces and status language.
3. Emphasize image content density and scannability.
4. Keep motion meaningful and accessibility-safe.

---

## 8) Component Scope

Primary components:

1. `PipelineBoard`, `PipelineCard`
2. `ReviewLightbox`
3. `DecisionQueue`, `BinaryQuestionCard`
4. `ImageGrid`, `FilterBar`, `DetailDrawer`
5. `SpecWizard`
6. `ExceptionInbox`, `AutopilotStatusBar`
7. `FormBuilder` and structured rule/config editors

These components are implemented and validated per master plan phases.

---

## 9) Alignment To Master Plan Phases

| Master phase | UX package focus                                        | Status |
| ------------ | ------------------------------------------------------- | ------ |
| Phase 0      | Schema registry, file-based JSON DB, AJV validation     | done   |
| Phase 1      | Specs, jobs, assets, exports — core CRUD and generation | done   |
| Phase 2      | Checkpoint profiles, LoRA resolver, baseline profiles   | done   |
| Phase 3      | Prompt compile trace (7-layer), tag-prompt ordering     | done   |
| Phase 4      | Automation rules, queue, SSE events, live status        | done   |
| Phase 5      | Decision sprint, review routing, binary question UX     | done   |
| Phase 6      | Exception inbox, escalation targets                     | done   |
| Phase 7      | Worker retry/escalation, poll queue, heartbeat          | done   |
| Phase 8      | SpecDetailPage 6-tab editor, SpecWizard                 | done   |
| Phase 9      | Metrics snapshots, quality gates, trend dashboards      | done   |
| Phase 10     | Improvement runs, circuit breaker schema, release gates | done   |
| Phase 11     | Migration: data/ gitignored, examples/ seed source      | done   |
| Phase 12     | Documentation and source of truth (this update)         | done   |

Implementation details and gates are tracked in:

- `docs/ui/happy-loop-implementation-backlog.md`

---

## 10) Success Metrics (UX Layer)

1. Main loop uses at most 2 zones for most work (`Pipeline`, `Review`; `Export` at release time).
2. Review throughput meets master plan targets.
3. High share of outputs resolved without manual tuning.
4. Checkpoint switching does not create hidden policy drift.
5. Users can understand "why this result/routing happened" from evidence UI.

---

## 11) Governance

1. This document owns UX intent and interaction quality.
2. The master plan owns execution order, dependencies, and completion gates.
3. Any new UI feature proposal must include:
   - phase mapping,
   - determinism impact,
   - checkpoint compatibility impact,
   - evidence/traceability impact.
