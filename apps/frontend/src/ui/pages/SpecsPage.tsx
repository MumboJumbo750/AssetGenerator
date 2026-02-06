import React, { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Checkbox,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
} from "@mantine/core";
import { Link } from "react-router-dom";
import { ulid } from "ulid";

import { createJob, createSpec, createSpecList, listCheckpoints, type AssetSpec } from "../api";
import { HelpTip } from "../components/HelpTip";
import { useAppData } from "../context/AppDataContext";
import { useSpecRefinement } from "../hooks/useSpecRefinement";
import type { SpecListItem } from "../types/viewModels";
import { ChainedJobsPanel } from "./specs/ChainedJobsPanel";
import { RefinementPanel } from "./specs/RefinementPanel";
import { SpecListPanel } from "./specs/SpecListPanel";
import { SpecTemplatesPanel } from "./specs/SpecTemplatesPanel";
import { SpecsListPanel } from "./specs/SpecsListPanel";

const SPEC_TEMPLATES = [
  {
    id: "ui_icon",
    label: "UI Icon",
    assetType: "ui_icon",
    title: "UI icon: <name>",
    positive: "clean vector-style ui icon, centered, high contrast, minimal, transparent background, sharp edges",
    negative: "text, watermark, blurry, low quality, cluttered background",
    width: 512,
    height: 512,
    variants: 6,
  },
  {
    id: "tileable_texture",
    label: "Tileable Texture",
    assetType: "texture",
    title: "Tileable texture: <material>",
    positive: "seamless tileable texture, even lighting, top-down, no shadows, high detail",
    negative: "text, watermark, seams, perspective, strong shadows, blurry",
    width: 512,
    height: 512,
    variants: 4,
  },
  {
    id: "spritesheet_character",
    label: "Spritesheet",
    assetType: "spritesheet",
    title: "Spritesheet: <character> idle/run",
    positive:
      "spritesheet frames, consistent style, consistent lighting, transparent background, pixel-art or clean vector",
    negative: "text, watermark, blurry, inconsistent lighting, cluttered background",
    width: 768,
    height: 768,
    variants: 4,
  },
];

type ChainedJobDraft = {
  type: "bg_remove" | "atlas_pack" | "export";
  bgRemoveOriginalPath: string;
  bgRemoveThreshold: number;
  bgRemoveFeather: number;
  bgRemoveErode: number;
  atlasFramePathsCsv: string;
  atlasPadding: number;
  atlasMaxSize: number;
  atlasPowerOfTwo: boolean;
  atlasTrim: boolean;
  atlasExtrude: number;
  atlasSort: string;
  exportAssetIdsCsv: string;
  exportAtlasIdsCsv: string;
  exportProfileId: string;
};

function splitCsv(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function emptyChainedJob(type: ChainedJobDraft["type"] = "bg_remove"): ChainedJobDraft {
  return {
    type,
    bgRemoveOriginalPath: "$output.originalPath",
    bgRemoveThreshold: 245,
    bgRemoveFeather: 1,
    bgRemoveErode: 0,
    atlasFramePathsCsv: "$output.alphaPath",
    atlasPadding: 2,
    atlasMaxSize: 2048,
    atlasPowerOfTwo: false,
    atlasTrim: false,
    atlasExtrude: 0,
    atlasSort: "area",
    exportAssetIdsCsv: "$output.assetId",
    exportAtlasIdsCsv: "",
    exportProfileId: "",
  };
}

export function SpecsPage() {
  const {
    selectedProjectId,
    specLists,
    selectedSpecListId,
    setSelectedSpecListId,
    specs,
    assetTypeCatalog,
    assetTypeCatalogError,
    refreshProjectData,
    setError,
  } = useAppData();

  const [specTitle, setSpecTitle] = useState("");
  const [specText, setSpecText] = useState("");
  const [newSpecTitle, setNewSpecTitle] = useState("");
  const [newSpecType, setNewSpecType] = useState("ui_icon");
  const [newSpecPos, setNewSpecPos] = useState("");
  const [newSpecNeg, setNewSpecNeg] = useState("text, watermark, blurry, low quality, cluttered background");
  const [checkpointName, setCheckpointName] = useState("");
  const [checkpointOptions, setCheckpointOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [checkpointsError, setCheckpointsError] = useState<string | null>(null);
  const [genWidth, setGenWidth] = useState(512);
  const [genHeight, setGenHeight] = useState(512);
  const [genVariants, setGenVariants] = useState(4);
  const [useSpecDefaults, setUseSpecDefaults] = useState(true);
  const [chainEnabled, setChainEnabled] = useState(false);
  const [nextJobs, setNextJobs] = useState<ChainedJobDraft[]>([]);
  const [chainError, setChainError] = useState<string | null>(null);

  const selectedSpecList = useMemo(
    () => (selectedSpecListId ? (specLists.find((specList) => specList.id === selectedSpecListId) ?? null) : null),
    [selectedSpecListId, specLists],
  );
  const specListItems: SpecListItem[] = useMemo(
    () =>
      specLists.map((specList) => ({
        id: specList.id,
        title: specList.title,
        status: specList.status,
        text: specList.text,
      })),
    [specLists],
  );

  const assetTypeOptions = useMemo(
    () => assetTypeCatalog?.assetTypes?.map((assetType) => assetType.id) ?? [],
    [assetTypeCatalog],
  );

  const templateOptions = useMemo(
    () =>
      SPEC_TEMPLATES.filter((template) =>
        assetTypeOptions.length === 0 ? true : assetTypeOptions.includes(template.assetType),
      ),
    [assetTypeOptions],
  );

  const {
    refineDefaultType,
    setRefineDefaultType,
    refineItems,
    refineBusy,
    refineError,
    onParseSpecList,
    onRefineSpecList,
    updateRefineItem,
    removeRefineItem,
  } = useSpecRefinement({
    projectId: selectedProjectId,
    assetTypeOptions,
    selectedSpecList,
    onError: (message) => setError(message),
  });

  useEffect(() => {
    if (assetTypeOptions.length === 0) return;
    if (!assetTypeOptions.includes(newSpecType)) setNewSpecType(assetTypeOptions[0]);
    if (!assetTypeOptions.includes(refineDefaultType)) setRefineDefaultType(assetTypeOptions[0]);
  }, [assetTypeOptions, newSpecType, refineDefaultType, setRefineDefaultType]);

  useEffect(() => {
    if (!selectedProjectId) return;
    setCheckpointsError(null);
    listCheckpoints(selectedProjectId)
      .then((result) => {
        const options =
          result.checkpoints?.map((checkpoint) => ({
            value: checkpoint.id,
            label: checkpoint.name ? `${checkpoint.name} (${checkpoint.id})` : checkpoint.id,
          })) ?? [];
        setCheckpointOptions(options);
        if (!checkpointName && options[0]) setCheckpointName(options[0].value);
      })
      .catch((e: any) => setCheckpointsError(e?.message ?? String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId]);

  const onInput = (setter: (value: string) => void) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setter(event.currentTarget.value);
  const onTextarea = (setter: (value: string) => void) => (event: React.ChangeEvent<HTMLTextAreaElement>) =>
    setter(event.currentTarget.value);
  const onSelect = (setter: (value: string) => void, fallback: string) => (value: string | null) =>
    setter(value ?? fallback);
  const onNumber = (setter: (value: number) => void, fallback: number) => (value: string | number | null) =>
    setter(Number(value) || fallback);

  async function onCreateSpecList() {
    if (!selectedProjectId) return;
    setError(null);
    try {
      await createSpecList(selectedProjectId, specTitle, specText);
      setSpecTitle("");
      setSpecText("");
      await refreshProjectData();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }

  async function handleRefineSpecList() {
    const created = await onRefineSpecList();
    if (created) {
      await refreshProjectData();
    }
  }

  async function onCreateSpec() {
    if (!selectedProjectId) return;
    setError(null);
    try {
      await createSpec(selectedProjectId, {
        title: newSpecTitle,
        assetType: newSpecType,
        prompt: { positive: newSpecPos, negative: newSpecNeg },
        generationParams: { width: genWidth, height: genHeight, variants: genVariants },
        status: "ready",
      });
      setNewSpecTitle("");
      setNewSpecPos("");
      await refreshProjectData();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }

  function buildChainedJobInput(job: ChainedJobDraft, idx: number) {
    if (job.type === "bg_remove") {
      const originalPath = job.bgRemoveOriginalPath.trim();
      if (!originalPath) throw new Error(`Chained job ${idx + 1} (bg_remove) requires original path.`);
      return {
        type: "bg_remove" as const,
        input: {
          originalPath,
          threshold: job.bgRemoveThreshold,
          feather: job.bgRemoveFeather,
          erode: job.bgRemoveErode,
        },
      };
    }

    if (job.type === "atlas_pack") {
      const framePaths = splitCsv(job.atlasFramePathsCsv);
      if (framePaths.length === 0) throw new Error(`Chained job ${idx + 1} (atlas_pack) requires frame paths.`);
      return {
        type: "atlas_pack" as const,
        input: {
          framePaths,
          padding: job.atlasPadding,
          maxSize: job.atlasMaxSize,
          powerOfTwo: job.atlasPowerOfTwo,
          trim: job.atlasTrim,
          extrude: job.atlasExtrude,
          sort: job.atlasSort || "area",
        },
      };
    }

    return {
      type: "export" as const,
      input: {
        assetIds: splitCsv(job.exportAssetIdsCsv),
        atlasIds: splitCsv(job.exportAtlasIdsCsv),
        ...(job.exportProfileId.trim() ? { profileId: job.exportProfileId.trim() } : {}),
      },
    };
  }

  async function onQueueGenerate(spec: AssetSpec) {
    if (!selectedProjectId) return;
    setError(null);
    setChainError(null);
    try {
      if (!checkpointName.trim()) throw new Error("Checkpoint name is required for generation (ComfyUI ckpt_name).");
      const baseInput: Record<string, unknown> = {
        specId: spec.id,
        templateId: "txt2img",
        checkpointName: checkpointName.trim(),
      };
      if (!useSpecDefaults) {
        baseInput.width = genWidth;
        baseInput.height = genHeight;
        baseInput.variants = genVariants;
      }
      if (chainEnabled && nextJobs.length > 0) {
        baseInput.nextJobs = nextJobs.map((job, idx) => buildChainedJobInput(job, idx));
      }

      const frameNames = spec.output?.animation?.frameNames ?? [];
      const framePrompts = spec.output?.animation?.framePrompts ?? [];
      const frameCount = Number(spec.output?.animation?.frameCount ?? frameNames.length ?? 0);
      const isAnimation = spec.output?.kind === "animation" || frameCount > 1;

      if (isAnimation && frameCount > 1) {
        const sequenceId = ulid();
        for (let index = 0; index < frameCount; index += 1) {
          const input: Record<string, unknown> = { ...baseInput };
          input.sequenceId = sequenceId;
          input.assetId = sequenceId;
          input.frameIndex = index;
          input.frameCount = frameCount;
          if (frameNames[index]) input.frameName = frameNames[index];
          if (framePrompts[index]) {
            input.framePrompt = framePrompts[index];
            input.positive = `${spec.prompt.positive}, ${framePrompts[index]}`;
          }
          await createJob(selectedProjectId, "generate", input);
        }
      } else {
        await createJob(selectedProjectId, "generate", baseInput);
      }
      await refreshProjectData();
    } catch (e: any) {
      const message = e?.message ?? String(e);
      if (message?.includes("Chained job")) setChainError(message);
      else setError(message);
    }
  }

  function applyTemplate(templateId: string) {
    const template = SPEC_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    setNewSpecTitle(template.title);
    setNewSpecType(template.assetType);
    setNewSpecPos(template.positive);
    setNewSpecNeg(template.negative);
    setGenWidth(template.width);
    setGenHeight(template.height);
    setGenVariants(template.variants);
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={3}>Specs</Title>
        <HelpTip label="Define specs and move from ideas to generation-ready records." topicId="workflow-specs" />
        <Text c="dimmed">SpecLists â†’ refinement â†’ AssetSpecs</Text>
      </Group>
      {specLists.length === 0 && (
        <Card withBorder radius="md" p="md">
          <Stack gap="xs">
            <Text fw={600}>Start here</Text>
            <Text size="sm" c="dimmed">
              Create a SpecList, refine it into AssetSpecs, then queue generation jobs.
            </Text>
            <Group>
              <Button component="a" href="#specs-create">
                Create first SpecList
              </Button>
              <Button component={Link} to="/assets" variant="light">
                Review assets
              </Button>
            </Group>
          </Stack>
        </Card>
      )}
      <SimpleGrid cols={{ base: 1, lg: 2 }}>
        <SpecListPanel
          specLists={specListItems}
          selectedSpecListId={selectedSpecListId}
          onSelectSpecList={setSelectedSpecListId}
          specTitle={specTitle}
          specText={specText}
          assetTypeCatalogError={assetTypeCatalogError}
          onSpecTitleChange={setSpecTitle}
          onSpecTextChange={setSpecText}
          onCreateSpecList={onCreateSpecList}
        />
        <RefinementPanel
          selectedSpecList={selectedSpecList as (SpecListItem & { text: string }) | null}
          assetTypeOptions={assetTypeOptions}
          refineDefaultType={refineDefaultType}
          refineItems={refineItems}
          refineBusy={refineBusy}
          refineError={refineError}
          onDefaultTypeChange={setRefineDefaultType}
          onParseSpecList={onParseSpecList}
          onRefineSpecList={handleRefineSpecList}
          onUpdateItem={updateRefineItem}
          onRemoveItem={removeRefineItem}
        />
      </SimpleGrid>

      <Stack gap="md">
        <SpecsListPanel
          specs={specs}
          onParseSpecList={onParseSpecList}
          onRefineSpecList={handleRefineSpecList}
          refineItemsCount={refineItems.length}
          onQueueGenerate={onQueueGenerate}
        />
        <SpecTemplatesPanel templates={templateOptions} onApplyTemplate={applyTemplate} />
        <Group grow>
          <Select
            label={
              <Group gap="xs">
                <span>Checkpoint</span>
                <HelpTip
                  label="Pick a ComfyUI checkpoint name (e.g. ckpt_sd15_demo). This controls the base model."
                  topicId="workflow-generation"
                />
              </Group>
            }
            description="ComfyUI checkpoint name (base model)"
            placeholder="Select checkpoint"
            value={checkpointName}
            data={checkpointOptions}
            searchable
            allowDeselect={false}
            onChange={onSelect(setCheckpointName, checkpointOptions[0]?.value ?? "")}
            error={checkpointsError}
          />
          <NumberInput
            label="W"
            value={genWidth}
            onChange={onNumber(setGenWidth, 512)}
            min={64}
            step={64}
            disabled={useSpecDefaults}
          />
          <NumberInput
            label="H"
            value={genHeight}
            onChange={onNumber(setGenHeight, 512)}
            min={64}
            step={64}
            disabled={useSpecDefaults}
          />
          <NumberInput
            label={
              <Group gap="xs">
                <span>Variants</span>
                <HelpTip
                  label="How many variations per spec. Start with 4â€“6 while testing prompts."
                  topicId="workflow-generation"
                />
              </Group>
            }
            value={genVariants}
            onChange={onNumber(setGenVariants, 1)}
            min={1}
            max={16}
            disabled={useSpecDefaults}
          />
        </Group>
        <Group>
          <Checkbox
            checked={useSpecDefaults}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setUseSpecDefaults(event.currentTarget.checked)}
            label="Use spec defaults (generation params from AssetSpec)"
          />
        </Group>
        <ChainedJobsPanel
          chainEnabled={chainEnabled}
          nextJobs={nextJobs}
          chainError={chainError}
          onToggleEnabled={setChainEnabled}
          onUpdateJob={(idx, patch) =>
            setNextJobs((items) => items.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
          }
          onRemoveJob={(idx) => setNextJobs((items) => items.filter((_, i) => i !== idx))}
          onApplyPreset={() => setNextJobs([emptyChainedJob("bg_remove"), emptyChainedJob("export")])}
          onAddJob={() => setNextJobs((items) => [...items, emptyChainedJob("export")])}
        />
        <Card withBorder radius="md" p="md">
          <Stack gap="md">
            <TextInput placeholder="Spec title" value={newSpecTitle} onChange={onInput(setNewSpecTitle)} />
            <Select
              data={assetTypeOptions}
              value={newSpecType}
              onChange={onSelect(setNewSpecType, assetTypeOptions[0] ?? "ui_icon")}
            />
            <Textarea
              placeholder="Positive prompt example"
              value={newSpecPos}
              onChange={onTextarea(setNewSpecPos)}
              minRows={2}
              label={
                <Group gap="xs">
                  <span>Positive prompt</span>
                  <HelpTip
                    label="Describe what you want. Mention style, mood, and constraints like clean background."
                    topicId="workflow-generation"
                  />
                </Group>
              }
            />
            <Textarea
              placeholder="Negative prompt example"
              value={newSpecNeg}
              onChange={onTextarea(setNewSpecNeg)}
              minRows={2}
              label={
                <Group gap="xs">
                  <span>Negative prompt</span>
                  <HelpTip
                    label="Describe what to avoid (watermark, text, blurry, clutter)."
                    topicId="workflow-generation"
                  />
                </Group>
              }
            />
            <Button onClick={onCreateSpec} disabled={!newSpecTitle.trim()}>
              Add Spec
            </Button>
          </Stack>
        </Card>
      </Stack>
    </Stack>
  );
}
