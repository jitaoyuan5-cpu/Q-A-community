import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowBigDown, ArrowBigUp, ArrowLeft, Check, Eye, MessageSquare, Share2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { useQA } from "../store/qa-context";
import { answersByQuestion, findUser, isFollowing } from "../store/selectors";
import { apiRequest } from "../api/client";
import { useAuth } from "../auth-context";
import { MarkdownRenderer } from "../components/content/markdown-renderer";
import { MarkdownEditor } from "../components/content/markdown-editor";
import { FavoriteButton } from "../components/content/favorite-button";
import { ReportButton } from "../components/content/report-button";

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

  const question = state.questions.find((item) => item.id === id);
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

  if (!question && detailLoadState === "loading") {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
        正在加载问题详情...
      </div>
    );
  }

  if (!question) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <h1 className="mb-3 text-2xl font-semibold">{detailLoadState === "error" ? "加载失败或问题不存在" : "问题不存在"}</h1>
        <Link to="/" className="text-blue-600 hover:underline">返回首页</Link>
      </div>
    );
  }

  const author = findUser(state, question.authorId);
  const followed = isFollowing(state, question.id);
  const canInteract = Boolean(user);
  const questionTargetId = toNumericId(question.id);
  const questionComposerKey = "question-root";
  const canonicalUrl = `${window.location.origin}/question/${question.id}`;

  const renderCommentNode = (comment: CommentNode, target: CommentTarget, depth = 0): ReactNode => {
    const isReplying = replyingToId === comment.id;
    const replyKey = `reply-${comment.id}`;
    const replyDraft = replyDrafts[comment.id] || "";
    const isSubmittingReply = submittingKey === replyKey;

    return (
      <div key={comment.id} className={`${depth > 0 ? "ml-3 mt-2 rounded-md border border-slate-100 bg-white p-2" : "rounded-md border border-slate-100 bg-slate-50 p-3 text-sm"}`}>
        <p className="mb-2 text-xs text-slate-500">{depth > 0 ? `↳ ${comment.author.name}` : comment.author.name}</p>
        <MarkdownRenderer content={comment.content} className={depth > 0 ? "text-xs" : "text-sm"} />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {user ? (
            <button
              type="button"
              className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600"
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
              <button type="button" className="rounded-md border border-slate-200 px-3 py-1.5 text-xs" onClick={() => setReplyingToId(null)}>
                取消
              </button>
              <button
                type="submit"
                disabled={!replyDraft.trim() || isSubmittingReply}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-xs text-white disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {isSubmittingReply ? "发送中..." : "发送回复"}
              </button>
            </div>
            {formErrors[replyKey] ? <p className="mt-2 text-xs text-red-600">{formErrors[replyKey]}</p> : null}
          </form>
        ) : null}
        {comment.replies.map((reply) => renderCommentNode(reply, target, depth + 1))}
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-5xl">
      <Link to="/" className="mb-4 inline-flex items-center text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft className="mr-1 h-4 w-4" />返回问题列表
      </Link>

      <article className="mb-5 rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-4 md:flex-row">
          <div className="flex md:w-20 md:flex-col md:items-center md:justify-start">
            {canInteract ? (
              <button aria-label="赞成问题" onClick={() => actions.voteQuestion(question.id, 1)} className="rounded-md p-1 text-slate-500 hover:text-orange-600"><ArrowBigUp className="h-8 w-8" /></button>
            ) : (
              <span className="rounded-md p-1 text-slate-300"><ArrowBigUp className="h-8 w-8" /></span>
            )}
            <span className="px-2 text-xl font-semibold md:px-0">{question.votes}</span>
            {canInteract ? (
              <button aria-label="反对问题" onClick={() => actions.voteQuestion(question.id, -1)} className="rounded-md p-1 text-slate-500 hover:text-blue-600"><ArrowBigDown className="h-8 w-8" /></button>
            ) : (
              <span className="rounded-md p-1 text-slate-300"><ArrowBigDown className="h-8 w-8" /></span>
            )}
          </div>

          <div className="flex-1">
            <h1 className="mb-3 text-2xl font-semibold">{question.title}</h1>
            <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-slate-500">
              <span className="inline-flex items-center gap-1"><Eye className="h-4 w-4" />{question.views} 浏览</span>
              <span className="inline-flex items-center gap-1"><MessageSquare className="h-4 w-4" />{question.answers} 回答</span>
              <span>{formatDistanceToNow(new Date(question.createdAt), { addSuffix: true, locale: zhCN })}</span>
              {canInteract ? (
                <button aria-label={followed ? "取消关注问题" : "关注问题"} onClick={() => actions.toggleFollowQuestion(question.id)} className={`ml-auto rounded-lg px-3 py-1 text-xs ${followed ? "bg-slate-200 text-slate-700" : "bg-blue-600 text-white"}`}>
                  {followed ? "已关注" : "关注问题"}
                </button>
              ) : (
                <span className="ml-auto text-xs text-slate-500">登录后可关注问题</span>
              )}
              <FavoriteButton targetType="question" targetId={question.id} active={Boolean(question.isFavorited)} />
              <button
                type="button"
                onClick={async () => {
                  if (navigator.share) {
                    await navigator.share({ title: question.title, url: canonicalUrl }).catch(() => undefined);
                    return;
                  }
                  await navigator.clipboard.writeText(canonicalUrl);
                }}
                className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-1 text-xs text-slate-600"
              >
                <Share2 className="mr-1 h-3.5 w-3.5" />
                分享
              </button>
              {user && <ReportButton targetType="question" targetId={question.id} />}
            </div>
            <MarkdownRenderer content={question.content} />
            <div className="mt-4 flex flex-wrap gap-2">
              {question.tags.map((tag) => <span key={tag} className="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">{tag}</span>)}
            </div>
            <div className="mt-4 text-sm text-slate-600">{author?.name ?? "匿名"} · 声望 {author?.reputation ?? 0}</div>
            {!canInteract && <p className="mt-3 text-xs text-slate-500">登录后可投票、关注问题和采纳回答</p>}
          </div>
        </div>
      </article>

      <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="mb-3 text-lg font-semibold">问题评论</h3>
        <div className="space-y-2">
          {questionComments.length > 0 ? questionComments.map((comment) => renderCommentNode(comment, { targetType: "question", targetId: questionTargetId, threadKey: question.id })) : (
            <p className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">还没有评论，来留下第一个观点。</p>
          )}
        </div>
        {user ? (
          <form
            className="mt-3"
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
                className="rounded-md bg-blue-600 px-3 py-1.5 text-xs text-white disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {submittingKey === questionComposerKey ? "发送中..." : "发送评论"}
              </button>
            </div>
            {formErrors[questionComposerKey] ? <p className="mt-2 text-xs text-red-600">{formErrors[questionComposerKey]}</p> : null}
          </form>
        ) : <p className="text-xs text-slate-500">登录后可评论</p>}
      </section>

      <section className="mb-5">
        <h2 className="mb-3 text-xl font-semibold">{answers.length} 个回答</h2>
        <div className="space-y-4">
          {answers.map((answer) => {
            const answerAuthor = findUser(state, answer.authorId);
            const answerTargetId = toNumericId(answer.id);
            const answerComposerKey = `answer-root-${answer.id}`;
            return (
              <article key={answer.id} className={`rounded-2xl border p-5 ${answer.isAccepted ? "border-green-400 bg-green-50/40" : "border-slate-200 bg-white"}`}>
                <div className="flex flex-col gap-4 md:flex-row">
                  <div className="flex md:w-20 md:flex-col md:items-center">
                    {canInteract ? (
                      <button aria-label="赞成回答" onClick={() => actions.voteAnswer(answer.id, 1)} className="rounded-md p-1 text-slate-500 hover:text-orange-600"><ArrowBigUp className="h-7 w-7" /></button>
                    ) : (
                      <span className="rounded-md p-1 text-slate-300"><ArrowBigUp className="h-7 w-7" /></span>
                    )}
                    <span className="px-2 text-lg font-semibold md:px-0">{answer.votes}</span>
                    {canInteract ? (
                      <button aria-label="反对回答" onClick={() => actions.voteAnswer(answer.id, -1)} className="rounded-md p-1 text-slate-500 hover:text-blue-600"><ArrowBigDown className="h-7 w-7" /></button>
                    ) : (
                      <span className="rounded-md p-1 text-slate-300"><ArrowBigDown className="h-7 w-7" /></span>
                    )}
                    {canInteract ? (
                      <button aria-label="采纳此答案" onClick={() => actions.acceptAnswer(answer.id)} className={`ml-2 rounded-md p-1 md:ml-0 ${answer.isAccepted ? "text-green-600" : "text-slate-400 hover:text-green-600"}`} title="采纳此答案">
                        <Check className="h-6 w-6" />
                      </button>
                    ) : (
                      <span className={`ml-2 rounded-md p-1 md:ml-0 ${answer.isAccepted ? "text-green-600" : "text-slate-300"}`}>
                        <Check className="h-6 w-6" />
                      </span>
                    )}
                  </div>
                  <div className="flex-1">
                    {answer.isAccepted && <span className="mb-2 inline-flex items-center rounded-full bg-green-600 px-2 py-1 text-xs text-white"><Check className="mr-1 h-3 w-3" />已采纳</span>}
                    <MarkdownRenderer content={answer.content} />
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span>{answerAuthor?.name ?? "匿名"} · {formatDistanceToNow(new Date(answer.createdAt), { addSuffix: true, locale: zhCN })}</span>
                      {user && <ReportButton targetType="answer" targetId={answer.id} compact />}
                    </div>

                    <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-3">
                      <p className="mb-2 text-sm font-medium">回答评论</p>
                      <div className="space-y-2">
                        {(answerComments[answer.id] || []).length > 0 ? (answerComments[answer.id] || []).map((comment) => renderCommentNode(comment, { targetType: "answer", targetId: answerTargetId, threadKey: answer.id })) : (
                          <p className="rounded-md border border-dashed border-slate-200 bg-white p-3 text-sm text-slate-500">还没有评论，来补充细节或提出追问。</p>
                        )}
                      </div>
                      {user ? (
                        <form
                          className="mt-3"
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
                              className="rounded-md bg-blue-600 px-3 py-1.5 text-xs text-white disabled:cursor-not-allowed disabled:bg-slate-400"
                            >
                              {submittingKey === answerComposerKey ? "发送中..." : "发送评论"}
                            </button>
                          </div>
                          {formErrors[answerComposerKey] ? <p className="mt-2 text-xs text-red-600">{formErrors[answerComposerKey]}</p> : null}
                        </form>
                      ) : <p className="text-xs text-slate-500">登录后可评论</p>}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="mb-3 text-lg font-semibold">发布回答</h3>
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
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              发布回答
            </button>
          </>
        ) : (
          <p className="text-sm text-slate-500">登录后可发布回答</p>
        )}
      </section>
    </div>
  );
}
