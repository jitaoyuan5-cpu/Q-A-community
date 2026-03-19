import { Link } from "react-router";

export function NotFoundPage() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <h1 className="mb-2 text-3xl font-semibold">404</h1>
      <p className="mb-4 text-slate-600">页面不存在或已被移除。</p>
      <Link to="/" className="text-blue-600 hover:underline">返回首页</Link>
    </div>
  );
}