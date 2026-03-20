import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { apiRequest } from "../api/client";
import { useAuth } from "../auth-context";
import type { EmailPreference } from "../types";

export function ProfileEditPage() {
  const { user, refreshMe } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", avatar: "", bio: "", location: "", website: "" });
  const [preferences, setPreferences] = useState<EmailPreference>({
    emailEnabled: true,
    notifyNewAnswer: true,
    notifyNewComment: true,
    notifyAnswerAccepted: true,
    notifyFollowUpdate: true,
  });
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    setForm({
      name: user.name || "",
      avatar: user.avatar || "",
      bio: user.bio || "",
      location: user.location || "",
      website: user.website || "",
    });
  }, [user]);

  useEffect(() => {
    apiRequest<EmailPreference>("/users/me/preferences").then(setPreferences).catch(() => undefined);
  }, []);

  return (
    <section className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-6">
      <h1 className="mb-4 text-2xl font-semibold">编辑资料</h1>
      <form
        className="space-y-3"
        onSubmit={async (event) => {
          event.preventDefault();
          try {
            await apiRequest("/users/me", { method: "PATCH", body: JSON.stringify(form) });
            await apiRequest("/users/me/preferences", { method: "PUT", body: JSON.stringify(preferences) });
            await refreshMe();
            navigate(`/profile/${user?.id || ""}`);
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <input className="h-10 w-full rounded-lg border border-slate-200 px-3" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="昵称" />
        <input className="h-10 w-full rounded-lg border border-slate-200 px-3" value={form.avatar} onChange={(e) => setForm((p) => ({ ...p, avatar: e.target.value }))} placeholder="头像 URL" />
        <input className="h-10 w-full rounded-lg border border-slate-200 px-3" value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))} placeholder="所在地" />
        <input className="h-10 w-full rounded-lg border border-slate-200 px-3" value={form.website} onChange={(e) => setForm((p) => ({ ...p, website: e.target.value }))} placeholder="个人网站" />
        <textarea className="min-h-28 w-full rounded-lg border border-slate-200 p-3" value={form.bio} onChange={(e) => setForm((p) => ({ ...p, bio: e.target.value }))} placeholder="个人简介" />
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="mb-3 text-sm font-medium text-slate-900">邮件提醒</p>
          {[
            ["emailEnabled", "启用邮件提醒"],
            ["notifyNewAnswer", "新回答提醒"],
            ["notifyNewComment", "新评论提醒"],
            ["notifyAnswerAccepted", "回答被采纳提醒"],
            ["notifyFollowUpdate", "关注问题更新提醒"],
          ].map(([key, label]) => (
            <label key={key} className="mb-2 flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={preferences[key as keyof EmailPreference]}
                onChange={(event) => setPreferences((prev) => ({ ...prev, [key]: event.target.checked }))}
              />
              {label}
            </label>
          ))}
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white">保存</button>
      </form>
    </section>
  );
}
