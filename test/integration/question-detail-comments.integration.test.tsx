import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiRequestMock = vi.fn();
const refreshNotificationsMock = vi.fn().mockResolvedValue(undefined);
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
  refreshNotifications: refreshNotificationsMock,
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
}));

import { QuestionDetailPage } from "../../src/app/pages/question-detail-page";

describe("question detail comments integration", () => {
  beforeEach(() => {
    const questionComments: Array<{
      id: number;
      parentId: number | null;
      content: string;
      createdAt: string;
      author: { id: number; name: string; avatar: string };
      replies: Array<{
        id: number;
        parentId: number | null;
        content: string;
        createdAt: string;
        author: { id: number; name: string; avatar: string };
        replies: [];
      }>;
    }> = [
      {
        id: 21,
        parentId: null,
        content: "已有评论",
        createdAt: "2026-03-20T00:00:00.000Z",
        author: { id: 2, name: "Bob", avatar: "" },
        replies: [],
      },
    ];

    apiRequestMock.mockReset();
    refreshNotificationsMock.mockClear();
    actions.markQuestionViewed.mockClear();
    actions.markFollowSeen.mockClear();

    apiRequestMock.mockImplementation(async (path: string, options?: { method?: string; body?: string }) => {
      if (path === "/comments?targetType=question&targetId=1") {
        return JSON.parse(JSON.stringify(questionComments));
      }
      if (path === "/comments?targetType=answer&targetId=11") {
        return [];
      }
      if (path === "/comments" && options?.method === "POST") {
        const payload = JSON.parse(options.body || "{}");
        if (payload.parentId) {
          questionComments[0].replies.push({
            id: 22,
            parentId: payload.parentId,
            content: payload.content,
            createdAt: "2026-03-20T00:01:00.000Z",
            author: { id: 1, name: "Alice", avatar: "" },
            replies: [],
          });
        }
        return { id: 22 };
      }
      return [];
    });
  });

  it("supports markdown replies and refreshes notifications after submit", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/question/1"]}>
        <Routes>
          <Route path="/question/:id" element={<QuestionDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("已有评论")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "回复" }));
    await user.type(screen.getByPlaceholderText("写下回复内容，支持 Markdown..."), "**回复内容**");
    await user.click(screen.getByRole("button", { name: "发送回复" }));

    expect(await screen.findByText("回复内容")).toBeInTheDocument();
    await waitFor(() => expect(refreshNotificationsMock).toHaveBeenCalledTimes(1));
  });

  it("shows a visible error when reply submission fails", async () => {
    const user = userEvent.setup();

    apiRequestMock.mockImplementation(async (path: string, options?: { method?: string; body?: string }) => {
      if (path === "/comments?targetType=question&targetId=1") {
        return [
          {
            id: 21,
            parentId: null,
            content: "已有评论",
            createdAt: "2026-03-20T00:00:00.000Z",
            author: { id: 2, name: "Bob", avatar: "" },
            replies: [],
          },
        ];
      }
      if (path === "/comments?targetType=answer&targetId=11") {
        return [];
      }
      if (path === "/comments" && options?.method === "POST") {
        throw new Error("Request failed");
      }
      return [];
    });

    render(
      <MemoryRouter initialEntries={["/question/1"]}>
        <Routes>
          <Route path="/question/:id" element={<QuestionDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("已有评论")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "回复" }));
    await user.type(screen.getByPlaceholderText("写下回复内容，支持 Markdown..."), "失败回复");
    await user.click(screen.getByRole("button", { name: "发送回复" }));

    expect(await screen.findByText("发送失败：Request failed")).toBeInTheDocument();
  });
});
