import { describe, expect, it } from "vitest";
import { createInitialState } from "../src/app/data/initial-state";
import { filterRemoteJobs } from "../src/app/utils/remote-filter";

describe("remote filters", () => {
  it("supports combined region + salary + skill filters", () => {
    const state = createInitialState();
    const jobs = filterRemoteJobs(state.remoteJobs, "中国", "20K-30K", "React");
    expect(jobs.length).toBe(1);
    expect(jobs[0].id).toBe("j1");
  });
});