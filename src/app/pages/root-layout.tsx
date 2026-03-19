import { Link, Outlet, useLocation, useNavigate, useSearchParams } from "react-router";
import { BookMarked, FileText, Flame, Globe, HelpCircle, History, Home, Menu, MessageSquare, PlusCircle, Search, User, X } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { apiRequest } from "../api/client";
import { useAuth } from "../auth-context";

const navItems = [
  { path: "/", icon: Home, label: "综合推荐" },
  { path: "/hot", icon: Flame, label: "热门话题" },
  { path: "/remote", icon: Globe, label: "远程广场" },
  { path: "/articles", icon: FileText, label: "专栏文章" },
  { path: "/questions", icon: HelpCircle, label: "提问区域" },
  { path: "/following", icon: BookMarked, label: "关注的问题" },
];

type Suggestion = { value: string; type: string };
type SearchHistoryItem = { id: number; query_text: string };

export function RootLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user, logout } = useAuth();
  const [navOpen, setNavOpen] = useState(false);
  const [searchText, setSearchText] = useState(params.get("q") ?? "");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const searchPanelRef = useRef<HTMLFormElement | null>(null);

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

  const submitSearch = (event?: FormEvent) => {
    event?.preventDefault();
    const q = searchText.trim();
    if (!q) return;
    setPanelOpen(false);
    navigate(`/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <button className="rounded-md p-2 text-slate-600 lg:hidden" onClick={() => setNavOpen((v) => !v)} aria-label="toggle nav">
            {navOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <Link to="/" className="flex shrink-0 items-center gap-2">
            <MessageSquare className="h-7 w-7 text-blue-600" />
            <span className="text-lg font-semibold">问答社区</span>
          </Link>

          <form ref={searchPanelRef} className="relative ml-2 hidden flex-1 md:block" onSubmit={submitSearch}>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={searchText}
              onFocus={() => setPanelOpen(true)}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="搜索问题、文章、用户..."
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none ring-blue-500 transition focus:ring-2"
            />
            {panelOpen && (suggestions.length > 0 || history.length > 0) && (
              <div className="absolute left-0 right-0 top-11 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
                {suggestions.length > 0 && (
                  <div className="mb-2">
                    <p className="mb-1 text-xs text-slate-500">实时建议</p>
                    {suggestions.map((item, index) => (
                      <button
                        type="button"
                        key={`${item.type}-${index}`}
                        className="block w-full rounded-md px-2 py-1 text-left text-sm hover:bg-slate-50"
                        onClick={() => {
                          setSearchText(item.value);
                          setPanelOpen(false);
                          navigate(`/search?q=${encodeURIComponent(item.value)}`);
                        }}
                      >
                        <span className="mr-2 inline-flex rounded bg-slate-100 px-1 text-xs text-slate-500">{item.type}</span>
                        {item.value}
                      </button>
                    ))}
                  </div>
                )}
                {history.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs text-slate-500">搜索历史</p>
                    {history.slice(0, 6).map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-slate-50"
                        onClick={() => {
                          setSearchText(item.query_text);
                          setPanelOpen(false);
                          navigate(`/search?q=${encodeURIComponent(item.query_text)}`);
                        }}
                      >
                        <History className="h-3 w-3 text-slate-400" />
                        {item.query_text}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </form>

          <Link to="/ask" className="ml-auto">
            <button className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              <PlusCircle className="mr-1 h-4 w-4" />
              提问
            </button>
          </Link>

          {user ? (
            <div className="hidden items-center gap-2 md:flex">
              <Link to={`/profile/${user.id}`} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">{user.name}</Link>
              <button
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                onClick={() => {
                  logout();
                  navigate("/");
                }}
              >
                退出
              </button>
            </div>
          ) : (
            <div className="hidden items-center gap-2 md:flex">
              <Link to="/login" className="rounded-lg border border-slate-200 px-3 py-2 text-sm">登录</Link>
              <Link to="/register" className="rounded-lg border border-slate-200 px-3 py-2 text-sm">注册</Link>
            </div>
          )}
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:px-8">
        <aside className={`${navOpen ? "block" : "hidden"} lg:block`}>
          <nav className="sticky top-24 rounded-2xl border border-slate-200 bg-white p-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`mb-1 flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
                    active ? "bg-blue-50 text-blue-600" : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
            {user && (
              <Link to={`/profile/${user.id}`} className="mb-1 flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                <User className="h-4 w-4" />个人主页
              </Link>
            )}
          </nav>
        </aside>
        <main>
          <Outlet />
        </main>
      </div>

      <footer className="mt-10 border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6 text-center text-sm text-slate-500 sm:px-6 lg:px-8">© 2026 问答社区 · 技术问题交流平台</div>
      </footer>
    </div>
  );
}
