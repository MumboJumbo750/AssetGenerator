import React from "react";
import { Button, Card, Group, ScrollArea, Stack, Text } from "@mantine/core";

import { PipelineCard, type PipelineStage } from "./PipelineCard";

export type PipelineBoardItem = {
  id: string;
  title: string;
  assetType: string;
  stage: PipelineStage;
  thumbnailPath?: string;
  variantCount?: number;
  progress?: number;
  meta?: string;
  policyBadges?: string[];
  evidenceBadge?: { label: string; color: string };
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
};

const STAGES: Array<{ stage: PipelineStage; label: string }> = [
  { stage: "draft", label: "Draft" },
  { stage: "generating", label: "Generating" },
  { stage: "review", label: "Review" },
  { stage: "alpha", label: "Alpha" },
  { stage: "atlas", label: "Atlas" },
  { stage: "exported", label: "Exported" },
];

export function PipelineBoard({
  items,
  onStartDecisionSprint,
}: {
  items: PipelineBoardItem[];
  onStartDecisionSprint?: () => void;
}) {
  return (
    <ScrollArea offsetScrollbars>
      <div className="ag-pipeline-board">
        {STAGES.map(({ stage, label }) => {
          const stageItems = items.filter((item) => item.stage === stage);
          return (
            <Card key={stage} withBorder radius="md" p="sm" className="ag-pipeline-column">
              <Stack gap="sm" h="100%">
                <Group justify="space-between">
                  <Text fw={700}>{label}</Text>
                  <Group gap="xs">
                    <Text size="xs" c="dimmed">
                      {stageItems.length}
                    </Text>
                    {stage === "review" && stageItems.length > 0 && onStartDecisionSprint && (
                      <Button size="xs" variant="light" onClick={onStartDecisionSprint}>
                        Start Decision Sprint
                      </Button>
                    )}
                  </Group>
                </Group>
                <Stack gap="sm">
                  {stageItems.length === 0 && (
                    <Text size="xs" c="dimmed">
                      Nothing here.
                    </Text>
                  )}
                  {stageItems.map((item, index) => (
                    <PipelineCard
                      key={item.id}
                      title={item.title}
                      assetType={item.assetType}
                      stage={item.stage}
                      thumbnailPath={item.thumbnailPath}
                      variantCount={item.variantCount}
                      progress={item.progress}
                      primaryActionLabel={item.primaryActionLabel}
                      onPrimaryAction={item.onPrimaryAction}
                      meta={item.meta}
                      policyBadges={item.policyBadges}
                      evidenceBadge={item.evidenceBadge}
                      motionIndex={index}
                    />
                  ))}
                </Stack>
              </Stack>
            </Card>
          );
        })}
      </div>
    </ScrollArea>
  );
}
