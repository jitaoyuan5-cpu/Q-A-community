import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiRequest } from "./api/client";
import { useAuth } from "./auth-context";
import type { LocaleCode } from "./types";

const STORAGE_KEY = "qa_locale";

const dictionaries = {
  "zh-CN": {
    appName: "问答社区",
    navHome: "综合推荐",
    navHot: "热门话题",
    navRemote: "远程广场",
    navArticles: "专栏文章",
    navQuestions: "提问区域",
    navFollowing: "关注的问题",
    navFavorites: "我的收藏",
    navTutorials: "视频教程",
    navPlayground: "在线运行",
    navDevelopers: "开放平台",
    ask: "提问",
    login: "登录",
    register: "注册",
    logout: "退出",
    reviewDesk: "审核台",
    reportReview: "举报审核",
    tutorialManage: "教程管理",
    notifications: "消息通知",
    viewAll: "查看全部",
    noNotifications: "暂无通知",
    localeLabel: "语言",
    localeZh: "中文",
    localeEn: "英文",
    loginTitle: "登录",
    loginEmail: "邮箱",
    loginPassword: "密码",
    loginSubmit: "登录",
    loginNoAccount: "没有账号？",
    loginToRegister: "去注册",
    registerTitle: "注册",
    registerName: "昵称",
    registerEmail: "邮箱",
    registerPassword: "密码",
    registerSubmit: "注册",
    registerHasAccount: "已有账号？",
    registerToLogin: "去登录",
    notificationsTitle: "消息通知",
    notificationsUnread: "未读 {count} 条",
    notificationsReadAll: "全部已读",
    notificationsMarkRead: "标记已读",
    notificationsEmpty: "暂无通知。",
    installApp: "安装应用",
    installDescription: "把问答社区安装到设备首页，获得更顺手的移动端体验。",
    installDismiss: "稍后",
    installAction: "安装",
  },
  "en-US": {
    appName: "QA Community",
    navHome: "Home",
    navHot: "Hot Topics",
    navRemote: "Remote Jobs",
    navArticles: "Articles",
    navQuestions: "Questions",
    navFollowing: "Following",
    navFavorites: "Favorites",
    navTutorials: "Tutorials",
    navPlayground: "Playground",
    navDevelopers: "Developers",
    ask: "Ask",
    login: "Log in",
    register: "Sign up",
    logout: "Log out",
    reviewDesk: "Moderation",
    reportReview: "Report Review",
    tutorialManage: "Tutorial Admin",
    notifications: "Notifications",
    viewAll: "View all",
    noNotifications: "No notifications",
    localeLabel: "Language",
    localeZh: "Chinese",
    localeEn: "English",
    loginTitle: "Log in",
    loginEmail: "Email",
    loginPassword: "Password",
    loginSubmit: "Log in",
    loginNoAccount: "No account?",
    loginToRegister: "Create one",
    registerTitle: "Create account",
    registerName: "Display name",
    registerEmail: "Email",
    registerPassword: "Password",
    registerSubmit: "Create account",
    registerHasAccount: "Already have an account?",
    registerToLogin: "Go to log in",
    notificationsTitle: "Notifications",
    notificationsUnread: "{count} unread",
    notificationsReadAll: "Mark all as read",
    notificationsMarkRead: "Mark as read",
    notificationsEmpty: "No notifications.",
    installApp: "Install app",
    installDescription: "Install QA Community to your home screen for a better mobile experience.",
    installDismiss: "Later",
    installAction: "Install",
  },
} as const;

const normalizeLocale = (value?: string | null): LocaleCode => (value === "en-US" ? "en-US" : "zh-CN");

type I18nContextValue = {
  locale: LocaleCode;
  setLocale: (locale: LocaleCode) => Promise<void>;
  t: (key: keyof typeof dictionaries["zh-CN"], params?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

const interpolate = (template: string, params?: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_match, key) => String(params?.[key] ?? ""));

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const { user, updateUser } = useAuth();
  const [locale, setLocaleState] = useState<LocaleCode>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return normalizeLocale(stored);
    if (navigator.language.toLowerCase().startsWith("en")) return "en-US";
    return "zh-CN";
  });

  useEffect(() => {
    if (user?.preferredLocale) {
      setLocaleState(normalizeLocale(user.preferredLocale));
    }
  }, [user?.preferredLocale]);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale: async (nextLocale) => {
        const safe = normalizeLocale(nextLocale);
        setLocaleState(safe);
        localStorage.setItem(STORAGE_KEY, safe);
        if (user) {
          updateUser({ preferredLocale: safe });
          await apiRequest("/users/me", { method: "PATCH", body: JSON.stringify({ preferredLocale: safe }) }).catch(() => undefined);
        }
      },
      t: (key, params) => interpolate(dictionaries[locale][key] ?? dictionaries["zh-CN"][key], params),
    }),
    [locale, updateUser, user],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    return {
      locale: "zh-CN" as LocaleCode,
      setLocale: async () => undefined,
      t: (key: keyof typeof dictionaries["zh-CN"], params?: Record<string, string | number>) =>
        interpolate(dictionaries["zh-CN"][key], params),
    };
  }
  return ctx;
};
