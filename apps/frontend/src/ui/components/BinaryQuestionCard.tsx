import React from "react";
import { Badge, Button, Card, Group, Stack, Text, ThemeIcon } from "@mantine/core";

import type { DecisionQuestion, QuestionAnswer } from "../hooks/useDecisionSession";

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

type BinaryQuestionCardProps = {
  question: DecisionQuestion;
  questionIndex: number;
  totalQuestions: number;
  onAnswer: (answer: QuestionAnswer) => void;
  onUndo?: () => void;
  canUndo?: boolean;
};

/* ------------------------------------------------------------------ */
/*  Source label helpers                                                */
/* ------------------------------------------------------------------ */

const sourceLabels: Record<string, { label: string; color: string }> = {
  validator: { label: "Validator", color: "orange" },
  tag_contract: { label: "Tag contract", color: "cyan" },
  entity_contract: { label: "Entity identity", color: "violet" },
  fallback: { label: "General", color: "gray" },
};

const toolLabels: Record<string, string> = {
  overlay_grid: "Iso Grid",
  bg_cycler: "BG Cycle",
  reference_ghost: "Ghost Ref",
  safe_area: "Safe Frame",
  onion_skin: "Onion Skin",
  color_picker: "Color Pick",
  horizon_line: "Horizon",
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function BinaryQuestionCard({
  question,
  questionIndex,
  totalQuestions,
  onAnswer,
  onUndo,
  canUndo,
}: BinaryQuestionCardProps) {
  const source = sourceLabels[question.source] ?? sourceLabels.fallback;

  return (
    <Card withBorder radius="md" p="lg" className="ag-decision-question-card ag-card-tier-2">
      <Stack gap="md">
        {/* Header row */}
        <Group justify="space-between" align="center">
          <Group gap="xs">
            <Badge size="sm" variant="light" color={source.color}>
              {source.label}
            </Badge>
            {question.contractRef && (
              <Badge size="xs" variant="outline" color="gray">
                {question.contractRef}
              </Badge>
            )}
          </Group>
          <Text size="xs" c="dimmed">
            Question {questionIndex + 1} of {totalQuestions}
          </Text>
        </Group>

        {/* Question text */}
        <Text fw={600} size="lg" className="ag-decision-question-text">
          {question.text}
        </Text>

        {/* Helper tool hints */}
        {question.helperTools.length > 0 && (
          <Group gap={6}>
            <Text size="xs" c="dimmed">
              Tools:
            </Text>
            {question.helperTools.map((tool) => (
              <Badge key={tool} size="xs" variant="dot" color="teal">
                {toolLabels[tool] ?? tool}
              </Badge>
            ))}
          </Group>
        )}

        {/* Action buttons */}
        <Group justify="center" gap="lg" mt="sm">
          <Button color="green" size="lg" variant="filled" onClick={() => onAnswer("yes")} className="ag-decision-btn">
            Yes (Y)
          </Button>
          <Button color="red" size="lg" variant="light" onClick={() => onAnswer("no")} className="ag-decision-btn">
            No (N)
          </Button>
          <Button
            color="yellow"
            size="md"
            variant="light"
            onClick={() => onAnswer("unsure")}
            className="ag-decision-btn"
          >
            Unsure (U)
          </Button>
          <Button
            color="gray"
            size="md"
            variant="subtle"
            onClick={() => onAnswer("skip")}
            className="ag-decision-btn-skip"
          >
            Skip (S)
          </Button>
        </Group>

        {/* Undo */}
        {canUndo && onUndo && (
          <Group justify="center">
            <Button size="xs" variant="subtle" color="gray" onClick={onUndo}>
              Undo last (Z)
            </Button>
          </Group>
        )}
      </Stack>
    </Card>
  );
}
