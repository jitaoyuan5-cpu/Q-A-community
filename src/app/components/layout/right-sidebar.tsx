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
      <section className="rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-900 to-slate-700 p-5 text-white">
        <div className="mb-3 flex items-start gap-2">
          <Crown className="h-5 w-5 text-amber-400" />
          <div>
            <h3 className="font-semibold">加入编程导航 VIP</h3>
            <p className="mt-1 text-sm text-slate-200">获专属资源、认证交流圈与优先活动席位。</p>
          </div>
        </div>
        <Link to="/articles" className="block w-full rounded-lg bg-blue-600 px-3 py-2 text-center text-sm font-medium hover:bg-blue-500">立即加入</Link>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="mb-4 flex items-center gap-2 font-semibold text-slate-900">
          <TrendingUp className="h-4 w-4 text-orange-500" />
          全站热榜
        </h3>
        <div className="space-y-3">
          {hotQuestions.map((q, index) => (
            <div key={q.id} className="flex gap-2">
              <span className={`mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded text-xs font-medium ${index < 3 ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-600"}`}>
                {index + 1}
              </span>
              <Link to={`/question/${q.id}`} className="line-clamp-2 text-sm text-slate-700 hover:text-blue-600 hover:underline">{q.title}</Link>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="mb-3 font-semibold">推荐关注</h3>
        <div className="space-y-3">
          {topUsers.map((user) => (
            <div key={user.id} className="flex items-center justify-between">
              <div>
                <Link to={`/profile/${user.id}`} className="text-sm font-medium hover:text-blue-600">{user.name}</Link>
                <p className="text-xs text-slate-500">{user.reputation} 声望</p>
              </div>
              <Link to={`/profile/${user.id}`} className="rounded-md border border-blue-500 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50">查看主页</Link>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="mb-3 font-semibold">热门标签</h3>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Link key={tag} to={`/questions?q=${encodeURIComponent(tag)}`} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100">
              {tag}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
