import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../auth-context";
import { useI18n } from "../i18n";

export function RegisterPage() {
  const { register } = useAuth();
  const { locale, t } = useI18n();
  const navigate = useNavigate();
  const [name, setName] = useState("测试用户");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("123456");
  const [error, setError] = useState("");

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6">
      <h1 className="mb-4 text-2xl font-semibold">{t("registerTitle")}</h1>
      <form
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          try {
            await register(name, email, password, locale);
            navigate("/");
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} className="h-10 w-full rounded-lg border border-slate-200 px-3" placeholder={t("registerName")} />
        <input value={email} onChange={(e) => setEmail(e.target.value)} className="h-10 w-full rounded-lg border border-slate-200 px-3" placeholder={t("registerEmail")} />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-10 w-full rounded-lg border border-slate-200 px-3" placeholder={t("registerPassword")} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white">{t("registerSubmit")}</button>
      </form>
      <p className="mt-4 text-sm text-slate-600">
        {t("registerHasAccount")}<Link to="/login" className="text-blue-600">{t("registerToLogin")}</Link>
      </p>
    </div>
  );
}
