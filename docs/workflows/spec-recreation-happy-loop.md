# Workflow: Spec Recreation For Autopilot (Happy Loop)

Use this when recreating existing specs or creating new specs so automation can run end-to-end with minimal manual intervention.

## Outcome

A spec is considered "autopilot-ready" when it includes:

- content definition (`assetType`, `style`, `scenario`, prompts)
- generation policy (`checkpointId`, `checkpointProfileId`, `baselineProfileId`, `loraPolicy`, `styleConsistency`)
- quality contract (`qualityContract`)
- output contract (`output`, `generationParams`)

If any of these are missing, review and routing quality drop and manual work increases.

## 1) Spec Recreation Checklist (Definition of Ready)

Before setting `status: "ready"` confirm all are true:

1. `checkpointId` is set and valid for this project.
2. `checkpointProfileId` is set or deterministically derivable from project checkpoint policy.
3. `checkpointProfileVersion` is set (integer, auto-incremented on profile changes).
4. `baselineProfileId` is checkpoint-compatible.
5. `loraPolicy.mode` is selected (not implicit/unknown).
6. `styleConsistency.mode` is selected.
7. `promptPolicy.tagOrderMode` is set (`checkpoint_default` preferred).
8. `qualityContract.backgroundPolicy` is set.
9. `qualityContract.requiredStates` is set for stateful assets.
10. `qualityContract.alignmentTolerancePx` is set for aligned-state assets.
11. `output.kind` and output-specific fields are complete.
12. `generationParams` has width/height/variants consistent with asset purpose.
13. prompts include both positive and negative constraints.
14. `seedPolicy.mode` is set (`random_recorded` recommended for most workflows; `fixed` for reproducibility tests; `derived` for entity-coherent batches).
15. `entityLink` is set for identity-bearing assets (`entityId` + `role`): required for any asset that must maintain visual continuity across variants (e.g., weapon world sprite and its pickup icon).

## 2) Recommended Defaults By Asset Intent

### Static icon/single image

- `output.kind`: `single_image`
- `qualityContract.backgroundPolicy`: `transparent_only`
- `qualityContract.requiredStates`: `["default"]`
- `qualityContract.alignmentTolerancePx`: `2`
- `styleConsistency.mode`: `lock_to_spec_style`

### UI states (button/checkbox/toggle)

- `output.kind`: `ui_states`
- `qualityContract.backgroundPolicy`: `transparent_only`
- `qualityContract.requiredStates`: `["default","hover","pressed","disabled"]`
- `qualityContract.alignmentTolerancePx`: `1` to `2`
- `styleConsistency.mode`: `lock_to_anchor_set` (preferred)

### Animation/VFX sequence

- `output.kind`: `animation`
- `output.animation.frameCount`: explicit
- `qualityContract.backgroundPolicy`: `transparent_only`
- `qualityContract.requiredStates`: frame names or sequence states
- `qualityContract.alignmentTolerancePx`: `2` to `4`

## 3) Canonical JSON Template

Use this as your baseline when recreating specs:

```json
{
  "title": "UI: primary button",
  "assetType": "ui_icon",
  "checkpointId": "ckpt_id_here",
  "checkpointProfileId": "ckpt_profile_id_here",
  "checkpointProfileVersion": 1,
  "baselineProfileId": "baseline_profile_id_here",
  "loraPolicy": {
    "mode": "baseline_then_project",
    "preferRecommended": true,
    "maxActiveLoras": 2,
    "releasePolicy": "active_or_latest_approved"
  },
  "promptPolicy": {
    "compileMode": "checkpoint_profile_default",
    "tagOrderMode": "checkpoint_default",
    "tagOrder": []
  },
  "seedPolicy": {
    "mode": "random_recorded"
  },
  "entityLink": {
    "entityId": "entity_id_here_if_identity_bearing",
    "role": "ui_card"
  },
  "styleConsistency": {
    "mode": "lock_to_spec_style",
    "anchorRefs": []
  },
  "qualityContract": {
    "backgroundPolicy": "transparent_only",
    "requiredStates": ["default", "hover", "pressed", "disabled"],
    "alignmentTolerancePx": 2
  },
  "style": "clean_vector",
  "scenario": "space_ui",
  "prompt": {
    "positive": "clean readable game ui primary button, crisp edges, centered composition",
    "negative": "text, watermark, blur, noisy background, perspective distortion"
  },
  "output": {
    "kind": "ui_states",
    "background": "transparent_required",
    "uiStates": {
      "states": ["default", "hover", "pressed", "disabled"]
    }
  },
  "generationParams": {
    "width": 512,
    "height": 512,
    "variants": 4,
    "autoBgRemove": true
  },
  "status": "ready"
}
```

## 4) In-App Creation Path (Recommended)

Use `Pipeline -> New Spec (Wizard)` and always fill:

1. Template, checkpoint, asset type
2. style/scenario + prompt
3. output settings
4. generation policy block:
   - checkpoint profile + version
   - baseline profile
   - LoRA mode/release policy
   - prompt policy (checkpoint tag order default recommended)
   - seed policy (mode: `random_recorded` default)
   - entity link (entityId + role, when identity-bearing)
   - style consistency (+ anchors when needed)
   - quality contract

Then run from Pipeline with `Run Pipeline`.

## 5) Fast Validation After Creation

After first generation:

1. Open Pipeline card and verify policy badges are present.
2. Open Review and verify policy badges + evidence badges exist.
3. In Library filters, verify the asset is discoverable by:
   - LoRA policy
   - style consistency
   - quality background

If any are missing, update the spec before bulk generation.

## 6) Common Failure Modes (and Fixes)

- Missing `baselineProfileId`:
  - Fix by selecting a baseline profile that is compatible with the selected checkpoint.
- Missing `checkpointProfileId` or unresolved profile:
  - Fix by selecting the checkpoint profile bundle for the chosen checkpoint.
- Wrong prompt order mode:
  - Use `promptPolicy.tagOrderMode = checkpoint_default` unless there is a justified spec-level override.
- Wrong `requiredStates`:
  - Fix before review; otherwise validator/routing confidence is noisy.
- Over-broad `qualityContract.backgroundPolicy`:
  - For UI assets, use `transparent_only`.
- No style anchors for multi-state UI packs:
  - Use `styleConsistency.mode = lock_to_anchor_set` and set `anchorRefs`.

## 7) Team Rule For Recreated Specs

When recreating old specs, do not mark ready until checklist section 1 is complete.

This avoids old/manual specs re-entering the new automated workflow with partial metadata.
