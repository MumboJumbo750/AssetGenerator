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

import { createJob, createSpec, createSpecList, type AssetSpec } from "../api";
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
  const [genWidth, setGenWidth] = useState(512);
  const [genHeight, setGenHeight] = useState(512);
  const [genVariants, setGenVariants] = useState(4);
  const [useSpecDefaults, setUseSpecDefaults] = useState(true);
  const [chainEnabled, setChainEnabled] = useState(false);
  const [nextJobs, setNextJobs] = useState<Array<{ type: string; inputText: string }>>([]);
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

  async function onQueueGenerate(spec: AssetSpec) {
    if (!selectedProjectId) return;
    setError(null);
    setChainError(null);
    try {
      if (!checkpointName.trim()) throw new Error("Checkpoint name is required for generation (ComfyUI ckpt_name).");
      const input: Record<string, unknown> = {
        specId: spec.id,
        templateId: "txt2img",
        checkpointName: checkpointName.trim(),
      };
      if (!useSpecDefaults) {
        input.width = genWidth;
        input.height = genHeight;
        input.variants = genVariants;
      }
      if (chainEnabled && nextJobs.length > 0) {
        const parsed = nextJobs.map((job, idx) => {
          const raw = job.inputText.trim();
          const inputObj = raw ? JSON.parse(raw) : {};
          if (typeof inputObj !== "object" || Array.isArray(inputObj)) {
            throw new Error(`Chained job ${idx + 1} input must be a JSON object`);
          }
          return { type: job.type, input: inputObj as Record<string, unknown> };
        });
        input.nextJobs = parsed;
      }
      await createJob(selectedProjectId, "generate", input);
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
          <TextInput
            label={
              <Group gap="xs">
                <span>Checkpoint</span>
                <HelpTip
                  label="Pick a ComfyUI checkpoint name (e.g. ckpt_sd15_demo). This controls the base model."
                  topicId="workflow-generation"
                />
              </Group>
            }
            description="ComfyUI checkpoint name (e.g. ckpt_sd15_demo)"
            placeholder="ckpt_name"
            value={checkpointName}
            onChange={onInput(setCheckpointName)}
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
          onApplyPreset={() =>
            setNextJobs([
              { type: "bg_remove", inputText: '{"originalPath":"$output.originalsDir/.."}' },
              { type: "export", inputText: '{"assetIds":["$output.assetId"]}' },
            ])
          }
          onAddJob={() =>
            setNextJobs((items) => [...items, { type: "export", inputText: '{"assetIds":["$output.assetId"]}' }])
          }
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
