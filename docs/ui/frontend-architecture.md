# Frontend architecture (UI)

This document describes how the UI is structured for scalability and clarity.

## Directory layout

- `apps/frontend/src/ui/App.tsx`: providers + routes only
- `apps/frontend/src/ui/layouts/*`: AppShell + navigation
- `apps/frontend/src/ui/pages/*`: route-level pages
- `apps/frontend/src/ui/components/*`: reusable UI components
- `apps/frontend/src/ui/hooks/*`: shared workflows (async actions, selection)
- `apps/frontend/src/ui/services/*`: shared data/services (system status, verification)
- `apps/frontend/src/ui/types/*`: view-model types
- `apps/frontend/src/ui/pixi/*`: Pixi preview feature (hooks + types)
- `apps/frontend/src/ui/api.ts`: API boundary

## Rules of thumb

- **No god files**: pages should stay focused; split when a file grows.
- **Hooks for workflows**: shared async actions and selection logic belong in hooks.
- **Workflow hooks**: keep reusable page logic in hooks (e.g. `useAssetsViewModel`, `useAssetFilters`, `useAssetCatalogOptions`, `useAssetDerivedLists`, `useAssetReviewState`, `useAssetBulkActions`, `useAssetVariantActions`, `useAssetReviewActions`, `useAssetSelectionHelpers`, `useAssetFilterPresets`, `useTextInput`, `useExportProfiles`, `useExportsViewModel`, `useExportSelections`, `useExportSelectionReset`, `useExportRun`, `useExportMappings`, `useSpecRefinement`, `useAtlasWorkspace`, `useAtlasImageSizing`, `useAtlasAnimationForm`, `useAtlasAnimationPreview`, `useAtlasBuild`, `useAtlasAnimationSave`, `useAtlasPivotEditor`, `useAtlasPivotSave`, `useOrderedFrameList`, `useApprovedAtlasCandidates`, `useAtlasSelectionReset`, `useSelectedJob`, `useSystemLogService`, `useOnboardingStep`, `useHelpTopics`).
- **System hooks**: wrap log/verify operations in hooks (`useJobLog`, `useSystemLog`, `useComfyVerify`).
- **Feature folders**: complex areas (like Pixi preview) should have a local `hooks/` + `types/`.
- **Page subcomponents**: split heavy pages into `pages/<page>/*` panels (e.g. `pages/assets/*`, `pages/specs/*`, `pages/atlases/*`, `pages/exports/*`, `pages/jobs/*`, `pages/logs/*`, `pages/overview/*`).
- **View models**: map raw API shapes into UI-friendly types.
- **Shared data**: use `AppDataProvider` + `useAppData` for project-scoped state.

## Typical flow

1. `pages/*` consumes `useAppData` + hooks
2. `hooks/*` handle shared async/selection logic
3. `types/*` defines view-models for lists and filters

## Example patterns

```
const action = useAsyncAction(async () => { ... });
const selection = useSelectionSet<string>();
const list: AssetListItem[] = useMemo(() => mapAssets(...), [deps]);
```
