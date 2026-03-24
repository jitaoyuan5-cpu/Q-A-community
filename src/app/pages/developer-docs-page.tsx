import { useEffect, useState } from "react";
import { apiRequest } from "../api/client";

type OpenApiDoc = {
  info: { title: string; version: string };
  paths: Record<string, Record<string, { summary: string }>>;
};

export function DeveloperDocsPage() {
  const [doc, setDoc] = useState<OpenApiDoc | null>(null);

  useEffect(() => {
    apiRequest<OpenApiDoc>("/public/v1/openapi.json").then(setDoc).catch(() => setDoc(null));
  }, []);

  return (
    <section className="space-y-5">
      <header className="app-panel app-mesh rounded-[2rem] px-6 py-6">
        <p className="app-kicker">Reference</p>
        <h1 className="app-display mt-3 text-4xl font-semibold text-slate-900">API 文档</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">所有读接口都要求 `x-api-key` 请求头，默认每小时 120 次。文档页按接口路径直接展开。</p>
      </header>
      <div className="app-panel-dark rounded-[1.8rem] p-5 font-mono text-xs text-slate-100">
        <p>curl -H "x-api-key: &lt;YOUR_KEY&gt;" {window.location.origin.replace(":5173", ":4000")}/api/public/v1/questions</p>
      </div>
      <div className="space-y-3">
        {doc
          ? Object.entries(doc.paths).map(([path, methods]) => {
              const [method, config] = Object.entries(methods)[0];
              return (
                <article key={path} className="app-panel rounded-[1.8rem] p-5">
                  <div className="mb-3 flex flex-wrap items-center gap-3">
                    <span className="app-badge uppercase">{method}</span>
                    <code className="text-sm text-slate-700">{path}</code>
                  </div>
                  <p className="text-sm leading-7 text-slate-600">{config.summary}</p>
                </article>
              );
            })
          : <div className="app-panel rounded-[1.8rem] px-6 py-12 text-center text-slate-500">文档加载失败。</div>}
      </div>
    </section>
  );
}
