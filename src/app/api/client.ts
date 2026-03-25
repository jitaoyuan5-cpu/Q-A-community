const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api").replace(/\/$/, "");
const ACCESS_KEY = "qa_access_token";
const REFRESH_KEY = "qa_refresh_token";

type RequestOptions = Omit<RequestInit, "headers"> & { headers?: Record<string, string> };

type RefreshResponse = { accessToken: string; refreshToken: string };

export const tokenStore = {
  getAccess: (): string | null => localStorage.getItem(ACCESS_KEY),
  getRefresh: (): string | null => localStorage.getItem(REFRESH_KEY),
  set: (accessToken: string, refreshToken: string) => {
    localStorage.setItem(ACCESS_KEY, accessToken);
    localStorage.setItem(REFRESH_KEY, refreshToken);
  },
  clear: () => {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

let refreshingPromise: Promise<string> | null = null;

const refreshIfNeeded = async (): Promise<string> => {
  if (refreshingPromise) return refreshingPromise;
  const refreshToken = tokenStore.getRefresh();
  if (!refreshToken) throw new Error("No refresh token");

  refreshingPromise = fetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  })
    .then(async (res) => {
      if (!res.ok) throw new Error("Refresh failed");
      const data = (await res.json()) as RefreshResponse;
      tokenStore.set(data.accessToken, data.refreshToken);
      return data.accessToken;
    })
    .finally(() => {
      refreshingPromise = null;
    });

  return refreshingPromise;
};

export const apiFetch = async (path: string, options: RequestOptions = {}, retry = true): Promise<Response> => {
  const accessToken = tokenStore.getAccess();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers || {}) as Record<string, string>),
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401 && retry && accessToken) {
    try {
      const newToken = await refreshIfNeeded();
      return apiFetch(
        path,
        { ...options, headers: { ...((options.headers || {}) as Record<string, string>), Authorization: `Bearer ${newToken}` } },
        false,
      );
    } catch {
      tokenStore.clear();
      throw new Error("Unauthorized");
    }
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message || "Request failed");
  }

  return response;
};

export const apiRequest = async <T = unknown>(path: string, options: RequestOptions = {}, retry = true): Promise<T> => {
  const response = await apiFetch(path, options, retry);
  if (response.status === 204) return null as T;
  return (await response.json()) as T;
};

export const apiBase = API_BASE;
