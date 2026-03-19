import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { apiRequest } from "../api/client";
import { useAuth } from "../auth-context";

export function ProfileEditPage() {
  const { user, refreshMe } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", avatar: "", bio: "", location: "", website: "" });
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

  return (
    <section className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-6">
      <h1 className="mb-4 text-2xl font-semibold">编辑资料</h1>
      <form
        className="space-y-3"
        onSubmit={async (event) => {
          event.preventDefault();
          try {
            await apiRequest("/users/me", { method: "PATCH", body: JSON.stringify(form) });
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
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white">保存</button>
      </form>
    </section>
  );
}