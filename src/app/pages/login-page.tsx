import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { useAuth } from "../auth-context";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("alice@example.com");
  const [password, setPassword] = useState("123456");
  const [error, setError] = useState("");

  const from = (location.state as { from?: string } | null)?.from || "/";

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6">
      <h1 className="mb-4 text-2xl font-semibold">登录</h1>
      <form
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          try {
            await login(email, password);
            navigate(from, { replace: true });
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <input value={email} onChange={(e) => setEmail(e.target.value)} className="h-10 w-full rounded-lg border border-slate-200 px-3" placeholder="邮箱" />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-10 w-full rounded-lg border border-slate-200 px-3" placeholder="密码" />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white">登录</button>
      </form>
      <p className="mt-4 text-sm text-slate-600">
        没有账号？<Link to="/register" className="text-blue-600">去注册</Link>
      </p>
    </div>
  );
}