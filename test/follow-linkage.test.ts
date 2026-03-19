import { describe, expect, it } from "vitest";
import { createInitialState } from "../src/app/data/initial-state";
import { qaReducer } from "../src/app/store/qa-reducer";

describe("follow linkage", () => {
  it("marks followed question as having new answers after addAnswer", () => {
    const state = createInitialState();
    const followed = qaReducer(state, { type: "TOGGLE_FOLLOW_QUESTION", payload: { questionId: "q2" } });
    const withAnswer = qaReducer(followed, { type: "ADD_ANSWER", payload: { questionId: "q2", content: "新增回答" } });

    const record = withAnswer.follows.find((f) => f.questionId === "q2");
    expect(record?.hasNewAnswers).toBe(true);
  });
});