import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiRequest, tokenStore } from "./api/client";

type AuthUser = {
  id: number;
  email?: string;
  name: string;
  avatar?: string;
  reputation?: number;
  role?: "user" | "admin";
  bio?: string;
  location?: string;
  website?: string;
};

type AuthContextType = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);
type AuthResponse = { accessToken: string; refreshToken: string; user: AuthUser };

const TEST_AUTH_STORAGE_KEY = "qa_test_auth_user";
const defaultTestUser: AuthUser = {
  id: 1,
  email: "alice@example.com",
  name: "张三",
  avatar: "https://i.pravatar.cc/80?img=1",
  reputation: 2850,
  role: "admin",
};

const getTestUser = (): AuthUser | null => {
  const raw = localStorage.getItem(TEST_AUTH_STORAGE_KEY);
  if (raw === "null") return null;
  if (!raw) return defaultTestUser;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return defaultTestUser;
  }
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const isTestMode = import.meta.env.MODE === "test";
  const [user, setUser] = useState<AuthUser | null>(() => (isTestMode ? getTestUser() : null));
  const [loading, setLoading] = useState(!isTestMode);

  const refreshMe = async () => {
    if (isTestMode) {
      setUser(getTestUser());
      return;
    }
    try {
      const me = await apiRequest<AuthUser>("/auth/me");
      setUser(me);
    } catch {
      setUser(null);
    }
  };

  useEffect(() => {
    if (isTestMode) return;
    const boot = async () => {
      if (tokenStore.getAccess()) {
        await refreshMe();
      }
      setLoading(false);
    };
    boot();
  }, [isTestMode]);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      loading,
      login: async (email, password) => {
        const data = await apiRequest<AuthResponse>("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        tokenStore.set(data.accessToken, data.refreshToken);
        setUser(data.user);
      },
      register: async (name, email, password) => {
        const data = await apiRequest<AuthResponse>("/auth/register", {
          method: "POST",
          body: JSON.stringify({ name, email, password }),
        });
        tokenStore.set(data.accessToken, data.refreshToken);
        setUser(data.user);
      },
      logout: async () => {
        const refreshToken = tokenStore.getRefresh();
        if (refreshToken) {
          await apiRequest("/auth/logout", {
            method: "POST",
            body: JSON.stringify({ refreshToken }),
          }).catch(() => undefined);
        }
        tokenStore.clear();
        setUser(null);
      },
      refreshMe,
    }),
    [loading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};
