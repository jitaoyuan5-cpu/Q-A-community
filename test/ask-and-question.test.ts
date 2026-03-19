import { describe, expect, it } from "vitest";
import { validateQuestionDraft, qaReducer } from "../src/app/store/qa-reducer";
import { createInitialState } from "../src/app/data/initial-state";

describe("question validation", () => {
  it("rejects invalid title/tag boundaries", () => {
    expect(validateQuestionDraft("", "content", ["React"])).toBe(false);
    expect(validateQuestionDraft("a".repeat(201), "content", ["React"])).toBe(false);
    expect(validateQuestionDraft("ok", "", ["React"])).toBe(false);
    expect(validateQuestionDraft("ok", "content", [])).toBe(false);
    expect(validateQuestionDraft("ok", "content", ["1", "2", "3", "4", "5", "6"])).toBe(false);
  });

  it("accepts valid draft and appends question", () => {
    const state = createInitialState();
    const next = qaReducer(state, {
      type: "ADD_QUESTION",
      payload: { title: "新问题", content: "详细内容", tags: ["React"] },
    });
    expect(next.questions.length).toBe(state.questions.length + 1);
    expect(next.questions[0].title).toBe("新问题");
  });
});