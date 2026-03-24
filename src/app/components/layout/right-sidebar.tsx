import { Link } from "react-router";
import { Crown, TrendingUp } from "lucide-react";
import { useQA } from "../../store/qa-context";

export function RightSidebar() {
  const { state } = useQA();
  const hotQuestions = [...state.questions].sort((a, b) => b.votes + b.views - (a.votes + a.views)).slice(0, 5);
  const topUsers = [...state.users].sort((a, b) => b.reputation - a.reputation).slice(0, 3);
  const tags = Array.from(new Set(state.questions.flatMap((q) => q.tags))).slice(0, 12);

  return (
    <div className="space-y-4">
      <section className="app-panel-dark overflow-hidden rounded-[2rem] p-5">
        <div className="mb-4 flex items-start gap-3">
          <span className="mt-1 flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
            <Crown className="h-5 w-5 text-[#f0c06f]" />
          </span>
          <div>
            <p className="app-kicker !text-[#d9c6a0]">Member desk</p>
            <h3 className="app-display mt-1 text-2xl font-semibold text-[#f8f1e3]">加入编辑导航 VIP</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">获得每周精选资源、专题学习档案和优先活动席位。</p>
          </div>
        </div>
        <Link to="/articles" className="inline-flex rounded-[1rem] border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/16">
          查看专栏入口
        </Link>
      </section>

      <section className="app-panel rounded-[1.8rem] p-5">
        <h3 className="mb-4 flex items-center gap-2 font-semibold text-slate-900">
          <TrendingUp className="h-4 w-4 text-[var(--accent)]" />
          全站热榜
        </h3>
        <div className="space-y-3">
          {hotQuestions.map((q, index) => (
            <div key={q.id} className="flex gap-3">
              <span className={`mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${index < 3 ? "bg-[#182133] text-[#f7ecd8]" : "bg-white text-slate-600"}`}>
                {index + 1}
              </span>
              <Link to={`/question/${q.id}`} className="line-clamp-2 text-sm leading-6 text-slate-700 hover:text-[var(--primary)]">
                {q.title}
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="app-panel rounded-[1.8rem] p-5">
        <div className="mb-3">
          <p className="app-kicker">People to watch</p>
          <h3 className="app-display mt-2 text-2xl font-semibold text-slate-900">推荐关注</h3>
        </div>
        <div className="space-y-3">
          {topUsers.map((user) => (
            <div key={user.id} className="flex items-center justify-between gap-3 rounded-[1.2rem] border border-white/70 bg-white/60 px-3 py-3">
              <div>
                <Link to={`/profile/${user.id}`} className="text-sm font-medium text-slate-800 hover:text-[var(--primary)]">
                  {user.name}
                </Link>
                <p className="text-xs text-slate-500">{user.reputation} 声望</p>
              </div>
              <Link to={`/profile/${user.id}`} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 hover:border-slate-300">
                查看主页
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="app-panel rounded-[1.8rem] p-5">
        <div className="mb-3">
          <p className="app-kicker">Signal cluster</p>
          <h3 className="app-display mt-2 text-2xl font-semibold text-slate-900">热门标签</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Link key={tag} to={`/questions?q=${encodeURIComponent(tag)}`} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-[var(--accent)] hover:text-[var(--accent)]">
              {tag}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
