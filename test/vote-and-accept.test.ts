import { describe, expect, it } from "vitest";
import { createInitialState } from "../src/app/data/initial-state";
import { qaReducer } from "../src/app/store/qa-reducer";

describe("vote and accept flow", () => {
  it("toggles question vote and can revert by clicking same direction", () => {
    const state = createInitialState();
    const q1 = state.questions.find((q) => q.id === "q1")!;

    const upVoted = qaReducer(state, { type: "TOGGLE_VOTE", payload: { target: "question", id: "q1", delta: 1 } });
    const reverted = qaReducer(upVoted, { type: "TOGGLE_VOTE", payload: { target: "question", id: "q1", delta: 1 } });

    expect(upVoted.questions.find((q) => q.id === "q1")!.votes).toBe(q1.votes + 1);
    expect(reverted.questions.find((q) => q.id === "q1")!.votes).toBe(q1.votes);
  });

  it("keeps only one accepted answer per question", () => {
    const state = createInitialState();
    const next = qaReducer(state, { type: "ACCEPT_ANSWER", payload: { answerId: "ans2" } });
    const answers = next.answers.filter((a) => a.questionId === "q1");

    expect(answers.find((a) => a.id === "ans2")!.isAccepted).toBe(true);
    expect(answers.find((a) => a.id === "ans1")!.isAccepted).toBe(false);
  });
});