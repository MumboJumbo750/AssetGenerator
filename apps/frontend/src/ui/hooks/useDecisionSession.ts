import { useCallback, useMemo, useReducer } from "react";

import type { Asset, AssetSpec } from "../api";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type DecisionQuestion = {
  id: string;
  text: string;
  helperTools: string[];
  source: "validator" | "tag_contract" | "entity_contract" | "fallback";
  contractRef?: string;
};

export type QuestionAnswer = "yes" | "no" | "skip" | "unsure";

export type AnswerRecord = {
  questionId: string;
  answer: QuestionAnswer;
  answeredAt: string;
};

export type DecisionSessionItem = {
  asset: Asset;
  spec: AssetSpec | null;
  questions: DecisionQuestion[];
  answers: AnswerRecord[];
  /** Routing decision originally produced by the worker */
  routingDecision?: string;
};

export type DecisionSessionState = {
  items: DecisionSessionItem[];
  currentIndex: number;
  currentQuestionIndex: number;
  completedCount: number;
  skippedCount: number;
  /** Stack of last actions for undo */
  undoStack: Array<{
    itemIndex: number;
    questionIndex: number;
    answer: AnswerRecord;
  }>;
};

type SessionAction =
  | { type: "SET_ITEMS"; items: DecisionSessionItem[] }
  | { type: "ANSWER"; answer: QuestionAnswer }
  | { type: "SKIP_ITEM" }
  | { type: "UNDO" }
  | { type: "GO_TO_ITEM"; index: number }
  | { type: "RESET" };

/* ------------------------------------------------------------------ */
/*  Reducer                                                            */
/* ------------------------------------------------------------------ */

function initialState(): DecisionSessionState {
  return {
    items: [],
    currentIndex: 0,
    currentQuestionIndex: 0,
    completedCount: 0,
    skippedCount: 0,
    undoStack: [],
  };
}

function nextUnansweredItem(items: DecisionSessionItem[], afterIndex: number): number {
  for (let i = afterIndex; i < items.length; i++) {
    if (items[i].answers.length < items[i].questions.length) return i;
  }
  return -1;
}

function reducer(state: DecisionSessionState, action: SessionAction): DecisionSessionState {
  switch (action.type) {
    case "SET_ITEMS": {
      return { ...initialState(), items: action.items };
    }

    case "ANSWER": {
      const items = [...state.items];
      const item = items[state.currentIndex];
      if (!item || state.currentQuestionIndex >= item.questions.length) return state;

      const question = item.questions[state.currentQuestionIndex];
      const record: AnswerRecord = {
        questionId: question.id,
        answer: action.answer,
        answeredAt: new Date().toISOString(),
      };

      const updatedItem: DecisionSessionItem = {
        ...item,
        answers: [...item.answers, record],
      };
      items[state.currentIndex] = updatedItem;

      const undoEntry = {
        itemIndex: state.currentIndex,
        questionIndex: state.currentQuestionIndex,
        answer: record,
      };

      const nextQ = state.currentQuestionIndex + 1;
      const allAnswered = nextQ >= updatedItem.questions.length;

      if (allAnswered) {
        const nextItem = nextUnansweredItem(items, state.currentIndex + 1);
        return {
          ...state,
          items,
          currentIndex: nextItem >= 0 ? nextItem : state.currentIndex,
          currentQuestionIndex: 0,
          completedCount: state.completedCount + 1,
          undoStack: [...state.undoStack, undoEntry],
        };
      }

      return {
        ...state,
        items,
        currentQuestionIndex: nextQ,
        undoStack: [...state.undoStack, undoEntry],
      };
    }

    case "SKIP_ITEM": {
      const nextItem = nextUnansweredItem(state.items, state.currentIndex + 1);
      return {
        ...state,
        currentIndex: nextItem >= 0 ? nextItem : state.currentIndex,
        currentQuestionIndex: 0,
        skippedCount: state.skippedCount + 1,
      };
    }

    case "UNDO": {
      if (state.undoStack.length === 0) return state;
      const last = state.undoStack[state.undoStack.length - 1];
      const items = [...state.items];
      const item = items[last.itemIndex];
      if (!item) return state;

      const updatedItem: DecisionSessionItem = {
        ...item,
        answers: item.answers.filter((a) => a.questionId !== last.answer.questionId),
      };
      items[last.itemIndex] = updatedItem;

      const wasCompleted = item.answers.length >= item.questions.length;

      return {
        ...state,
        items,
        currentIndex: last.itemIndex,
        currentQuestionIndex: last.questionIndex,
        completedCount: wasCompleted ? state.completedCount - 1 : state.completedCount,
        undoStack: state.undoStack.slice(0, -1),
      };
    }

    case "GO_TO_ITEM": {
      if (action.index < 0 || action.index >= state.items.length) return state;
      return { ...state, currentIndex: action.index, currentQuestionIndex: 0 };
    }

    case "RESET":
      return initialState();

    default:
      return state;
  }
}

/* ------------------------------------------------------------------ */
/*  Question extraction helpers                                        */
/* ------------------------------------------------------------------ */

function extractQuestionsFromGeneration(generation: Record<string, unknown> | undefined): DecisionQuestion[] {
  if (!generation) return [];

  // Worker stores decision questions in generation.decisionQuestions
  const stored = generation.decisionQuestions;
  if (stored && typeof stored === "object" && Array.isArray((stored as any).questions)) {
    return (stored as any).questions as DecisionQuestion[];
  }

  // Fallback: build from validator report
  const report = generation.validatorReport as Record<string, unknown> | undefined;
  const checks = generation.validators as
    | Record<string, { pass: boolean; confidence: number; reason: string }>
    | undefined;
  if (!checks) return [];

  const questions: DecisionQuestion[] = [];
  for (const [checkId, result] of Object.entries(checks)) {
    if (typeof result !== "object" || !result) continue;
    if (result.pass) continue;
    questions.push({
      id: `q.validator.${checkId}`,
      text: validatorQuestionText(checkId),
      helperTools: [],
      source: "validator",
      contractRef: checkId,
    });
  }

  if (questions.length === 0) {
    questions.push({
      id: "q.fallback.ship",
      text: "Should this variant be accepted for production use?",
      helperTools: [],
      source: "fallback",
    });
  }

  return questions;
}

function validatorQuestionText(checkId: string) {
  if (checkId === "background_policy") return "Is the background policy fulfilled in this render?";
  if (checkId === "state_alignment") return "Do state variants stay aligned and consistent?";
  if (checkId === "silhouette_consistency") return "Does the silhouette stay consistent with the same asset family?";
  if (checkId === "perspective_consistency") return "Is the perspective angle consistent and usable in-game?";
  if (checkId === "entity_prompt_continuity") return "Does this still represent the same linked entity identity?";
  if (checkId === "prompt_policy_tag_order") return "Does prompt intent match expected tag-priority behavior?";
  if (checkId === "required_states_output_kind") return "Are required states represented by the selected output kind?";
  return "Is this output compliant with the expected contract?";
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useDecisionSession() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);

  const loadItems = useCallback((assets: Asset[], specsById: Map<string, AssetSpec>) => {
    const items: DecisionSessionItem[] = assets.map((asset) => {
      const spec = specsById.get(asset.specId) ?? null;
      const latestVersion = asset.versions[asset.versions.length - 1];
      const generation = latestVersion?.generation as Record<string, unknown> | undefined;
      const questions = extractQuestionsFromGeneration(generation);
      const routingDecision =
        typeof generation?.routingDecision === "string"
          ? generation.routingDecision
          : typeof (generation?.routingResult as any)?.decision === "string"
            ? (generation?.routingResult as any).decision
            : undefined;

      return { asset, spec, questions, answers: [], routingDecision };
    });

    dispatch({ type: "SET_ITEMS", items });
  }, []);

  const answer = useCallback((value: QuestionAnswer) => dispatch({ type: "ANSWER", answer: value }), []);
  const skipItem = useCallback(() => dispatch({ type: "SKIP_ITEM" }), []);
  const undo = useCallback(() => dispatch({ type: "UNDO" }), []);
  const goToItem = useCallback((index: number) => dispatch({ type: "GO_TO_ITEM", index }), []);
  const reset = useCallback(() => dispatch({ type: "RESET" }), []);

  const currentItem = state.items[state.currentIndex] ?? null;
  const currentQuestion = currentItem?.questions[state.currentQuestionIndex] ?? null;
  const isComplete = state.items.length > 0 && nextUnansweredItem(state.items, 0) < 0;

  const summary = useMemo(() => {
    let yesCount = 0;
    let noCount = 0;
    let skipCount = 0;
    let unsureCount = 0;
    for (const item of state.items) {
      for (const a of item.answers) {
        if (a.answer === "yes") yesCount++;
        else if (a.answer === "no") noCount++;
        else if (a.answer === "skip") skipCount++;
        else if (a.answer === "unsure") unsureCount++;
      }
    }
    return {
      total: state.items.length,
      completed: state.completedCount,
      skipped: state.skippedCount,
      yesCount,
      noCount,
      skipCount,
      unsureCount,
    };
  }, [state]);

  /** Items whose majority answer to all questions was "yes" */
  const approvedAssetIds = useMemo(() => {
    const ids: string[] = [];
    for (const item of state.items) {
      if (item.answers.length < item.questions.length) continue;
      const noCount = item.answers.filter((a) => a.answer === "no").length;
      if (noCount === 0) ids.push(item.asset.id);
    }
    return ids;
  }, [state.items]);

  /** Items whose answers include at least one "no" */
  const rejectedAssetIds = useMemo(() => {
    const ids: string[] = [];
    for (const item of state.items) {
      if (item.answers.length < item.questions.length) continue;
      const noCount = item.answers.filter((a) => a.answer === "no").length;
      if (noCount > 0) ids.push(item.asset.id);
    }
    return ids;
  }, [state.items]);

  /** Items whose answers include at least one "unsure" (and no "no") → exception queue */
  const unsureAssetIds = useMemo(() => {
    const ids: string[] = [];
    for (const item of state.items) {
      if (item.answers.length < item.questions.length) continue;
      const noCount = item.answers.filter((a) => a.answer === "no").length;
      const unsureCount = item.answers.filter((a) => a.answer === "unsure").length;
      if (noCount === 0 && unsureCount > 0) ids.push(item.asset.id);
    }
    return ids;
  }, [state.items]);

  return {
    state,
    currentItem,
    currentQuestion,
    isComplete,
    summary,
    approvedAssetIds,
    rejectedAssetIds,
    unsureAssetIds,
    loadItems,
    answer,
    skipItem,
    undo,
    goToItem,
    reset,
  };
}
