import { Bell, BookMarked, Eye, MessageSquare, ThumbsUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Link, useSearchParams } from "react-router";
import { useQA } from "../store/qa-context";
import { findUser, selectFollowingQuestions } from "../store/selectors";

export function FollowingPage() {
  const { state } = useQA();
  const [params, setParams] = useSearchParams();
  const onlyNew = params.get("onlyNew") === "1";

  const allQuestions = selectFollowingQuestions(state);
  const questions = onlyNew ? allQuestions.filter((item) => item.hasNewAnswers) : allQuestions;

  return (
    <section>
      <header className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BookMarked className="h-7 w-7 text-blue-600" />
          <div>
            <h1 className="text-2xl font-semibold">关注的问题</h1>
            <p className="text-sm text-slate-600">新回答会在这里标记</p>
          </div>
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={onlyNew}
            onChange={(event) => {
              const next = new URLSearchParams(params);
              if (event.target.checked) next.set("onlyNew", "1");
              else next.delete("onlyNew");
              setParams(next, { replace: true });
            }}
          />
          仅看新回答
        </label>
      </header>

      {questions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">暂无关注问题或没有新回答。</div>
      ) : (
        <div className="space-y-4">
          {questions.map((question) => {
            const author = findUser(state, question.authorId);
            return (
              <article key={question.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                {question.hasNewAnswers && (
                  <span className="mb-3 inline-flex items-center rounded-full bg-blue-600 px-2 py-1 text-xs text-white">
                    <Bell className="mr-1 h-3 w-3" />有新回答
                  </span>
                )}
                <div className="flex gap-4">
                  <div className="w-20 shrink-0 text-center text-sm text-slate-500">
                    <div className="mb-2 inline-flex items-center gap-1"><ThumbsUp className="h-4 w-4" />{question.votes}</div>
                    <div className="mb-2 inline-flex items-center gap-1 text-green-600"><MessageSquare className="h-4 w-4" />{question.answers}</div>
                    <div className="inline-flex items-center gap-1"><Eye className="h-4 w-4" />{question.views}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link to={`/question/${question.id}`} className="text-lg font-semibold hover:text-blue-600">{question.title}</Link>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {question.tags.map((tag) => <span key={tag} className="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">{tag}</span>)}
                      <span className="ml-auto text-xs text-slate-500">{author?.name ?? "匿名"} · {formatDistanceToNow(new Date(question.updatedAt), { addSuffix: true, locale: zhCN })}</span>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}