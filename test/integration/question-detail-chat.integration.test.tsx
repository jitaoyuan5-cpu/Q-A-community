import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiRequestMock = vi.fn();
const qaState = {
  currentUserId: "1",
  users: [{ id: "1", name: "Alice", avatar: "", reputation: 100 }],
  questions: [{ id: "1", title: "问题标题", content: "问题内容", authorId: "1", tags: ["React"], views: 10, votes: 2, answers: 1, createdAt: "2026-03-20T00:00:00.000Z", updatedAt: "2026-03-20T00:00:00.000Z" }],
  answers: [{ id: "11", questionId: "1", authorId: "1", content: "回答内容", votes: 1, isAccepted: false, createdAt: "2026-03-20T00:00:00.000Z", updatedAt: "2026-03-20T00:00:00.000Z" }],
  topics: [],
  remoteJobs: [],
  articles: [],
  follows: [],
  favorites: [],
  notifications: [],
  emailPreferences: { emailEnabled: true, notifyNewAnswer: true, notifyNewComment: true, notifyAnswerAccepted: true, notifyFollowUpdate: true },
  voteRecord: {},
  idCounters: { question: 2, answer: 2 },
};
const actions = {
  markQuestionViewed: vi.fn().mockResolvedValue(undefined),
  markFollowSeen: vi.fn().mockResolvedValue(undefined),
  refreshNotifications: vi.fn().mockResolvedValue(undefined),
  voteQuestion: vi.fn().mockResolvedValue(undefined),
  voteAnswer: vi.fn().mockResolvedValue(undefined),
  acceptAnswer: vi.fn().mockResolvedValue(undefined),
  toggleFollowQuestion: vi.fn().mockResolvedValue(undefined),
  addAnswer: vi.fn().mockResolvedValue(undefined),
};

vi.mock("../../src/app/store/qa-context", () => ({
  useQA: () => ({ state: qaState, actions }),
}));

vi.mock("../../src/app/auth-context", () => ({
  useAuth: () => ({ user: { id: 1, name: "Alice", role: "user" } }),
}));

vi.mock("../../src/app/api/client", () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
  apiBase: "http://localhost:4000/api",
  tokenStore: {
    getAccess: () => "test-access-token",
  },
}));

import { QuestionDetailPage } from "../../src/app/pages/question-detail-page";

describe("question detail chat integration", () => {
  beforeEach(() => {
    apiRequestMock.mockReset();

    let postCount = 0;
    apiRequestMock.mockImplementation(async (path: string, options?: { method?: string; body?: string }) => {
      if (path === "/comments?targetType=question&targetId=1") return [];
      if (path === "/comments?targetType=answer&targetId=11") return [];
      if (path === "/question-chats/1/messages" && !options?.method) {
        return { items: [], onlineCount: 2 };
      }
      if (path === "/question-chats/1/messages" && options?.method === "POST") {
        postCount += 1;
        if (postCount === 1) {
          throw new Error("Request failed");
        }
        return {
          items: [
            {
              id: 101,
              questionId: 1,
              content: JSON.parse(options.body || "{}").content,
              createdAt: "2026-03-20T00:00:01.000Z",
              updatedAt: "2026-03-20T00:00:01.000Z",
              author: { id: 1, name: "Alice", avatar: "" },
            },
          ],
          onlineCount: 2,
        };
      }
      return [];
    });
  });

  it("keeps the failed chat draft and supports retry", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/question/1"]}>
        <Routes>
          <Route path="/question/:id" element={<QuestionDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByText("还没有讨论消息，先发第一条。");

    await user.type(screen.getByPlaceholderText("围绕当前问题发起实时讨论..."), "聊天室重试消息");
    await user.click(screen.getByRole("button", { name: "发送消息" }));

    expect(await screen.findByText("发送失败：Request failed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重试发送" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "重试发送" }));

    await waitFor(() => expect(screen.getByText("聊天室重试消息")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "重试发送" })).not.toBeInTheDocument();
  });
});
