import { useEffect, useState } from "react";
import { apiRequest } from "../api/client";
import { useI18n } from "../i18n";
import { getP3Copy } from "../utils/p3-copy";
import type { DeveloperApiKey } from "../types";

type CreateKeyResponse = { id: number; name: string; keyPrefix: string; secret: string };

export function DeveloperKeysPage() {
  const { locale } = useI18n();
  const copy = getP3Copy(locale).developerKeys;
  const [items, setItems] = useState<DeveloperApiKey[]>([]);
  const [name, setName] = useState<string>(copy.defaultName);
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
        <p className="app-kicker">{copy.heroKicker}</p>
        <h1 className="app-display mt-3 text-4xl font-semibold text-slate-900">{copy.title}</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">{copy.heroBody}</p>
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
        <label className="mb-2 block text-sm font-medium text-slate-700">{copy.inputLabel}</label>
        <div className="flex flex-wrap gap-2">
          <input value={name} onChange={(event) => setName(event.target.value)} className="app-input h-11 min-w-[240px] flex-1 rounded-[1rem] px-3" />
          <button className="app-button-primary rounded-[1rem] px-4 py-2.5 text-sm font-medium text-white">{copy.create}</button>
        </div>
        {createdSecret ? <p className="mt-3 rounded-[1rem] border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{copy.revealedSecret(createdSecret)}</p> : null}
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </form>

      <div className="space-y-3">
        {items.map((item) => (
          <article key={item.id} className="app-panel rounded-[1.8rem] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="app-kicker">{copy.keyDossier}</p>
                <h2 className="app-display mt-2 text-2xl font-semibold text-slate-900">{item.name}</h2>
                <p className="mt-2 text-sm text-slate-500">{copy.prefix(item.keyPrefix)}</p>
                <p className="mt-1 text-xs leading-6 text-slate-500">{copy.createdAt(new Date(item.createdAt).toLocaleString(), item.lastUsedAt ? new Date(item.lastUsedAt).toLocaleString() : null)}</p>
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
                {item.revokedAt ? copy.revoked : copy.revoke}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
