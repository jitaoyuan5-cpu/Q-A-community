import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowBigDown, ArrowBigUp, ArrowLeft, Check, Eye, MessageSquare, PlayCircle, Share2, Sparkles } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { useQA } from "../store/qa-context";
import { answersByQuestion, findUser, isFollowing } from "../store/selectors";
import { apiBase, apiRequest, tokenStore } from "../api/client";
import { useAuth } from "../auth-context";
import { MarkdownRenderer } from "../components/content/markdown-renderer";
import { MarkdownEditor } from "../components/content/markdown-editor";
import { FavoriteButton } from "../components/content/favorite-button";
import { ReportButton } from "../components/content/report-button";
import { extractFirstCodeBlock, guessPlaygroundTemplate } from "../utils/content";

type CommentNode = {
  id: number;
  parentId: number | null;
  content: string;
  createdAt: string;
  author: { id: number; name: string; avatar: string };
  replies: CommentNode[];
};

type CommentTarget = {
  targetType: "question" | "answer";
  targetId: number;
  threadKey: string;
};

const toNumericId = (raw: string) => Number(String(raw).replace(/\D/g, ""));

export function QuestionDetailPage() {
  const { id } = useParams();
  const { state, actions } = useQA();
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [detailLoadState, setDetailLoadState] = useState<"idle" | "loading" | "error">("idle");
  const viewedQuestionIdsRef = useRef<Set<string>>(new Set());

  const [questionComments, setQuestionComments] = useState<CommentNode[]>([]);
  const [answerComments, setAnswerComments] = useState<Record<string, CommentNode[]>>({});
  const [newQuestionComment, setNewQuestionComment] = useState("");
  const [answerCommentDraft, setAnswerCommentDraft] = useState<Record<string, string>>({});
  const [replyingToId, setReplyingToId] = useState<number | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({});
  const [submittingKey, setSubmittingKey] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [chatItems, setChatItems] = useState<any[]>([]);
  const [chatText, setChatText] = useState("");
  const [chatOnlineCount, setChatOnlineCount] = useState(0);
  const [chatPending, setChatPending] = useState(false);
  const [chatError, setChatError] = useState("");
  const chatSocketRef = useRef<WebSocket | null>(null);

  const question = state.questions.find((item) => item.id === id);
  const questionTargetId = toNumericId(question?.id || "");
  const answers = useMemo(() => {
    if (!id) return [];
    return answersByQuestion(state, id).sort((a, b) => {
      if (a.isAccepted && !b.isAccepted) return -1;
      if (!a.isAccepted && b.isAccepted) return 1;
      return b.votes - a.votes;
    });
  }, [id, state]);

  const loadComments = async ({ targetType, targetId, threadKey }: CommentTarget) => {
    const rows = await apiRequest<CommentNode[]>(`/comments?targetType=${targetType}&targetId=${targetId}`);
    if (targetType === "question") {
      setQuestionComments(rows);
      return;
    }
    setAnswerComments((prev) => ({ ...prev, [threadKey]: rows }));
  };

  const submitComment = async ({
    targetType,
    targetId,
    threadKey,
    content: draft,
    parentId,
  }: CommentTarget & { content: string; parentId?: number | null }) => {
    const text = draft.trim();
    if (!text) return false;
    await apiRequest("/comments", {
      method: "POST",
      body: JSON.stringify({ targetType, targetId, content: text, parentId: parentId ?? null }),
    });
    await loadComments({ targetType, targetId, threadKey });
    await actions.refreshNotifications().catch(() => undefined);
    return true;
  };

  const setFormError = (key: string, message?: string) => {
    setFormErrors((prev) => {
      if (!message) {
        if (!(key in prev)) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: message };
    });
  };

  useEffect(() => {
    if (!id || viewedQuestionIdsRef.current.has(id)) return;
    viewedQuestionIdsRef.current.add(id);
    setDetailLoadState("loading");
    actions
      .markQuestionViewed(id)
      .then(() => setDetailLoadState("idle"))
      .catch(() => setDetailLoadState("error"));
    actions.markFollowSeen(id).catch(() => undefined);
  }, [actions, id]);

  useEffect(() => {
    if (!question) return;
    const targetId = toNumericId(question.id);
    if (!targetId) return;
    loadComments({ targetType: "question", targetId, threadKey: question.id }).catch(() => setQuestionComments([]));
  }, [question?.id]);

  useEffect(() => {
    if (!answers.length) {
      setAnswerComments({});
      return;
    }
    answers.forEach((answer) => {
      const targetId = toNumericId(answer.id);
      if (!targetId) return;
      loadComments({ targetType: "answer", targetId, threadKey: answer.id }).catch(() =>
        setAnswerComments((prev) => ({ ...prev, [answer.id]: [] })),
      );
    });
  }, [answers.map((item) => item.id).join(",")]);

  useEffect(() => {
    if (!questionTargetId) return;
    apiRequest<{ items: any[]; onlineCount: number }>(`/question-chats/${questionTargetId}/messages`)
      .then((result) => {
        setChatItems(Array.isArray(result?.items) ? result.items : []);
        setChatOnlineCount(Number(result?.onlineCount || 0));
      })
      .catch(() => {
        setChatItems([]);
        setChatOnlineCount(0);
      });
  }, [questionTargetId]);

  useEffect(() => {
    if (import.meta.env.MODE === "test" || !questionTargetId || !user) return;
    const token = tokenStore.getAccess();
    if (!token) return;
    const socket = new WebSocket(`${apiBase.replace(/^http/, "ws").replace(/\/api$/, "")}/ws/questions/${questionTargetId}/chat?token=${encodeURIComponent(token)}`);
    chatSocketRef.current = socket;

    socket.addEventListener("message", (event) => {
      const payload = JSON.parse(String(event.data || "{}"));
      if (payload.type === "presence") {
        setChatOnlineCount(Number(payload.onlineCount || 0));
      }
      if (payload.type === "message" && payload.message) {
        setChatItems((prev) => (prev.some((item) => item.id === payload.message.id) ? prev : [...prev, payload.message]));
      }
    });
    socket.addEventListener("close", () => {
      chatSocketRef.current = null;
    });

    return () => {
      socket.close();
      chatSocketRef.current = null;
    };
  }, [questionTargetId, user?.id]);

  if (!question && detailLoadState === "loading") {
    return (
      <div className="app-panel rounded-[1.8rem] px-6 py-12 text-center text-slate-500">
        正在加载问题详情...
      </div>
    );
  }

  if (!question) {
    return (
      <div className="app-panel rounded-[1.8rem] px-6 py-12 text-center">
        <h1 className="app-display mb-3 text-3xl font-semibold text-slate-900">{detailLoadState === "error" ? "加载失败或问题不存在" : "问题不存在"}</h1>
        <Link to="/" className="font-medium text-[var(--primary)] hover:underline">返回首页</Link>
      </div>
    );
  }

  const author = findUser(state, question.authorId);
  const followed = isFollowing(state, question.id);
  const canInteract = Boolean(user);
  const questionComposerKey = "question-root";
  const canonicalUrl = `${window.location.origin}/question/${question.id}`;
  const questionCodeSnippet = extractFirstCodeBlock(question.content);

  const renderCommentNode = (comment: CommentNode, target: CommentTarget, depth = 0): ReactNode => {
    const isReplying = replyingToId === comment.id;
    const replyKey = `reply-${comment.id}`;
    const replyDraft = replyDrafts[comment.id] || "";
    const isSubmittingReply = submittingKey === replyKey;

    return (
      <div key={comment.id} className={depth > 0 ? "mt-3 border-l border-[var(--line)] pl-4" : ""}>
        <div className={`rounded-[1.2rem] border px-4 py-4 ${depth > 0 ? "border-slate-200 bg-white/70" : "border-slate-200 bg-white/82"}`}>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="font-medium text-slate-800">{comment.author.name}</span>
            <span>{new Date(comment.createdAt).toLocaleString()}</span>
          </div>
          <MarkdownRenderer content={comment.content} className={depth > 0 ? "text-xs" : "text-sm"} />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {user ? (
              <button
                type="button"
                className="app-button-ghost rounded-full px-3 py-1.5 text-xs"
                onClick={() => setReplyingToId((current) => (current === comment.id ? null : comment.id))}
              >
                {isReplying ? "取消回复" : "回复"}
              </button>
            ) : null}
            {user ? <ReportButton targetType="comment" targetId={String(comment.id)} compact /> : null}
          </div>
          {user && isReplying ? (
            <form
              className="mt-3"
              onSubmit={async (event) => {
                event.preventDefault();
                setFormError(replyKey);
                setSubmittingKey(replyKey);
                try {
                  const created = await submitComment({ ...target, content: replyDraft, parentId: comment.id });
                  if (created) {
                    setReplyDrafts((prev) => ({ ...prev, [comment.id]: "" }));
                    setReplyingToId(null);
                  }
                } catch (err) {
                  setFormError(replyKey, `发送失败：${(err as Error).message}`);
                } finally {
                  setSubmittingKey(null);
                }
              }}
            >
              <MarkdownEditor
                value={replyDraft}
                onChange={(value) => {
                  setFormError(replyKey);
                  setReplyDrafts((prev) => ({ ...prev, [comment.id]: value }));
                }}
                placeholder="写下回复内容，支持 Markdown..."
                minHeightClass="min-h-24"
              />
              <div className="mt-2 flex justify-end gap-2">
                <button type="button" className="app-button-ghost rounded-[0.9rem] px-3 py-1.5 text-xs" onClick={() => setReplyingToId(null)}>
                  取消
                </button>
                <button
                  type="submit"
                  disabled={!replyDraft.trim() || isSubmittingReply}
                  className="app-button-primary rounded-[0.9rem] px-3 py-1.5 text-xs text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmittingReply ? "发送中..." : "发送回复"}
                </button>
              </div>
              {formErrors[replyKey] ? <p className="mt-2 text-xs text-red-600">{formErrors[replyKey]}</p> : null}
            </form>
          ) : null}
        </div>
        {comment.replies.map((reply) => renderCommentNode(reply, target, depth + 1))}
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <Link to="/" className="app-button-ghost inline-flex items-center rounded-full px-4 py-2 text-sm text-slate-700">
        <ArrowLeft className="mr-1 h-4 w-4" />返回问题列表
      </Link>

      <section className="grid gap-5 lg:grid-cols-[132px_minmax(0,1fr)]">
        <aside className="app-panel-dark rounded-[2rem] p-4">
          <p className="app-kicker !text-[#d8c6a3]">Thread stats</p>
          <div className="mt-4 space-y-3 text-center">
            <div className="rounded-[1.2rem] border border-white/10 bg-white/10 px-3 py-3">
              <div className="mx-auto mb-1 flex h-9 w-9 items-center justify-center rounded-full bg-white/10">
                <ArrowBigUp className="h-5 w-5 text-[#f0c06f]" />
              </div>
              <p className="app-display text-2xl font-semibold text-[#f8f1e3]">{question.votes}</p>
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-300">votes</p>
            </div>
            <div className="rounded-[1.2rem] border border-white/10 bg-white/10 px-3 py-3">
              <div className="mx-auto mb-1 flex h-9 w-9 items-center justify-center rounded-full bg-white/10">
                <MessageSquare className="h-4 w-4 text-[#f0c06f]" />
              </div>
              <p className="app-display text-2xl font-semibold text-[#f8f1e3]">{question.answers}</p>
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-300">answers</p>
            </div>
            <div className="rounded-[1.2rem] border border-white/10 bg-white/10 px-3 py-3">
              <div className="mx-auto mb-1 flex h-9 w-9 items-center justify-center rounded-full bg-white/10">
                <Eye className="h-4 w-4 text-[#f0c06f]" />
              </div>
              <p className="app-display text-2xl font-semibold text-[#f8f1e3]">{question.views}</p>
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-300">views</p>
            </div>
          </div>
        </aside>

        <article className="app-panel app-mesh rounded-[2rem] px-6 py-6 lg:px-7">
          <p className="app-kicker">Question dossier</p>
          <h1 className="app-display mt-3 text-[2.6rem] font-semibold leading-tight text-slate-900">{question.title}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-500">
            <span className="inline-flex items-center gap-1"><Eye className="h-4 w-4" />{question.views} 浏览</span>
            <span className="inline-flex items-center gap-1"><MessageSquare className="h-4 w-4" />{question.answers} 回答</span>
            <span>{formatDistanceToNow(new Date(question.createdAt), { addSuffix: true, locale: zhCN })}</span>
            <span className="font-medium text-slate-700">{author?.name ?? "匿名"}</span>
          </div>

          <div className="mt-5 rounded-[1.6rem] border border-white/70 bg-white/74 p-5">
            <MarkdownRenderer content={question.content} />
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {question.tags.map((tag) => <span key={tag} className="app-badge">{tag}</span>)}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            {canInteract ? (
              <>
                <button aria-label="赞成问题" onClick={() => actions.voteQuestion(question.id, 1)} className="app-button-ghost inline-flex items-center rounded-full px-3 py-2 text-sm text-slate-700">
                  <ArrowBigUp className="mr-1 h-4 w-4" />赞成
                </button>
                <button aria-label="反对问题" onClick={() => actions.voteQuestion(question.id, -1)} className="app-button-ghost inline-flex items-center rounded-full px-3 py-2 text-sm text-slate-700">
                  <ArrowBigDown className="mr-1 h-4 w-4" />反对
                </button>
                <button aria-label={followed ? "取消关注问题" : "关注问题"} onClick={() => actions.toggleFollowQuestion(question.id)} className={`rounded-full px-4 py-2 text-sm ${followed ? "app-button-ghost text-slate-700" : "app-button-primary text-white"}`}>
                  {followed ? "已关注" : "关注问题"}
                </button>
              </>
            ) : (
              <span className="text-xs text-slate-500">登录后可投票、关注问题和采纳回答</span>
            )}
            <FavoriteButton targetType="question" targetId={question.id} active={Boolean(question.isFavorited)} />
            <Link
              to={`/assistant?q=${encodeURIComponent(`${question.title}\n${question.content.slice(0, 400)}`)}`}
              className="app-button-ghost inline-flex items-center rounded-full px-3 py-2 text-xs text-slate-700"
            >
              <Sparkles className="mr-1 h-3.5 w-3.5 text-[var(--accent)]" />
              交给 AI 助手
            </Link>
            {questionCodeSnippet ? (
              <Link
                to={`/playground?template=${guessPlaygroundTemplate(questionCodeSnippet)}&title=${encodeURIComponent(question.title)}&code=${encodeURIComponent(questionCodeSnippet)}`}
                className="app-button-ghost inline-flex items-center rounded-full px-3 py-2 text-xs text-slate-700"
              >
                <PlayCircle className="mr-1 h-3.5 w-3.5" />
                在 Playground 打开代码
              </Link>
            ) : null}
            <button
              type="button"
              onClick={async () => {
                if (navigator.share) {
                  await navigator.share({ title: question.title, url: canonicalUrl }).catch(() => undefined);
                  return;
                }
                await navigator.clipboard.writeText(canonicalUrl);
              }}
              className="app-button-ghost inline-flex items-center rounded-full px-3 py-2 text-xs text-slate-700"
            >
              <Share2 className="mr-1 h-3.5 w-3.5" />
              分享
            </button>
            {user && <ReportButton targetType="question" targetId={question.id} />}
          </div>
        </article>
      </section>

      <section className="app-panel-dark rounded-[2rem] p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="app-kicker !text-[#d8c6a3]">Live room</p>
            <h3 className="app-display mt-2 text-3xl font-semibold text-[#f8f1e3]">问题讨论</h3>
          </div>
          <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs text-slate-200">在线 {chatOnlineCount} 人</span>
        </div>
        <div className="space-y-3">
          {chatItems.length ? (
            chatItems.map((item) => (
              <div key={item.id} className="rounded-[1.3rem] border border-white/10 bg-black/10 p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-[#f8f1e3]">{item.author.name}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-300">{new Date(item.createdAt).toLocaleString()}</span>
                    {user ? <ReportButton targetType="chat_message" targetId={String(item.id)} compact /> : null}
                  </div>
                </div>
                <MarkdownRenderer content={item.content} className="text-sm text-slate-100" />
              </div>
            ))
          ) : (
            <p className="rounded-[1.3rem] border border-dashed border-white/16 bg-black/10 p-4 text-sm text-slate-300">还没有讨论消息，先发第一条。</p>
          )}
        </div>
        {user ? (
          <form
            className="mt-4"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!questionTargetId || !chatText.trim()) return;
              setChatPending(true);
              setChatError("");
              try {
                const result = await apiRequest<{ items: any[]; onlineCount: number }>(`/question-chats/${questionTargetId}/messages`, {
                  method: "POST",
                  body: JSON.stringify({ content: chatText }),
                });
                setChatItems(Array.isArray(result?.items) ? result.items : []);
                setChatOnlineCount(Number(result?.onlineCount || 0));
                setChatText("");
              } catch (err) {
                setChatError((err as Error).message);
              } finally {
                setChatPending(false);
              }
            }}
          >
            <MarkdownEditor value={chatText} onChange={setChatText} placeholder="围绕当前问题发起实时讨论..." minHeightClass="min-h-24" />
            <div className="mt-2 flex justify-end">
              <button type="submit" disabled={!chatText.trim() || chatPending} className="app-button-primary rounded-[0.9rem] px-3 py-1.5 text-xs text-white disabled:cursor-not-allowed disabled:opacity-60">
                {chatPending ? "发送中..." : "发送消息"}
              </button>
            </div>
            {chatError ? <p className="mt-2 text-xs text-red-300">{chatError}</p> : null}
          </form>
        ) : <p className="mt-3 text-xs text-slate-300">登录后可加入实时讨论。</p>}
      </section>

      <section className="app-panel rounded-[2rem] p-5">
        <div className="mb-4">
          <p className="app-kicker">Margin notes</p>
          <h3 className="app-display mt-2 text-3xl font-semibold text-slate-900">问题评论</h3>
        </div>
        <div className="space-y-3">
          {questionComments.length > 0 ? questionComments.map((comment) => renderCommentNode(comment, { targetType: "question", targetId: questionTargetId, threadKey: question.id })) : (
            <p className="rounded-[1.3rem] border border-dashed border-slate-300 bg-white/60 p-4 text-sm text-slate-500">还没有评论，来留下第一个观点。</p>
          )}
        </div>
        {user ? (
          <form
            className="mt-4"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!questionTargetId) return;
              setFormError(questionComposerKey);
              setSubmittingKey(questionComposerKey);
              try {
                const created = await submitComment({
                  targetType: "question",
                  targetId: questionTargetId,
                  threadKey: question.id,
                  content: newQuestionComment,
                });
                if (created) setNewQuestionComment("");
              } catch (err) {
                setFormError(questionComposerKey, `发送失败：${(err as Error).message}`);
              } finally {
                setSubmittingKey(null);
              }
            }}
          >
            <MarkdownEditor
              value={newQuestionComment}
              onChange={(value) => {
                setFormError(questionComposerKey);
                setNewQuestionComment(value);
              }}
              placeholder="写下评论，支持 Markdown..."
              minHeightClass="min-h-24"
            />
            <div className="mt-2 flex justify-end">
              <button
                type="submit"
                disabled={!newQuestionComment.trim() || submittingKey === questionComposerKey}
                className="app-button-primary rounded-[0.9rem] px-3 py-1.5 text-xs text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submittingKey === questionComposerKey ? "发送中..." : "发送评论"}
              </button>
            </div>
            {formErrors[questionComposerKey] ? <p className="mt-2 text-xs text-red-600">{formErrors[questionComposerKey]}</p> : null}
          </form>
        ) : <p className="mt-3 text-xs text-slate-500">登录后可评论</p>}
      </section>

      <section className="space-y-4">
        <div className="app-panel app-mesh rounded-[2rem] px-6 py-5">
          <p className="app-kicker">Answers</p>
          <h2 className="app-display mt-2 text-3xl font-semibold text-slate-900">{answers.length} 个回答</h2>
        </div>
        <div className="space-y-4">
          {answers.map((answer) => {
            const answerAuthor = findUser(state, answer.authorId);
            const answerTargetId = toNumericId(answer.id);
            const answerComposerKey = `answer-root-${answer.id}`;
            return (
              <article key={answer.id} className={`app-panel rounded-[2rem] p-5 ${answer.isAccepted ? "border-emerald-300 bg-emerald-50/50" : ""}`}>
                <div className="grid gap-4 md:grid-cols-[110px_minmax(0,1fr)]">
                  <div className="space-y-2">
                    <div className="rounded-[1.2rem] border border-slate-200 bg-white/70 px-3 py-3 text-center">
                      <div className="mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-700">
                        <ArrowBigUp className="h-4 w-4" />
                      </div>
                      <p className="text-lg font-semibold text-slate-900">{answer.votes}</p>
                      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">votes</p>
                    </div>
                    <div className="flex flex-wrap gap-2 md:flex-col">
                      {canInteract ? (
                        <button aria-label="赞成回答" onClick={() => actions.voteAnswer(answer.id, 1)} className="app-button-ghost inline-flex items-center justify-center rounded-full px-3 py-2 text-xs text-slate-700">
                          <ArrowBigUp className="mr-1 h-4 w-4" />赞成
                        </button>
                      ) : null}
                      {canInteract ? (
                        <button aria-label="反对回答" onClick={() => actions.voteAnswer(answer.id, -1)} className="app-button-ghost inline-flex items-center justify-center rounded-full px-3 py-2 text-xs text-slate-700">
                          <ArrowBigDown className="mr-1 h-4 w-4" />反对
                        </button>
                      ) : null}
                      {canInteract ? (
                        <button aria-label="采纳此答案" onClick={() => actions.acceptAnswer(answer.id)} className={`inline-flex items-center justify-center rounded-full px-3 py-2 text-xs ${answer.isAccepted ? "app-button-primary text-white" : "app-button-ghost text-slate-700"}`}>
                          <Check className="mr-1 h-4 w-4" />
                          {answer.isAccepted ? "已采纳" : "采纳"}
                        </button>
                      ) : answer.isAccepted ? (
                        <span className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-3 py-2 text-xs text-white">
                          <Check className="mr-1 h-4 w-4" />已采纳
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="min-w-0">
                    {answer.isAccepted && <span className="app-badge mb-3">已采纳回答</span>}
                    <MarkdownRenderer content={answer.content} />
                    <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-medium text-slate-700">{answerAuthor?.name ?? "匿名"}</span>
                      <span>{formatDistanceToNow(new Date(answer.createdAt), { addSuffix: true, locale: zhCN })}</span>
                      {user ? <ReportButton targetType="answer" targetId={answer.id} compact /> : null}
                    </div>

                    <div className="mt-5 rounded-[1.5rem] border border-slate-200 bg-white/62 p-4">
                      <div className="mb-3">
                        <p className="app-kicker">Answer comments</p>
                        <p className="app-display mt-2 text-2xl font-semibold text-slate-900">回答评论</p>
                      </div>
                      <div className="space-y-3">
                        {(answerComments[answer.id] || []).length > 0 ? (answerComments[answer.id] || []).map((comment) => renderCommentNode(comment, { targetType: "answer", targetId: answerTargetId, threadKey: answer.id })) : (
                          <p className="rounded-[1.2rem] border border-dashed border-slate-300 bg-white/70 p-4 text-sm text-slate-500">还没有评论，来补充细节或提出追问。</p>
                        )}
                      </div>
                      {user ? (
                        <form
                          className="mt-4"
                          onSubmit={async (event) => {
                            event.preventDefault();
                            if (!answerTargetId) return;
                            setFormError(answerComposerKey);
                            setSubmittingKey(answerComposerKey);
                            try {
                              const created = await submitComment({
                                targetType: "answer",
                                targetId: answerTargetId,
                                threadKey: answer.id,
                                content: answerCommentDraft[answer.id] || "",
                              });
                              if (created) {
                                setAnswerCommentDraft((prev) => ({ ...prev, [answer.id]: "" }));
                              }
                            } catch (err) {
                              setFormError(answerComposerKey, `发送失败：${(err as Error).message}`);
                            } finally {
                              setSubmittingKey(null);
                            }
                          }}
                        >
                          <MarkdownEditor
                            value={answerCommentDraft[answer.id] || ""}
                            onChange={(value) => {
                              setFormError(answerComposerKey);
                              setAnswerCommentDraft((prev) => ({ ...prev, [answer.id]: value }));
                            }}
                            placeholder="写下评论，支持 Markdown..."
                            minHeightClass="min-h-24"
                          />
                          <div className="mt-2 flex justify-end">
                            <button
                              type="submit"
                              disabled={!(answerCommentDraft[answer.id] || "").trim() || submittingKey === answerComposerKey}
                              className="app-button-primary rounded-[0.9rem] px-3 py-1.5 text-xs text-white disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {submittingKey === answerComposerKey ? "发送中..." : "发送评论"}
                            </button>
                          </div>
                          {formErrors[answerComposerKey] ? <p className="mt-2 text-xs text-red-600">{formErrors[answerComposerKey]}</p> : null}
                        </form>
                      ) : <p className="mt-3 text-xs text-slate-500">登录后可评论</p>}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="app-panel-dark rounded-[2rem] p-5">
        <div className="mb-4">
          <p className="app-kicker !text-[#d8c6a3]">Reply dock</p>
          <h3 className="app-display mt-2 text-3xl font-semibold text-[#f8f1e3]">发布回答</h3>
        </div>
        {user ? (
          <>
            <div className="mb-3">
              <MarkdownEditor value={content} onChange={setContent} placeholder="请输入你的回答" minHeightClass="min-h-36" />
            </div>
            <button
              onClick={async () => {
                const text = content.trim();
                if (!text) return;
                await actions.addAnswer(question.id, text);
                setContent("");
              }}
              disabled={!content.trim()}
              className="app-button-primary rounded-[1rem] px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              发布回答
            </button>
          </>
        ) : (
          <p className="text-sm text-slate-300">登录后可发布回答</p>
        )}
      </section>
    </div>
  );
}
