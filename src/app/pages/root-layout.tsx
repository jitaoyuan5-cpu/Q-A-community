import { Link, Outlet, useLocation, useNavigate, useSearchParams } from "react-router";
import { Bell, BookHeart, BookMarked, FileText, Flame, Globe, HelpCircle, History, Home, Menu, MessageSquare, PlusCircle, Search, Shield, Sparkles, User, X } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { apiRequest } from "../api/client";
import { useAuth } from "../auth-context";
import { useQA } from "../store/qa-context";
import { useI18n } from "../i18n";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Suggestion = { value: string; type: string };
type SearchHistoryItem = { id: number; query_text: string };

export function RootLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user, logout } = useAuth();
  const { state, actions } = useQA();
  const [navOpen, setNavOpen] = useState(false);
  const [searchText, setSearchText] = useState(params.get("q") ?? "");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const searchPanelRef = useRef<HTMLFormElement | null>(null);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installDismissed, setInstallDismissed] = useState(false);
  const { locale, setLocale, t } = useI18n();

  const navItems = [
    { path: "/", icon: Home, label: t("navHome") },
    { path: "/assistant", icon: Sparkles, label: locale === "zh-CN" ? "AI 助手" : "Assistant" },
    { path: "/hot", icon: Flame, label: t("navHot") },
    { path: "/remote", icon: Globe, label: t("navRemote") },
    { path: "/articles", icon: FileText, label: t("navArticles") },
    { path: "/tutorials", icon: FileText, label: t("navTutorials") },
    { path: "/playground", icon: Globe, label: t("navPlayground") },
    { path: "/questions", icon: HelpCircle, label: t("navQuestions") },
    { path: "/following", icon: BookMarked, label: t("navFollowing") },
    { path: "/favorites", icon: BookHeart, label: t("navFavorites") },
    { path: "/developers", icon: Shield, label: t("navDevelopers") },
  ];

  useEffect(() => {
    const q = searchText.trim();
    if (!q) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(() => {
      apiRequest<Suggestion[]>(`/search/suggest?q=${encodeURIComponent(q)}`)
        .then((rows) => setSuggestions(rows))
        .catch(() => setSuggestions([]));
    }, 180);
    return () => clearTimeout(timer);
  }, [searchText]);

  useEffect(() => {
    if (!user) {
      setHistory([]);
      return;
    }
    apiRequest<SearchHistoryItem[]>("/search/history")
      .then((rows) => setHistory(rows))
      .catch(() => setHistory([]));
  }, [user]);

  useEffect(() => {
    if (!panelOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!searchPanelRef.current?.contains(event.target as Node)) {
        setPanelOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPanelOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [panelOpen]);

  useEffect(() => {
    if (!user) return;
    actions.refreshNotifications().catch(() => undefined);
  }, [actions, user?.id]);

  useEffect(() => {
    if (!user) return;

    const handleFocus = () => {
      actions.refreshNotifications().catch(() => undefined);
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [actions, user?.id]);

  useEffect(() => {
    if (!user || !notificationOpen) return;
    actions.refreshNotifications().catch(() => undefined);
  }, [actions, notificationOpen, user?.id]);

  useEffect(() => {
    const handlePrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handlePrompt);
    return () => window.removeEventListener("beforeinstallprompt", handlePrompt);
  }, []);

  const submitSearch = (event?: FormEvent) => {
    event?.preventDefault();
    const q = searchText.trim();
    if (!q) return;
    setPanelOpen(false);
    navigate(`/search?q=${encodeURIComponent(q)}`);
  };

  const unreadCount = state.notifications.filter((item) => !item.isRead).length;
  const localeTagline = locale === "zh-CN" ? "Issue 03 · 技术讨论 / 实验 / 课程" : "Issue 03 · discussions / labs / lessons";

  return (
    <div className="app-shell min-h-screen pb-10">
      <header className="sticky top-4 z-30 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1480px]">
          <div className="app-panel rounded-[2rem] px-4 py-4 sm:px-5 lg:px-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
              <div className="flex items-center gap-3">
                <button className="app-button-ghost rounded-2xl p-3 text-slate-700 lg:hidden" onClick={() => setNavOpen((v) => !v)} aria-label="toggle nav">
                  {navOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </button>
                <Link to="/" className="flex min-w-0 items-center gap-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1rem] bg-[#16263d] text-[#f5e9d5] shadow-[0_12px_28px_rgba(22,38,61,0.22)]">
                    <MessageSquare className="h-6 w-6 text-[#f0c06f]" />
                  </span>
                  <div className="min-w-0">
                    <p className="app-kicker">QA Community</p>
                    <div className="app-display truncate text-[1.45rem] font-semibold text-slate-900">{t("appName")}</div>
                    <p className="truncate text-xs text-slate-500">{localeTagline}</p>
                  </div>
                </Link>
              </div>

              <form ref={searchPanelRef} className="relative min-w-0 flex-1" onSubmit={submitSearch}>
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchText}
                  onFocus={() => setPanelOpen(true)}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder={locale === "zh-CN" ? "搜索问题、文章、用户..." : "Search questions, articles, people..."}
                  className="app-input h-12 rounded-[1.2rem] pl-11 pr-4 text-sm"
                />
                {panelOpen && (suggestions.length > 0 || history.length > 0) && (
                  <div className="app-panel-strong absolute left-0 right-0 top-14 rounded-[1.5rem] p-3 shadow-[0_24px_52px_rgba(24,33,51,0.18)]">
                    {suggestions.length > 0 && (
                      <div className="mb-3">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{locale === "zh-CN" ? "实时建议" : "Live suggestions"}</p>
                        <div className="space-y-1">
                          {suggestions.map((item, index) => (
                            <button
                              type="button"
                              key={`${item.type}-${index}`}
                              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100/80"
                              onClick={() => {
                                setSearchText(item.value);
                                setPanelOpen(false);
                                navigate(`/search?q=${encodeURIComponent(item.value)}`);
                              }}
                            >
                              <span className="app-badge !px-2 !py-1 !text-[11px]">{item.type}</span>
                              <span className="line-clamp-1">{item.value}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {history.length > 0 && (
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{locale === "zh-CN" ? "搜索历史" : "Search history"}</p>
                        <div className="space-y-1">
                          {history.slice(0, 6).map((item) => (
                            <button
                              type="button"
                              key={item.id}
                              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100/80"
                              onClick={() => {
                                setSearchText(item.query_text);
                                setPanelOpen(false);
                                navigate(`/search?q=${encodeURIComponent(item.query_text)}`);
                              }}
                            >
                              <History className="h-3.5 w-3.5 text-slate-400" />
                              {item.query_text}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </form>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <Link to="/assistant" className="hidden rounded-[1rem] border border-slate-200/80 bg-white/70 px-3 py-2 text-sm font-medium text-slate-700 xl:inline-flex xl:items-center xl:gap-2">
                  <Sparkles className="h-4 w-4 text-[var(--accent)]" />
                  {locale === "zh-CN" ? "AI 助手" : "Assistant"}
                </Link>
                <Link to="/ask" className="shrink-0">
                  <button className="app-button-primary inline-flex items-center rounded-[1rem] px-4 py-2.5 text-sm font-medium">
                    <PlusCircle className="mr-1.5 h-4 w-4" />
                    {t("ask")}
                  </button>
                </Link>
                <div className="hidden items-center gap-1 rounded-full border border-slate-200/80 bg-white/72 p-1 md:flex">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400">
                    <Globe className="h-4 w-4" />
                  </span>
                  <button
                    type="button"
                    onClick={() => setLocale("zh-CN").catch(() => undefined)}
                    className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                      locale === "zh-CN" ? "bg-[#182133] text-[#fff8ec]" : "text-slate-500 hover:text-slate-800"
                    }`}
                    aria-pressed={locale === "zh-CN"}
                  >
                    中
                  </button>
                  <button
                    type="button"
                    onClick={() => setLocale("en-US").catch(() => undefined)}
                    className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                      locale === "en-US" ? "bg-[#182133] text-[#fff8ec]" : "text-slate-500 hover:text-slate-800"
                    }`}
                    aria-pressed={locale === "en-US"}
                  >
                    EN
                  </button>
                </div>

                {user ? (
                  <div className="hidden items-center gap-2 md:flex">
                    <div className="relative">
                      <button
                        aria-label="打开消息通知"
                        className="app-button-ghost relative rounded-[1rem] px-3 py-2.5 text-sm"
                        onClick={() => setNotificationOpen((current) => !current)}
                      >
                        <Bell className="h-4 w-4" />
                        {unreadCount > 0 && (
                          <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[var(--accent)] px-1.5 text-[11px] font-semibold text-white">
                            {Math.min(unreadCount, 9)}
                          </span>
                        )}
                      </button>
                      {notificationOpen && (
                        <div className="app-panel-strong absolute right-0 top-14 z-30 w-[22rem] rounded-[1.6rem] p-3 shadow-[0_28px_54px_rgba(24,33,51,0.22)]">
                          <div className="mb-3 flex items-center justify-between">
                            <div>
                              <p className="app-kicker">{t("notifications")}</p>
                              <p className="mt-1 text-sm font-medium text-slate-900">{locale === "zh-CN" ? "最近动态" : "Recent activity"}</p>
                            </div>
                            <Link to="/notifications" onClick={() => setNotificationOpen(false)} className="text-xs font-semibold text-[var(--primary)]">
                              {t("viewAll")}
                            </Link>
                          </div>
                          <div className="space-y-2">
                            {state.notifications.slice(0, 5).map((item) => (
                              <Link
                                key={item.id}
                                to={item.link}
                                onClick={() => setNotificationOpen(false)}
                                className={`block rounded-[1.1rem] border px-3 py-3 text-sm ${
                                  item.isRead ? "border-slate-200 bg-white/70" : "border-amber-200 bg-amber-50/90"
                                }`}
                              >
                                <p className="font-medium text-slate-900">{item.title}</p>
                                <p className="mt-1 text-xs text-slate-500">{item.body}</p>
                              </Link>
                            ))}
                            {state.notifications.length === 0 && (
                              <p className="rounded-[1.1rem] border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500">
                                {t("noNotifications")}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    <Link to={`/profile/${user.id}`} className="app-button-ghost rounded-[1rem] px-3 py-2.5 text-sm">
                      {user.name}
                    </Link>
                    {user.role === "admin" && (
                      <Link to="/admin/reports" className="app-button-ghost rounded-[1rem] px-3 py-2.5 text-sm">
                        {t("reviewDesk")}
                      </Link>
                    )}
                    <button
                      className="app-button-ghost rounded-[1rem] px-3 py-2.5 text-sm"
                      onClick={() => {
                        logout();
                        navigate("/");
                      }}
                    >
                      {t("logout")}
                    </button>
                  </div>
                ) : (
                  <div className="hidden items-center gap-2 md:flex">
                    <Link to="/login" className="app-button-ghost rounded-[1rem] px-3 py-2.5 text-sm">{t("login")}</Link>
                    <Link to="/register" className="app-button-ghost rounded-[1rem] px-3 py-2.5 text-sm">{t("register")}</Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto mt-6 grid max-w-[1480px] grid-cols-1 gap-6 px-4 sm:px-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:px-8">
        <aside className={`${navOpen ? "block" : "hidden"} lg:block`}>
          <nav className="app-panel sticky top-28 rounded-[2rem] p-3">
            <div className="px-3 pb-4 pt-2">
              <p className="app-kicker">{locale === "zh-CN" ? "导航索引" : "Issue index"}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {locale === "zh-CN" ? "浏览问答、课程、实验与开放接口，像翻阅一份持续更新的技术周刊。" : "Browse discussions, lessons, labs and APIs like an evolving engineering journal."}
              </p>
            </div>
            <div className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = item.path === "/" ? location.pathname === "/" : location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-3 rounded-[1.15rem] px-3 py-3 text-sm font-medium transition ${
                      active
                        ? "border border-[#d8c6a3]/25 bg-[#182133] shadow-[0_14px_30px_rgba(24,33,51,0.16)]"
                        : "text-slate-700 hover:bg-white/80"
                    }`}
                  >
                    <Icon className={`h-4 w-4 shrink-0 ${active ? "text-[#f0c06f]" : "text-slate-500"}`} />
                    <span className={`min-w-0 truncate ${active ? "text-[#fff8ec]" : "text-slate-700"}`}>{item.label}</span>
                  </Link>
                );
              })}
              {user && (
                <>
                  <div className="app-divider my-3" />
                  <Link to={`/profile/${user.id}`} className="flex items-center gap-3 rounded-[1.15rem] px-3 py-3 text-sm font-medium text-slate-700 hover:bg-white/80">
                    <User className="h-4 w-4 text-slate-500" />
                    {locale === "zh-CN" ? "个人主页" : "Profile"}
                  </Link>
                  {user.role === "admin" && (
                    <>
                      <Link to="/admin/reports" className="flex items-center gap-3 rounded-[1.15rem] px-3 py-3 text-sm font-medium text-slate-700 hover:bg-white/80">
                        <Shield className="h-4 w-4 text-slate-500" />
                        {t("reportReview")}
                      </Link>
                      <Link to="/admin/tutorials" className="flex items-center gap-3 rounded-[1.15rem] px-3 py-3 text-sm font-medium text-slate-700 hover:bg-white/80">
                        <FileText className="h-4 w-4 text-slate-500" />
                        {t("tutorialManage")}
                      </Link>
                    </>
                  )}
                </>
              )}
            </div>
          </nav>
        </aside>

        <main className="space-y-5">
          {installPrompt && !installDismissed ? (
            <div className="app-panel rounded-[1.7rem] p-4 text-sm text-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="app-kicker">{t("installApp")}</p>
                  <p className="mt-2 max-w-2xl text-sm text-slate-600">{t("installDescription")}</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" className="app-button-ghost rounded-[0.9rem] px-3 py-2 text-xs" onClick={() => setInstallDismissed(true)}>
                    {t("installDismiss")}
                  </button>
                  <button
                    type="button"
                    className="app-button-primary rounded-[0.9rem] px-3 py-2 text-xs font-semibold"
                    onClick={async () => {
                      await installPrompt.prompt();
                      setInstallPrompt(null);
                    }}
                  >
                    {t("installAction")}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
          <Outlet />
        </main>
      </div>

      <footer className="mx-auto mt-12 max-w-[1480px] px-4 sm:px-6 lg:px-8">
        <div className="app-panel rounded-[1.8rem] px-6 py-5 text-center text-sm text-slate-500">
          <span className="app-display text-base text-slate-700">QA Community</span>
          <span className="mx-2 text-slate-300">/</span>
          © 2026 {locale === "zh-CN" ? "技术问题交流、课程与实验平台" : "discussion, lessons and labs for engineers"}
        </div>
      </footer>
    </div>
  );
}
