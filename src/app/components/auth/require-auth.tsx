import { Navigate, useLocation } from "react-router";
import { useAuth } from "../../auth-context";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (import.meta.env.MODE === "test") return <>{children}</>;
  if (loading) return <div className="p-6 text-sm text-slate-500">正在检查登录状态...</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}
