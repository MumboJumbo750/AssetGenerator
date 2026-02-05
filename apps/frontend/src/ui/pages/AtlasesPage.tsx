import React, { useEffect, useRef } from "react";
import { Group, SimpleGrid, Stack, Text, Title } from "@mantine/core";

import { type AtlasRecord } from "../api";
import { HelpTip } from "../components/HelpTip";
import { useAppData } from "../context/AppDataContext";
import { useApprovedAtlasCandidates } from "../hooks/useApprovedAtlasCandidates";
import { useAtlasAnimationForm } from "../hooks/useAtlasAnimationForm";
import { useAtlasAnimationPreview } from "../hooks/useAtlasAnimationPreview";
import { useAtlasAnimationSave } from "../hooks/useAtlasAnimationSave";
import { useAtlasBuild, type FrameEntry } from "../hooks/useAtlasBuild";
import { useAtlasPivotEditor } from "../hooks/useAtlasPivotEditor";
import { useAtlasPivotSave } from "../hooks/useAtlasPivotSave";
import { useOrderedFrameList } from "../hooks/useOrderedFrameList";
import { useAtlasSelectionReset } from "../hooks/useAtlasSelectionReset";
import { useAtlasWorkspace } from "../hooks/useAtlasWorkspace";
import { AnimationPanel } from "./atlases/AnimationPanel";
import { AtlasBuildPanel } from "./atlases/AtlasBuildPanel";
import { AtlasPreviewPanel } from "./atlases/AtlasPreviewPanel";

export function AtlasesPage() {
  const { selectedProjectId, assets, specs, refreshProjectData, setError } = useAppData();

  const {
    animationName,
    animationFps,
    animationLoop,
    animationSpecId,
    setAnimationName,
    setAnimationFps,
    setAnimationLoop,
    setAnimationSpecId,
  } = useAtlasAnimationForm();
  const {
    frames: animationFrames,
    setFrames: setAnimationFrames,
    addFrame: addAnimationFrame,
    clearFrames: clearAnimationFrames,
    moveFrame: moveAnimationFrame,
    removeFrame: removeAnimationFrame,
  } = useOrderedFrameList();

  const {
    atlases,
    selectedAtlasId,
    setSelectedAtlasId,
    selectedAtlas,
    setSelectedAtlas,
    atlasError,
    refreshAtlases,
    atlasImageRef,
    imageSize,
    setImageSize,
    onImageLoad,
  } = useAtlasWorkspace(selectedProjectId);

  const {
    atlasId,
    padding,
    maxSize,
    powerOfTwo,
    trim,
    extrude,
    sort,
    frames,
    setAtlasId,
    setPadding,
    setMaxSize,
    setPowerOfTwo,
    setTrim,
    setExtrude,
    setSort,
    addFrame,
    moveFrame,
    updateFrameKey,
    removeFrame,
    createAtlas,
  } = useAtlasBuild({
    projectId: selectedProjectId,
    onRefreshProject: refreshProjectData,
    onRefreshAtlases: refreshAtlases,
    onError: (message) => setError(message),
  });

  const { saveAnimation } = useAtlasAnimationSave({
    projectId: selectedProjectId,
    onRefreshProject: refreshProjectData,
    onError: (message) => setError(message),
  });

  const { updatePivot } = useAtlasPivotEditor({ setSelectedAtlas });
  const { savePivots } = useAtlasPivotSave({
    selectedAtlas,
    onRefreshAtlases: refreshAtlases,
    onError: (message) => setError(message),
  });

  const animationCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const approvedCandidates = useApprovedAtlasCandidates(assets);

  useAtlasSelectionReset({
    selectedAtlasId: selectedAtlas?.id ?? null,
    onReset: () => setAnimationFrames([]),
  });

  useAtlasAnimationPreview({
    selectedAtlas,
    animationFrames,
    animationFps,
    animationLoop,
    animationCanvasRef,
    atlasImageRef,
  });

  async function onSavePivots() {
    await savePivots();
  }

  async function onSaveAnimation() {
    await saveAnimation({
      animationSpecId,
      animationName,
      animationFps,
      animationLoop,
      animationFrames,
    });
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Group gap="xs">
          <Title order={3}>Atlases</Title>
          <HelpTip label="Pack frames into atlases and define animation metadata." topicId="atlas-and-animation" />
        </Group>
        <Text c="dimmed">Frames → Atlas → Animation</Text>
      </Group>

      <SimpleGrid cols={{ base: 1, lg: 2 }}>
        <AtlasBuildPanel
          approvedCandidates={approvedCandidates}
          frames={frames}
          atlasId={atlasId}
          padding={padding}
          maxSize={maxSize}
          powerOfTwo={powerOfTwo}
          trim={trim}
          extrude={extrude}
          sort={sort}
          atlases={atlases}
          onAddFrame={addFrame}
          onUpdateFrameKey={updateFrameKey}
          onMoveFrame={moveFrame}
          onRemoveFrame={removeFrame}
          onAtlasIdChange={setAtlasId}
          onPaddingChange={setPadding}
          onMaxSizeChange={setMaxSize}
          onPowerOfTwoChange={setPowerOfTwo}
          onTrimChange={setTrim}
          onExtrudeChange={setExtrude}
          onSortChange={setSort}
          onCreateAtlas={createAtlas}
        />

        <AtlasPreviewPanel
          atlases={atlases}
          selectedAtlasId={selectedAtlasId}
          selectedAtlas={selectedAtlas}
          atlasError={atlasError}
          imageSize={imageSize}
          atlasImageRef={atlasImageRef}
          onSelectAtlasId={setSelectedAtlasId}
          onImageLoad={onImageLoad}
        />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, lg: 2 }}>
        <AnimationPanel
          selectedAtlas={selectedAtlas}
          animationName={animationName}
          animationFps={animationFps}
          animationLoop={animationLoop}
          animationFrames={animationFrames}
          animationSpecId={animationSpecId}
          specs={specs.map((spec) => ({ id: spec.id, title: spec.title }))}
          onAnimationNameChange={setAnimationName}
          onAnimationFpsChange={setAnimationFps}
          onAnimationLoopChange={setAnimationLoop}
          onAddFrame={addAnimationFrame}
          onClearFrames={clearAnimationFrames}
          onMoveFrame={moveAnimationFrame}
          onRemoveFrame={removeAnimationFrame}
          onAnimationSpecIdChange={setAnimationSpecId}
          onSaveAnimation={onSaveAnimation}
          onUpdatePivot={updatePivot}
          onSavePivots={onSavePivots}
          animationCanvasRef={animationCanvasRef}
        />
      </SimpleGrid>
    </Stack>
  );
}
