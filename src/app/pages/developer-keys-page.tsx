import { useEffect, useState } from "react";
import { apiRequest } from "../api/client";
import type { DeveloperApiKey } from "../types";

type CreateKeyResponse = { id: number; name: string; keyPrefix: string; secret: string };

export function DeveloperKeysPage() {
  const [items, setItems] = useState<DeveloperApiKey[]>([]);
  const [name, setName] = useState("Public data key");
  const [createdSecret, setCreatedSecret] = useState("");
  const [error, setError] = useState("");

  const refresh = async () => {
    const rows = await apiRequest<DeveloperApiKey[]>("/developer/keys");
    setItems(rows);
  };

  useEffect(() => {
    refresh().catch((err) => setError((err as Error).message));
  }, []);

  return (
    <section className="space-y-5">
      <header className="app-panel app-mesh rounded-[2rem] px-6 py-6">
        <p className="app-kicker">Developer keys</p>
        <h1 className="app-display mt-3 text-4xl font-semibold text-slate-900">API Keys</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">只读公共 API 通过 `x-api-key` 请求头鉴权。新 key 只展示一次，建议立刻保存。</p>
      </header>

      <form
        className="app-panel rounded-[1.8rem] p-5"
        onSubmit={async (event) => {
          event.preventDefault();
          setError("");
          try {
            const response = await apiRequest<CreateKeyResponse>("/developer/keys", {
              method: "POST",
              body: JSON.stringify({ name }),
            });
            setCreatedSecret(response.secret);
            await refresh();
          } catch (err) {
            setError((err as Error).message);
          }
        }}
      >
        <label className="mb-2 block text-sm font-medium text-slate-700">Key 名称</label>
        <div className="flex flex-wrap gap-2">
          <input value={name} onChange={(event) => setName(event.target.value)} className="app-input h-11 min-w-[240px] flex-1 rounded-[1rem] px-3" />
          <button className="app-button-primary rounded-[1rem] px-4 py-2.5 text-sm font-medium text-white">创建 API Key</button>
        </div>
        {createdSecret ? <p className="mt-3 rounded-[1rem] border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">新 Key 只展示一次：<code>{createdSecret}</code></p> : null}
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </form>

      <div className="space-y-3">
        {items.map((item) => (
          <article key={item.id} className="app-panel rounded-[1.8rem] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="app-kicker">Key dossier</p>
                <h2 className="app-display mt-2 text-2xl font-semibold text-slate-900">{item.name}</h2>
                <p className="mt-2 text-sm text-slate-500">Prefix: {item.keyPrefix}</p>
                <p className="mt-1 text-xs leading-6 text-slate-500">创建于 {new Date(item.createdAt).toLocaleString()} · 最近使用 {item.lastUsedAt ? new Date(item.lastUsedAt).toLocaleString() : "暂无"}</p>
              </div>
              <button
                type="button"
                className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600"
                disabled={Boolean(item.revokedAt)}
                onClick={async () => {
                  await apiRequest(`/developer/keys/${item.id}`, { method: "DELETE" });
                  await refresh();
                }}
              >
                {item.revokedAt ? "已吊销" : "吊销"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
