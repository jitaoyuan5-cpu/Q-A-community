import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { apiRequest } from "../api/client";

type Profile = {
  user: { id: number; name: string; avatar: string; reputation: number; bio?: string; location?: string; website?: string };
  questions: Array<{ id: number; title: string }>;
  answers: Array<{ id: number; question_id: number; content: string }>;
};

export function ProfilePage() {
  const { id } = useParams();
  const [data, setData] = useState<Profile | null>(null);

  useEffect(() => {
    if (!id) return;
    apiRequest<Profile>(`/users/${id}`).then(setData).catch(() => setData(null));
  }, [id]);

  if (!data) return <div className="rounded-xl border border-slate-200 bg-white p-6">加载中...</div>;

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h1 className="text-2xl font-semibold">{data.user.name}</h1>
        <p className="text-sm text-slate-600">声望 {data.user.reputation}</p>
        <p className="mt-2 text-sm text-slate-600">{data.user.bio || "暂无简介"}</p>
        <p className="text-sm text-slate-600">{data.user.location || ""}</p>
        <p className="text-sm"><a className="text-blue-600" href={data.user.website} target="_blank">{data.user.website}</a></p>
        <Link className="mt-3 inline-block text-sm text-blue-600" to="/profile/edit">编辑资料</Link>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="mb-2 font-semibold">提问</h2>
        {data.questions.map((q) => <Link key={q.id} to={`/question/${q.id}`} className="mb-2 block text-sm hover:text-blue-600">{q.title}</Link>)}
      </div>
    </section>
  );
}
