import { Code2, KeyRound, Link as LinkIcon } from "lucide-react";
import { Link } from "react-router";

export function DevelopersPage() {
  return (
    <section className="space-y-6">
      <header className="app-panel app-mesh rounded-[2rem] px-6 py-6">
        <p className="app-kicker">Developer platform</p>
        <h1 className="app-display mt-3 text-4xl font-semibold text-slate-900 sm:text-[3.1rem]">开放平台</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">
          首期只开放只读公共 API，但页面和文档已经按产品入口组织好：拿 Key、看文档、拉公开数据。
        </p>
      </header>
      <div className="grid gap-4 md:grid-cols-3">
        <Link to="/developers/docs" className="app-panel rounded-[1.8rem] p-5 transition hover:-translate-y-0.5">
          <Code2 className="mb-4 h-8 w-8 text-[var(--primary)]" />
          <p className="app-kicker">Reference</p>
          <h2 className="app-display mt-2 text-2xl font-semibold text-slate-900">API 文档</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">查看 OpenAPI、请求示例、错误码和速率限制说明。</p>
        </Link>
        <Link to="/developers/keys" className="app-panel rounded-[1.8rem] p-5 transition hover:-translate-y-0.5">
          <KeyRound className="mb-4 h-8 w-8 text-[var(--accent)]" />
          <p className="app-kicker">Credentials</p>
          <h2 className="app-display mt-2 text-2xl font-semibold text-slate-900">管理 API Key</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">创建和吊销 Key，当前每个账号最多保留 2 个有效 Key。</p>
        </Link>
        <div className="app-panel-dark rounded-[1.8rem] p-5">
          <LinkIcon className="mb-4 h-8 w-8 text-[#f0c06f]" />
          <p className="app-kicker !text-[#d8c6a3]">Scope</p>
          <h2 className="app-display mt-2 text-2xl font-semibold text-[#f8f1e3]">只读公共资源</h2>
          <p className="mt-3 text-sm leading-7 text-slate-300">开放问题、答案、文章、标签、热门话题与公开用户主页的查询能力。</p>
        </div>
      </div>
    </section>
  );
}
