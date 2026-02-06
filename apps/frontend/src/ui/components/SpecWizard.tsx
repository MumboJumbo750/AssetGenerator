import React, { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Group,
  Image,
  Modal,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Stepper,
  Switch,
  Text,
  TextInput,
  Textarea,
} from "@mantine/core";

import {
  createSpec,
  getCatalog,
  listBaselineProfiles,
  listCheckpoints,
  listProjectEvals,
  type AssetSpec,
  type Project,
} from "../api";

type TemplateDef = {
  id: string;
  label: string;
  assetType: string;
  title: string;
  positive: string;
  negative: string;
  outputKind: NonNullable<AssetSpec["output"]>["kind"];
  background: NonNullable<AssetSpec["output"]>["background"];
  frameCount?: number;
  width: number;
  height: number;
  variants: number;
};

type ProjectLoraPolicy = NonNullable<NonNullable<Project["policies"]>["loraSelection"]>;

const TEMPLATES: TemplateDef[] = [
  {
    id: "ui-icon",
    label: "UI Icon",
    assetType: "ui_icon",
    title: "UI icon: <name>",
    positive: "clean game ui icon, centered, high contrast, transparent background",
    negative: "text, watermark, blur, noisy background",
    outputKind: "single_image",
    background: "transparent_required",
    width: 512,
    height: 512,
    variants: 4,
  },
  {
    id: "character-sprite",
    label: "Character Sprite",
    assetType: "character_sprite",
    title: "Character sprite: <name>",
    positive: "game-ready character sprite, readable silhouette, transparent background",
    negative: "text, watermark, blur, background scenery",
    outputKind: "single_image",
    background: "transparent_required",
    width: 768,
    height: 768,
    variants: 4,
  },
  {
    id: "vfx-animation",
    label: "VFX Animation",
    assetType: "vfx",
    title: "VFX: <effect>",
    positive: "fx frames sequence, consistent style, transparent background",
    negative: "text, watermark, noisy background",
    outputKind: "animation",
    background: "transparent_required",
    frameCount: 8,
    width: 768,
    height: 768,
    variants: 1,
  },
];

export function SpecWizard({
  opened,
  projectId,
  assetTypeOptions,
  projectLoraPolicy,
  onClose,
  onCreated,
  onError,
}: {
  opened: boolean;
  projectId: string;
  assetTypeOptions: string[];
  projectLoraPolicy?: ProjectLoraPolicy;
  onClose: () => void;
  onCreated: (spec: AssetSpec) => void;
  onError: (message: string) => void;
}) {
  const [step, setStep] = useState(0);
  const [templateId, setTemplateId] = useState<string>(TEMPLATES[0].id);
  const [title, setTitle] = useState("");
  const [assetType, setAssetType] = useState("ui_icon");
  const [checkpointId, setCheckpointId] = useState("");
  const [checkpoints, setCheckpoints] = useState<Array<{ value: string; label: string }>>([]);
  const [baselineProfiles, setBaselineProfiles] = useState<Array<{ value: string; label: string }>>([]);
  const [baselineProfileId, setBaselineProfileId] = useState("");
  const [styleOptions, setStyleOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [scenarioOptions, setScenarioOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [sampleImages, setSampleImages] = useState<string[]>([]);
  const [style, setStyle] = useState("cartoon");
  const [scenario, setScenario] = useState("space");
  const [positive, setPositive] = useState("");
  const [negative, setNegative] = useState("");
  const [outputKind, setOutputKind] = useState<"single_image" | "animation" | "ui_states" | "logo_set">("single_image");
  const [background, setBackground] = useState<"transparent_required" | "any">("transparent_required");
  const [frameCount, setFrameCount] = useState(8);
  const [width, setWidth] = useState(512);
  const [height, setHeight] = useState(512);
  const [variants, setVariants] = useState(4);
  const [loraMode, setLoraMode] = useState<
    "manual" | "baseline_then_project" | "project_then_baseline" | "baseline_only" | "project_only"
  >("baseline_then_project");
  const [loraPreferRecommended, setLoraPreferRecommended] = useState(true);
  const [loraMaxActive, setLoraMaxActive] = useState(2);
  const [loraReleasePolicy, setLoraReleasePolicy] = useState<"active_or_latest_approved" | "active_only">(
    "active_or_latest_approved",
  );
  const [styleConsistencyMode, setStyleConsistencyMode] = useState<
    "inherit_project" | "lock_to_spec_style" | "lock_to_anchor_set"
  >("inherit_project");
  const [styleAnchorRefsCsv, setStyleAnchorRefsCsv] = useState("");
  const [qualityBackgroundPolicy, setQualityBackgroundPolicy] = useState<
    "white_or_transparent" | "transparent_only" | "white_only" | "any"
  >("white_or_transparent");
  const [qualityRequiredStatesCsv, setQualityRequiredStatesCsv] = useState("default");
  const [qualityAlignmentTolerancePx, setQualityAlignmentTolerancePx] = useState(2);
  const [expertMode, setExpertMode] = useState(false);
  const [busy, setBusy] = useState(false);

  const templateOptions = useMemo(
    () =>
      TEMPLATES.filter((item) => assetTypeOptions.length === 0 || assetTypeOptions.includes(item.assetType)).map(
        (item) => ({ value: item.id, label: item.label }),
      ),
    [assetTypeOptions],
  );

  useEffect(() => {
    if (!projectId || !opened) return;
    listCheckpoints(projectId)
      .then((result) => {
        const mapped = (result.checkpoints ?? []).map((item) => ({
          value: item.id,
          label: item.name ? `${item.name} (${item.id})` : item.id,
        }));
        setCheckpoints(mapped);
        if (!checkpointId && mapped[0]) setCheckpointId(mapped[0].value);
      })
      .catch((error: any) => onError(error?.message ?? String(error)));
  }, [checkpointId, onError, opened, projectId]);

  useEffect(() => {
    if (!opened) return;
    setLoraMode(projectLoraPolicy?.mode ?? "baseline_then_project");
    setLoraPreferRecommended(projectLoraPolicy?.preferRecommended ?? true);
    setLoraMaxActive(projectLoraPolicy?.maxActiveLoras ?? 2);
    setLoraReleasePolicy(projectLoraPolicy?.releasePolicy ?? "active_or_latest_approved");
  }, [
    opened,
    projectLoraPolicy?.maxActiveLoras,
    projectLoraPolicy?.mode,
    projectLoraPolicy?.preferRecommended,
    projectLoraPolicy?.releasePolicy,
  ]);

  useEffect(() => {
    if (!projectId || !opened) return;
    Promise.all([getCatalog(projectId, "styles"), getCatalog(projectId, "scenarios"), listProjectEvals(projectId)])
      .then(([stylesCatalog, scenariosCatalog, evalsResult]) => {
        const styles = Array.isArray((stylesCatalog as any)?.styles) ? ((stylesCatalog as any).styles as any[]) : [];
        const scenarios = Array.isArray((scenariosCatalog as any)?.scenarios)
          ? ((scenariosCatalog as any).scenarios as any[])
          : [];
        setStyleOptions(
          styles.map((item) => ({
            id: String(item.id ?? ""),
            label: String(item.label ?? item.id ?? ""),
          })),
        );
        setScenarioOptions(
          scenarios.map((item) => ({
            id: String(item.id ?? ""),
            label: String(item.label ?? item.id ?? ""),
          })),
        );
        const images = (evalsResult.evals ?? [])
          .flatMap((evalRecord) => (Array.isArray(evalRecord.outputs) ? evalRecord.outputs : []))
          .flatMap((output) => {
            const raw = Array.isArray((output as any)?.images) ? ((output as any).images as unknown[]) : [];
            return raw.map((item) => String(item ?? "").trim()).filter(Boolean);
          })
          .slice(0, 24);
        setSampleImages(images);
      })
      .catch((error: any) => onError(error?.message ?? String(error)));
  }, [onError, opened, projectId]);

  useEffect(() => {
    if (!projectId || !opened) return;
    listBaselineProfiles(projectId)
      .then((result) => {
        const options = (result.profiles ?? []).map((profile) => ({
          value: profile.id,
          label: `${profile.name} (v${profile.version})`,
        }));
        setBaselineProfiles(options);
        setBaselineProfileId((prev) => prev || options[0]?.value || "");
      })
      .catch((error: any) => onError(error?.message ?? String(error)));
  }, [onError, opened, projectId]);

  useEffect(() => {
    if (!style && styleOptions[0]) setStyle(styleOptions[0].id);
    if (!scenario && scenarioOptions[0]) setScenario(scenarioOptions[0].id);
  }, [scenario, scenarioOptions, style, styleOptions]);

  useEffect(() => {
    const template = TEMPLATES.find((item) => item.id === templateId);
    if (!template) return;
    setTitle(template.title);
    setAssetType(template.assetType);
    setPositive(template.positive);
    setNegative(template.negative);
    setOutputKind(template.outputKind ?? "single_image");
    setBackground(template.background ?? "transparent_required");
    setQualityBackgroundPolicy(template.background === "transparent_required" ? "transparent_only" : "any");
    setFrameCount(template.frameCount ?? 8);
    setWidth(template.width);
    setHeight(template.height);
    setVariants(template.variants);
  }, [templateId]);

  async function onCreate() {
    if (!projectId) return;
    if (!title.trim()) return onError("Spec title is required.");
    if (!checkpointId.trim()) return onError("Checkpoint is required.");
    setBusy(true);
    try {
      const output: AssetSpec["output"] = {
        kind: outputKind,
        background,
      };
      if (outputKind === "animation") {
        output.animation = {
          frameCount,
          frameNames: Array.from({ length: frameCount }, (_, index) => `frame_${index + 1}`),
        };
      }

      const created = await createSpec(projectId, {
        title,
        assetType,
        checkpointId,
        ...(baselineProfileId ? { baselineProfileId } : {}),
        loraPolicy: {
          mode: loraMode,
          preferRecommended: loraPreferRecommended,
          maxActiveLoras: loraMaxActive,
          releasePolicy: loraReleasePolicy,
        },
        styleConsistency: {
          mode: styleConsistencyMode,
          anchorRefs:
            styleConsistencyMode === "lock_to_anchor_set"
              ? styleAnchorRefsCsv
                  .split(",")
                  .map((item) => item.trim())
                  .filter(Boolean)
              : [],
        },
        qualityContract: {
          backgroundPolicy: qualityBackgroundPolicy,
          requiredStates: qualityRequiredStatesCsv
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          alignmentTolerancePx: qualityAlignmentTolerancePx,
        },
        style,
        scenario,
        prompt: { positive, negative },
        output,
        generationParams: {
          width,
          height,
          variants,
          autoBgRemove: background === "transparent_required",
        },
        status: "draft",
      });
      onCreated(created);
      setStep(0);
      onClose();
    } catch (error: any) {
      onError(error?.message ?? String(error));
    } finally {
      setBusy(false);
    }
  }

  function toDataUrl(pathValue?: string) {
    if (!pathValue?.trim()) return "";
    if (pathValue.startsWith("http")) return pathValue;
    if (pathValue.startsWith("/data/")) return pathValue;
    if (pathValue.startsWith("data/")) return `/${pathValue}`;
    return `/data/${pathValue}`;
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Spec Wizard" size="xl">
      <Stack gap="md">
        <Stepper active={step} onStepClick={setStep}>
          <Stepper.Step label="Template" description="Choose a starting point" />
          <Stepper.Step label="Prompt" description="Define content" />
          <Stepper.Step label="Output" description="Shape generation" />
          <Stepper.Step label="Review" description="Create draft spec" />
        </Stepper>

        {step === 0 && (
          <Stack gap="sm">
            <Select
              label="Template"
              data={templateOptions}
              value={templateId}
              onChange={(value) => setTemplateId(value ?? templateOptions[0]?.value ?? TEMPLATES[0].id)}
            />
            <Select
              label="Checkpoint"
              data={checkpoints}
              value={checkpointId}
              onChange={(value) => setCheckpointId(value ?? "")}
              searchable
            />
            <Select
              label="Asset type"
              data={assetTypeOptions}
              value={assetType}
              onChange={(value) => setAssetType(value ?? assetTypeOptions[0] ?? "ui_icon")}
            />
          </Stack>
        )}

        {step === 1 && (
          <Stack gap="sm">
            <TextInput label="Title" value={title} onChange={(event) => setTitle(event.currentTarget.value)} />
            <Stack gap="xs">
              <Text size="sm" fw={600}>
                Style picker
              </Text>
              <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
                {(styleOptions.length > 0
                  ? styleOptions
                  : [
                      { id: "cartoon", label: "cartoon" },
                      { id: "pixel", label: "pixel" },
                      { id: "clean_vector", label: "clean_vector" },
                    ]
                ).map((item, index) => (
                  <Card
                    key={`style-${item.id}`}
                    withBorder
                    radius="sm"
                    p="xs"
                    style={{
                      cursor: "pointer",
                      borderColor: style === item.id ? "var(--mantine-color-blue-6)" : undefined,
                    }}
                    onClick={() => setStyle(item.id)}
                  >
                    <Stack gap={6}>
                      {sampleImages[index % Math.max(1, sampleImages.length)] ? (
                        <Image
                          src={toDataUrl(sampleImages[index % sampleImages.length])}
                          alt={item.label}
                          h={96}
                          fit="cover"
                        />
                      ) : (
                        <div style={{ height: 96, borderRadius: 8, background: "rgba(20,30,40,0.6)" }} />
                      )}
                      <Group justify="space-between">
                        <Text size="sm">{item.label}</Text>
                        {style === item.id && <Badge size="xs">Selected</Badge>}
                      </Group>
                    </Stack>
                  </Card>
                ))}
              </SimpleGrid>
            </Stack>
            <Stack gap="xs">
              <Text size="sm" fw={600}>
                Scenario picker
              </Text>
              <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
                {(scenarioOptions.length > 0
                  ? scenarioOptions
                  : [
                      { id: "space", label: "space" },
                      { id: "dungeon", label: "dungeon" },
                      { id: "forest", label: "forest" },
                    ]
                ).map((item, index) => (
                  <Card
                    key={`scenario-${item.id}`}
                    withBorder
                    radius="sm"
                    p="xs"
                    style={{
                      cursor: "pointer",
                      borderColor: scenario === item.id ? "var(--mantine-color-blue-6)" : undefined,
                    }}
                    onClick={() => setScenario(item.id)}
                  >
                    <Stack gap={6}>
                      {sampleImages[(index + 3) % Math.max(1, sampleImages.length)] ? (
                        <Image
                          src={toDataUrl(sampleImages[(index + 3) % sampleImages.length])}
                          alt={item.label}
                          h={96}
                          fit="cover"
                        />
                      ) : (
                        <div style={{ height: 96, borderRadius: 8, background: "rgba(20,30,40,0.6)" }} />
                      )}
                      <Group justify="space-between">
                        <Text size="sm">{item.label}</Text>
                        {scenario === item.id && <Badge size="xs">Selected</Badge>}
                      </Group>
                    </Stack>
                  </Card>
                ))}
              </SimpleGrid>
            </Stack>
            <Textarea
              label="Positive prompt"
              value={positive}
              onChange={(event) => setPositive(event.currentTarget.value)}
              minRows={3}
            />
            <Textarea
              label="Negative prompt"
              value={negative}
              onChange={(event) => setNegative(event.currentTarget.value)}
              minRows={2}
            />
          </Stack>
        )}

        {step === 2 && (
          <Stack gap="sm">
            <Select
              label="Output kind"
              data={[
                { value: "single_image", label: "Single image" },
                { value: "animation", label: "Animation" },
                { value: "ui_states", label: "UI states" },
                { value: "logo_set", label: "Logo set" },
              ]}
              value={outputKind}
              onChange={(value) => setOutputKind((value as any) ?? "single_image")}
            />
            <Select
              label="Background"
              data={[
                { value: "transparent_required", label: "Transparent required" },
                { value: "any", label: "Any" },
              ]}
              value={background}
              onChange={(value) => setBackground((value as any) ?? "transparent_required")}
            />
            {outputKind === "animation" && (
              <NumberInput
                label="Frame count"
                min={2}
                max={64}
                value={frameCount}
                onChange={(value) => setFrameCount(Number(value ?? 8))}
              />
            )}

            <Switch
              checked={expertMode}
              onChange={(event) => setExpertMode(event.currentTarget.checked)}
              label="Expert mode"
            />
            <Card withBorder radius="sm" p="sm">
              <Stack gap="sm">
                <Text size="sm" fw={600}>
                  Generation policy
                </Text>
                <SimpleGrid cols={{ base: 1, md: 2 }}>
                  <Select
                    label="Baseline profile"
                    data={baselineProfiles}
                    value={baselineProfileId}
                    onChange={(value) => setBaselineProfileId(value ?? "")}
                    placeholder="Select baseline profile"
                  />
                  <Select
                    label="LoRA merge mode"
                    data={[
                      { value: "manual", label: "Manual" },
                      { value: "baseline_then_project", label: "Baseline then project" },
                      { value: "project_then_baseline", label: "Project then baseline" },
                      { value: "baseline_only", label: "Baseline only" },
                      { value: "project_only", label: "Project only" },
                    ]}
                    value={loraMode}
                    onChange={(value) =>
                      setLoraMode(
                        (value as
                          | "manual"
                          | "baseline_then_project"
                          | "project_then_baseline"
                          | "baseline_only"
                          | "project_only") ?? "baseline_then_project",
                      )
                    }
                  />
                  <NumberInput
                    label="Max active LoRAs"
                    value={loraMaxActive}
                    min={0}
                    max={8}
                    onChange={(value) => setLoraMaxActive(Number(value ?? 2))}
                  />
                  <Select
                    label="Release policy"
                    data={[
                      { value: "active_or_latest_approved", label: "Active or latest approved" },
                      { value: "active_only", label: "Active only" },
                    ]}
                    value={loraReleasePolicy}
                    onChange={(value) =>
                      setLoraReleasePolicy((value as "active_or_latest_approved" | "active_only") ?? "active_only")
                    }
                  />
                  <Select
                    label="Style consistency"
                    data={[
                      { value: "inherit_project", label: "Inherit project policy" },
                      { value: "lock_to_spec_style", label: "Lock to spec style/scenario" },
                      { value: "lock_to_anchor_set", label: "Lock to anchor set" },
                    ]}
                    value={styleConsistencyMode}
                    onChange={(value) =>
                      setStyleConsistencyMode(
                        (value as "inherit_project" | "lock_to_spec_style" | "lock_to_anchor_set") ?? "inherit_project",
                      )
                    }
                  />
                  <Switch
                    label="Prefer recommended LoRAs"
                    checked={loraPreferRecommended}
                    onChange={(event) => setLoraPreferRecommended(event.currentTarget.checked)}
                  />
                </SimpleGrid>
                {styleConsistencyMode === "lock_to_anchor_set" && (
                  <TextInput
                    label="Style anchor refs (csv)"
                    description="IDs for reference assets/evals used to enforce style cohesion."
                    value={styleAnchorRefsCsv}
                    onChange={(event) => setStyleAnchorRefsCsv(event.currentTarget.value)}
                    placeholder="asset_foo, eval_bar, moodboard_01"
                  />
                )}
                <SimpleGrid cols={{ base: 1, md: 3 }}>
                  <Select
                    label="Quality background policy"
                    data={[
                      { value: "white_or_transparent", label: "White or transparent" },
                      { value: "transparent_only", label: "Transparent only" },
                      { value: "white_only", label: "White only" },
                      { value: "any", label: "Any" },
                    ]}
                    value={qualityBackgroundPolicy}
                    onChange={(value) =>
                      setQualityBackgroundPolicy(
                        (value as "white_or_transparent" | "transparent_only" | "white_only" | "any") ??
                          "white_or_transparent",
                      )
                    }
                  />
                  <TextInput
                    label="Required states (csv)"
                    value={qualityRequiredStatesCsv}
                    onChange={(event) => setQualityRequiredStatesCsv(event.currentTarget.value)}
                    placeholder="default,hover,pressed"
                  />
                  <NumberInput
                    label="Alignment tolerance (px)"
                    value={qualityAlignmentTolerancePx}
                    min={0}
                    max={64}
                    onChange={(value) => setQualityAlignmentTolerancePx(Number(value ?? 2))}
                  />
                </SimpleGrid>
              </Stack>
            </Card>
            {expertMode && (
              <Group grow>
                <NumberInput
                  label="Width"
                  value={width}
                  min={64}
                  step={64}
                  onChange={(v) => setWidth(Number(v ?? 512))}
                />
                <NumberInput
                  label="Height"
                  value={height}
                  min={64}
                  step={64}
                  onChange={(v) => setHeight(Number(v ?? 512))}
                />
                <NumberInput
                  label="Variants"
                  value={variants}
                  min={1}
                  max={12}
                  onChange={(v) => setVariants(Number(v ?? 4))}
                />
              </Group>
            )}
          </Stack>
        )}

        {step === 3 && (
          <Stack gap="xs">
            <Text fw={600}>Ready to create draft spec</Text>
            <Text size="sm" c="dimmed">
              {title} - {assetType} - {outputKind}
            </Text>
            <Text size="sm" c="dimmed">
              Checkpoint: {checkpointId || "(not set)"}
            </Text>
            <Text size="sm" c="dimmed">
              Baseline profile: {baselineProfileId || "none"} - LoRA mode: {loraMode}
            </Text>
            <Text size="sm" c="dimmed">
              Style consistency: {styleConsistencyMode}
              {styleConsistencyMode === "lock_to_anchor_set" && styleAnchorRefsCsv.trim()
                ? ` (${styleAnchorRefsCsv})`
                : ""}
            </Text>
            <Text size="sm" c="dimmed">
              Quality contract: {qualityBackgroundPolicy} - states [{qualityRequiredStatesCsv || "none"}] - align{" "}
              {qualityAlignmentTolerancePx}px
            </Text>
            <Text size="sm" c="dimmed">
              Background: {background} - Variants: {variants} - Size: {width}x{height}
            </Text>
            {outputKind === "animation" && (
              <Text size="sm" c="dimmed">
                Frames: {frameCount}
              </Text>
            )}
          </Stack>
        )}

        <Group justify="space-between">
          <Button
            variant="light"
            onClick={() => setStep((value) => Math.max(0, value - 1))}
            disabled={step === 0 || busy}
          >
            Back
          </Button>
          <Group>
            <Button variant="default" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            {step < 3 ? (
              <Button onClick={() => setStep((value) => Math.min(3, value + 1))} disabled={busy}>
                Next
              </Button>
            ) : (
              <Button onClick={() => onCreate().catch(() => undefined)} loading={busy}>
                Create draft spec
              </Button>
            )}
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}
