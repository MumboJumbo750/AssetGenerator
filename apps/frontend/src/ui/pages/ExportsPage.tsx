import React, { useMemo } from "react";
import { Group, SimpleGrid, Stack, Text, Title } from "@mantine/core";

import { HelpTip } from "../components/HelpTip";
import { useAppData } from "../context/AppDataContext";
import { useExportMappings } from "../hooks/useExportMappings";
import { useExportProfiles } from "../hooks/useExportProfiles";
import { useExportRun } from "../hooks/useExportRun";
import { useExportSelectionReset } from "../hooks/useExportSelectionReset";
import { useExportSelections } from "../hooks/useExportSelections";
import { useExportsViewModel } from "../hooks/useExportsViewModel";
import { useTextInput } from "../hooks/useTextInput";
import { AnimationMappingPanel } from "./exports/AnimationMappingPanel";
import { ExportProfilesPanel } from "./exports/ExportProfilesPanel";
import { ExportRunPanel } from "./exports/ExportRunPanel";
import { ExportSelectionPanel } from "./exports/ExportSelectionPanel";
import { UiMappingPanel } from "./exports/UiMappingPanel";

export function ExportsPage() {
  const { selectedProjectId, assets, specs, refreshProjectData, setError } = useAppData();
  const { value: exportId, setValue: setExportId } = useTextInput("");
  const { assetSelection, atlasSelection } = useExportSelections();

  const uiSpecsLocal = useMemo(
    () => specs.filter((spec) => spec.output?.kind === "ui_states" && spec.output?.uiStates?.states?.length),
    [specs]
  );
  const { animationAtlasMap, setAnimationAtlasMap, uiMappings, updateUiMapping, resetMappings } = useExportMappings(uiSpecsLocal);
  const {
    profiles,
    atlases,
    profileError,
    atlasError,
    selectedProfileId,
    setSelectedProfileId,
    profileName,
    profileScale,
    profileTrim,
    profilePadding,
    profilePrefix,
    profileSuffix,
    setProfileName,
    setProfileScale,
    setProfileTrim,
    setProfilePadding,
    setProfilePrefix,
    setProfileSuffix,
    selectedProfile,
    profileOptions,
    createProfile,
    updateProfile
  } = useExportProfiles(selectedProjectId);

  const {
    uiSpecs,
    animationSpecs,
    exportableAssets,
    textureOptions,
    missingAnimationMappings,
    missingUiMappings
  } = useExportsViewModel({
    assets,
    specs,
    uiSpecs: uiSpecsLocal,
    atlases,
    assetSelection: assetSelection.selected,
    atlasSelection: atlasSelection.selected,
    animationAtlasMap,
    uiMappings,
    profilePrefix,
    profileSuffix
  });

  useExportSelectionReset({
    projectId: selectedProjectId,
    assetSelection,
    atlasSelection,
    resetMappings
  });

  const { runExport } = useExportRun({
    projectId: selectedProjectId,
    exportId,
    setExportId,
    selectedProfile,
    assetSelection,
    atlasSelection,
    animationSpecs,
    animationAtlasMap,
    uiSpecs,
    uiMappings,
    onRefresh: refreshProjectData,
    onError: (message) => setError(message)
  });


  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Group gap="xs">
          <Title order={3}>Exports</Title>
          <HelpTip label="Create profiles and export Pixi kits." topicId="exports-pixi" />
        </Group>
        <Text c="dimmed">Profiles → Selection → Export</Text>
      </Group>

      <SimpleGrid cols={{ base: 1, lg: 2 }}>
        <ExportProfilesPanel
          profiles={profiles}
          profileError={profileError}
          selectedProfileId={selectedProfileId}
          profileName={profileName}
          profileScale={profileScale}
          profileTrim={profileTrim}
          profilePadding={profilePadding}
          profilePrefix={profilePrefix}
          profileSuffix={profileSuffix}
          onSelectProfileId={setSelectedProfileId}
          onProfileNameChange={setProfileName}
          onProfileScaleChange={setProfileScale}
          onProfileTrimChange={setProfileTrim}
          onProfilePaddingChange={setProfilePadding}
          onProfilePrefixChange={setProfilePrefix}
          onProfileSuffixChange={setProfileSuffix}
          onCreateProfile={createProfile}
          onUpdateProfile={updateProfile}
          disableUpdate={!selectedProfile}
        />
        <ExportRunPanel
          exportId={exportId}
          profiles={profiles.map((profile) => ({ id: profile.id, name: profile.name }))}
          selectedProfileId={selectedProfileId}
          missingAnimations={missingAnimationMappings.length}
          missingUi={missingUiMappings.length}
          onExportIdChange={setExportId}
          onSelectProfileId={setSelectedProfileId}
          onRunExport={runExport}
        />
      </SimpleGrid>

      <ExportSelectionPanel
        exportableAssets={exportableAssets.map((asset) => ({ id: asset.id, title: asset.title, previewPath: asset.previewPath }))}
        atlases={atlases}
        atlasError={atlasError}
        isAssetSelected={assetSelection.has}
        onToggleAsset={assetSelection.toggle}
        onSelectAllAssets={() => assetSelection.select(exportableAssets.map((a) => a.id))}
        onClearAssets={assetSelection.clear}
        isAtlasSelected={atlasSelection.has}
        onToggleAtlas={atlasSelection.toggle}
        onSelectAllAtlases={() => atlasSelection.select(atlases.map((a) => a.id))}
        onClearAtlases={atlasSelection.clear}
      />

      <SimpleGrid cols={{ base: 1, lg: 2 }}>
        <AnimationMappingPanel
          animationSpecs={animationSpecs}
          atlases={atlases}
          animationAtlasMap={animationAtlasMap}
          onAtlasMapChange={(specId, atlasId) => setAnimationAtlasMap((prev) => ({ ...prev, [specId]: atlasId }))}
        />
        <UiMappingPanel
          uiSpecs={uiSpecs}
          textureOptions={textureOptions}
          uiMappings={uiMappings}
          onUpdateMapping={updateUiMapping}
        />
      </SimpleGrid>
    </Stack>
  );
}
