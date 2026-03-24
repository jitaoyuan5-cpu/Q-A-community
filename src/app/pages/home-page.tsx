import { useMemo } from "react";
import { Link, useSearchParams } from "react-router";
import { Eye, MessageSquare, ThumbsUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { RightSidebar } from "../components/layout/right-sidebar";
import { useQA } from "../store/qa-context";
import { findUser, selectQuestionsForHome, type HomeTab } from "../store/selectors";
import { FavoriteButton } from "../components/content/favorite-button";

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

  const totals = useMemo(() => {
    const views = state.questions.reduce((sum, question) => sum + question.views, 0);
    const answers = state.questions.reduce((sum, question) => sum + question.answers, 0);
    const unanswered = state.questions.filter((question) => question.answers === 0).length;
    return {
      questions: state.questions.length,
      views,
      answers,
      unanswered,
    };
  }, [state.questions]);

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-5">
        <section className="app-panel app-mesh overflow-hidden rounded-[2rem] px-6 py-6 lg:px-8 lg:py-8">
          <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-6">
              <div className="space-y-4">
                <p className="app-kicker">Editorial feed</p>
                <h1 className="app-display max-w-[10ch] text-[2.4rem] font-semibold leading-[1.02] text-slate-900 sm:text-[3rem] xl:text-[3.5rem]">
                  把问答、课程与实验，编成一份更清楚的技术刊。
                </h1>
                <p className="max-w-[42rem] text-sm leading-7 text-slate-600 sm:text-[15px]">
                  先给出首页当前的内容重心，再把最新讨论按更稳定的阅读顺序展开，不让统计信息和装饰元素抢走主标题的注意力。
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {tabs.map((item) => (
                  <button
                    key={item}
                    onClick={() => {
                      const next = new URLSearchParams(params);
                      next.set("tab", item);
                      setParams(next, { replace: true });
                    }}
                    className={`rounded-full px-4 py-2.5 text-sm font-medium transition ${
                      tab === item ? "app-button-primary text-white" : "app-button-ghost text-slate-700"
                    }`}
                  >
                    {tabLabel[item]}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                <span className="rounded-full border border-white/70 bg-white/70 px-3 py-1.5">
                  当前主线: <span className="font-semibold text-slate-800">{tabLabel[tab]}</span>
                </span>
                <span className="rounded-full border border-white/70 bg-white/70 px-3 py-1.5">
                  收录问题: <span className="font-semibold text-slate-800">{totals.questions} 条</span>
                </span>
                <span className="rounded-full border border-white/70 bg-white/70 px-3 py-1.5">
                  待处理: <span className="font-semibold text-slate-800">{totals.unanswered} 条</span>
                </span>
              </div>
            </div>

            <aside className="app-panel-dark rounded-[1.8rem] p-5 lg:mt-1">
              <div className="mb-4">
                <p className="app-kicker !text-[#d8c6a3]">This issue</p>
                <h2 className="app-display mt-2 text-3xl font-semibold text-[#f8f1e3]">站点概览</h2>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  把统计信息收束成一张侧边概览卡，首页只保留一个真正的视觉主角。
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2">
                {[
                  { label: "问题总数", value: totals.questions },
                  { label: "回答总数", value: totals.answers },
                  { label: "未回答", value: totals.unanswered },
                  { label: "总浏览", value: totals.views },
                ].map((item) => (
                  <div key={item.label} className="rounded-[1.2rem] border border-white/10 bg-white/10 px-4 py-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-300">{item.label}</p>
                    <p className="app-display mt-2 text-3xl font-semibold text-[#f8f1e3]">{item.value}</p>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </section>

        <div className="space-y-4">
          {questions.map((question) => {
            const author = findUser(state, question.authorId);
            return (
              <article key={question.id} className="app-panel rounded-[1.9rem] p-5 transition hover:-translate-y-0.5 hover:shadow-[0_24px_48px_rgba(24,33,51,0.12)] sm:p-6">
                <div className="grid gap-4 md:grid-cols-[104px_minmax(0,1fr)]">
                  <div className="grid grid-cols-3 gap-2 md:grid-cols-1">
                    <div className="rounded-[1.1rem] border border-slate-200/80 bg-white/75 px-3 py-3 text-center">
                      <div className="mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-700">
                        <ThumbsUp className="h-4 w-4" />
                      </div>
                      <p className="text-lg font-semibold text-slate-900">{question.votes}</p>
                      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">votes</p>
                    </div>
                    <div className="rounded-[1.1rem] border border-emerald-200 bg-emerald-50/70 px-3 py-3 text-center">
                      <div className="mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                        <MessageSquare className="h-4 w-4" />
                      </div>
                      <p className="text-lg font-semibold text-emerald-800">{question.answers}</p>
                      <p className="text-[11px] uppercase tracking-[0.16em] text-emerald-600">answers</p>
                    </div>
                    <div className="rounded-[1.1rem] border border-slate-200/80 bg-white/75 px-3 py-3 text-center">
                      <div className="mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-700">
                        <Eye className="h-4 w-4" />
                      </div>
                      <p className="text-lg font-semibold text-slate-900">{question.views}</p>
                      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">views</p>
                    </div>
                  </div>

                  <div className="min-w-0">
                    <p className="app-kicker">{question.answers === 0 ? "Open thread" : "Conversation"}</p>
                    <Link to={`/question/${question.id}`} className="app-display mt-2 block text-[1.7rem] font-semibold leading-tight text-slate-900 hover:text-[var(--primary)]">
                      {question.title}
                    </Link>
                    <p className="mt-3 line-clamp-3 text-sm leading-7 text-slate-600">{question.content}</p>
                    <div className="mt-5 flex flex-wrap items-center gap-2">
                      {question.tags.map((tag) => (
                        <Link key={tag} to={`/questions?q=${encodeURIComponent(tag)}`} className="app-badge">
                          {tag}
                        </Link>
                      ))}
                    </div>
                    <div className="mt-5 flex flex-wrap items-center gap-3">
                      <div className="min-w-0 text-sm text-slate-500">
                        <span className="font-medium text-slate-700">{author?.name ?? "匿名"}</span>
                        <span className="mx-2 text-slate-300">/</span>
                        {formatDistanceToNow(new Date(question.createdAt), { addSuffix: true, locale: zhCN })}
                      </div>
                      <FavoriteButton targetType="question" targetId={question.id} active={Boolean(question.isFavorited)} className="ml-auto" />
                    </div>
                  </div>
                </div>
              </article>
            );
          })}

          {questions.length === 0 && (
            <div className="app-panel rounded-[1.8rem] px-6 py-12 text-center text-slate-500">
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
