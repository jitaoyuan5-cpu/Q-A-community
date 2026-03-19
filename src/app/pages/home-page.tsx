import { useMemo } from "react";
import { Link, useSearchParams } from "react-router";
import { Eye, MessageSquare, ThumbsUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { RightSidebar } from "../components/layout/right-sidebar";
import { useQA } from "../store/qa-context";
import { findUser, selectQuestionsForHome, type HomeTab } from "../store/selectors";

const tabs: HomeTab[] = ["newest", "hot", "unanswered"];
const tabLabel: Record<HomeTab, string> = { newest: "最新", hot: "热门", unanswered: "未回答" };

export function HomePage() {
  const { state } = useQA();
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as HomeTab) || "newest";
  const keyword = params.get("q") || "";

  const questions = useMemo(
    () => selectQuestionsForHome(state, tabs.includes(tab) ? tab : "newest", keyword),
    [keyword, state, tab],
  );

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div>
        <div className="mb-4 flex flex-wrap gap-2">
          {tabs.map((item) => (
            <button
              key={item}
              onClick={() => {
                const next = new URLSearchParams(params);
                next.set("tab", item);
                setParams(next, { replace: true });
              }}
              className={`rounded-full px-4 py-2 text-sm ${tab === item ? "bg-blue-600 text-white" : "bg-white text-slate-700 border border-slate-200"}`}
            >
              {tabLabel[item]}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {questions.map((question) => {
            const author = findUser(state, question.authorId);
            return (
              <article key={question.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex gap-4">
                  <div className="w-20 shrink-0 text-center text-sm text-slate-500">
                    <div className="mb-2 flex items-center justify-center gap-1">
                      <ThumbsUp className="h-4 w-4" />
                      <span>{question.votes}</span>
                    </div>
                    <div className="mb-2 flex items-center justify-center gap-1 text-green-600">
                      <MessageSquare className="h-4 w-4" />
                      <span>{question.answers}</span>
                    </div>
                    <div className="flex items-center justify-center gap-1">
                      <Eye className="h-4 w-4" />
                      <span>{question.views}</span>
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link to={`/question/${question.id}`} className="text-lg font-semibold text-slate-900 hover:text-blue-600">
                      {question.title}
                    </Link>
                    <p className="mt-2 line-clamp-2 text-sm text-slate-600">{question.content}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {question.tags.map((tag) => (
                        <Link key={tag} to={`/questions?q=${encodeURIComponent(tag)}`} className="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700 hover:bg-blue-100">
                          {tag}
                        </Link>
                      ))}
                      <span className="ml-auto text-xs text-slate-500">
                        {author?.name ?? "匿名"} · {formatDistanceToNow(new Date(question.createdAt), { addSuffix: true, locale: zhCN })}
                      </span>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
          {questions.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
              当前筛选下没有问题，试试切换标签或搜索词。
            </div>
          )}
        </div>
      </div>
      <aside className="hidden xl:block">
        <RightSidebar />
      </aside>
    </div>
  );
}
