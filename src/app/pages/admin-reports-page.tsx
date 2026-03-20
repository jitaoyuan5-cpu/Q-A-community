import { useEffect, useState } from "react";
import { apiRequest } from "../api/client";
import { useQA } from "../store/qa-context";

type AdminReport = {
  id: number;
  targetType: string;
  targetId: number;
  reason: string;
  detail?: string;
  status: string;
  reporter: { id: number; name: string };
  reviewer?: { id: number; name: string } | null;
  reviewNote?: string;
  actionTaken?: string | null;
  createdAt: string;
};

export function AdminReportsPage() {
  const { actions } = useQA();
  const [items, setItems] = useState<AdminReport[]>([]);
  const [status, setStatus] = useState("pending");

  const refresh = async (nextStatus = status) => {
    const rows = await apiRequest<AdminReport[]>(`/admin/reports?status=${encodeURIComponent(nextStatus)}`);
    setItems(rows);
  };

  useEffect(() => {
    refresh().catch(() => undefined);
  }, [status]);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">举报审核</h1>
          <p className="text-sm text-slate-600">管理员内容治理面板</p>
        </div>
        <select className="h-10 rounded-lg border border-slate-200 px-3" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="pending">待处理</option>
          <option value="reviewed">已处理</option>
          <option value="rejected">已忽略</option>
          <option value="all">全部</option>
        </select>
      </div>
      {items.map((item) => (
        <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">{item.targetType} #{item.targetId}</p>
              <h2 className="font-semibold text-slate-900">{item.reason}</h2>
              <p className="mt-1 text-sm text-slate-600">{item.detail || "无补充说明"}</p>
              <p className="mt-2 text-xs text-slate-500">举报人：{item.reporter.name} · {new Date(item.createdAt).toLocaleString()}</p>
              {item.actionTaken && <p className="mt-1 text-xs text-slate-500">处理结果：{item.actionTaken} {item.reviewNote ? `· ${item.reviewNote}` : ""}</p>}
            </div>
            {item.status === "pending" && (
              <div className="flex flex-wrap gap-2">
                {["ignore", "hide"].map((action) => (
                  <button
                    key={action}
                    type="button"
                    className="rounded-md border border-slate-200 px-3 py-1.5 text-xs"
                    onClick={async () => {
                      await apiRequest(`/admin/reports/${item.id}/review`, {
                        method: "POST",
                        body: JSON.stringify({ action, reviewNote: "" }),
                      });
                      await Promise.all([refresh(), actions.refreshAll()]);
                    }}
                  >
                    {action}
                  </button>
                ))}
              </div>
            )}
          </div>
        </article>
      ))}
      {items.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">当前筛选下没有举报记录。</div>}
    </section>
  );
}
