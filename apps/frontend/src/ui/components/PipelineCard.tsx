import React from "react";
import { Badge, Button, Card, Group, Progress, Stack, Text, Title } from "@mantine/core";

export type PipelineStage = "draft" | "generating" | "review" | "alpha" | "atlas" | "exported";

type PipelineCardProps = {
  title: string;
  assetType: string;
  stage: PipelineStage;
  thumbnailPath?: string;
  variantCount?: number;
  progress?: number;
  primaryActionLabel?: string;
  disabled?: boolean;
  meta?: string;
  motionIndex?: number;
  policyBadges?: string[];
  evidenceBadge?: { label: string; color: string };
  onPrimaryAction?: () => void;
};

const STAGE_META: Record<PipelineStage, { color: string; label: string }> = {
  draft: { color: "gray", label: "Draft" },
  generating: { color: "blue", label: "Generating" },
  review: { color: "yellow", label: "Review" },
  alpha: { color: "teal", label: "Alpha" },
  atlas: { color: "violet", label: "Atlas" },
  exported: { color: "green", label: "Exported" },
};

function toDataUrl(pathValue?: string) {
  if (!pathValue?.trim()) return "";
  if (pathValue.startsWith("http")) return pathValue;
  if (pathValue.startsWith("/data/")) return pathValue;
  if (pathValue.startsWith("data/")) return `/${pathValue}`;
  return `/data/${pathValue}`;
}

export function PipelineCard({
  title,
  assetType,
  stage,
  thumbnailPath,
  variantCount,
  progress,
  primaryActionLabel,
  disabled,
  meta,
  motionIndex,
  policyBadges,
  evidenceBadge,
  onPrimaryAction,
}: PipelineCardProps) {
  const stageMeta = STAGE_META[stage];
  const thumbnail = toDataUrl(thumbnailPath);

  return (
    <Card
      withBorder
      radius="md"
      p="sm"
      className={`ag-pipeline-card ag-card-tier-2 ag-state-${stage}`}
      style={
        motionIndex !== undefined
          ? ({ ["--ag-delay" as any]: `${motionIndex * 35}ms` } as React.CSSProperties)
          : undefined
      }
    >
      <Stack gap="xs">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <div>
            <Title order={6} lineClamp={2}>
              {title}
            </Title>
            <Text size="xs" c="dimmed">
              {assetType}
            </Text>
            {!!policyBadges?.length && (
              <Group gap={6} mt={6}>
                {policyBadges.map((badge) => (
                  <Badge key={badge} size="xs" variant="light" color="cyan">
                    {badge}
                  </Badge>
                ))}
              </Group>
            )}
          </div>
          <Badge variant="light" color={stageMeta.color}>
            {stageMeta.label}
          </Badge>
        </Group>

        <div className="ag-pipeline-thumb ag-image-first">
          {thumbnail ? (
            <img src={thumbnail} alt={title} className="ag-pipeline-thumb-image" />
          ) : (
            <Text size="xs" c="dimmed">
              No preview yet
            </Text>
          )}
          <div className="ag-image-overlay">
            <Text size="xs" className="ag-image-overlay-title">
              {title}
            </Text>
            <Text size="xs" className="ag-image-overlay-subtitle">
              {typeof variantCount === "number" ? `${variantCount} variants` : assetType}
            </Text>
          </div>
        </div>

        {typeof progress === "number" && <Progress value={Math.max(0, Math.min(100, progress))} size="sm" />}

        <Group justify="space-between" align="center">
          <Group gap={6}>
            <Text size="xs" c="dimmed">
              {meta ?? (typeof variantCount === "number" ? `${variantCount} variants` : "")}
            </Text>
            {evidenceBadge && (
              <Badge size="xs" variant="outline" color={evidenceBadge.color}>
                {evidenceBadge.label}
              </Badge>
            )}
          </Group>
          {primaryActionLabel && (
            <Button size="sm" onClick={onPrimaryAction} disabled={disabled}>
              {primaryActionLabel}
            </Button>
          )}
        </Group>
      </Stack>
    </Card>
  );
}
