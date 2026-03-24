import { useEffect, useState } from "react";
import { Link } from "react-router";
import { apiRequest } from "../api/client";
import { useQA } from "../store/qa-context";
import type { NotificationRecord } from "../types";
import { useI18n } from "../i18n";

type NotificationResponse = { unreadCount: number; items: NotificationRecord[] };

export function NotificationsPage() {
  const { actions } = useQA();
  const { t } = useI18n();
  const [data, setData] = useState<NotificationResponse>({ unreadCount: 0, items: [] });

  const refresh = async () => {
    const result = await apiRequest<NotificationResponse>("/notifications");
    setData(result);
  };

  useEffect(() => {
    refresh().catch(() => undefined);
  }, []);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("notificationsTitle")}</h1>
          <p className="text-sm text-slate-600">{t("notificationsUnread", { count: data.unreadCount })}</p>
        </div>
        <button
          type="button"
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          onClick={async () => {
            await apiRequest("/notifications/read-all", { method: "POST" });
            await refresh();
            try {
              await actions.refreshNotifications();
            } catch {
              // keep local state updated even if shared refresh fails
            }
          }}
        >
          {t("notificationsReadAll")}
        </button>
      </div>
      {data.items.map((item) => (
        <Link key={item.id} to={item.link} className={`block rounded-2xl border p-4 ${item.isRead ? "border-slate-200 bg-white" : "border-blue-200 bg-blue-50/60"}`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-medium text-slate-900">{item.title}</h2>
              <p className="mt-1 text-sm text-slate-600">{item.body}</p>
            </div>
            {!item.isRead && (
              <button
                type="button"
                className="rounded-md border border-slate-200 bg-white px-3 py-1 text-xs"
                onClick={async (event) => {
                  event.preventDefault();
                  await apiRequest(`/notifications/${item.id}/read`, { method: "POST" });
                  await refresh();
                  try {
                    await actions.refreshNotifications();
                  } catch {
                    // keep local state updated even if shared refresh fails
                  }
                }}
              >
                {t("notificationsMarkRead")}
              </button>
            )}
          </div>
          <p className="mt-2 text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</p>
        </Link>
      ))}
      {data.items.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">{t("notificationsEmpty")}</div>}
    </section>
  );
}
