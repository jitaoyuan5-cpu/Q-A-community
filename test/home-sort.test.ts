import { describe, expect, it } from "vitest";
import { createInitialState } from "../src/app/data/initial-state";
import { selectQuestionsForHome } from "../src/app/store/selectors";

describe("home sorting", () => {
  it("sorts hot by votes then views", () => {
    const state = createInitialState();
    const list = selectQuestionsForHome(state, "hot", "");
    expect(list[0].id).toBe("q3");
  });

  it("filters unanswered", () => {
    const state = createInitialState();
    const list = selectQuestionsForHome(state, "unanswered", "");
    expect(list.every((q) => q.answers === 0)).toBe(true);
  });
});