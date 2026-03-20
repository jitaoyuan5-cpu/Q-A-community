import { Heart } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../../auth-context";
import { useQA } from "../../store/qa-context";

export function FavoriteButton({
  targetType,
  targetId,
  active,
  className = "",
}: {
  targetType: "question" | "article";
  targetId: string;
  active: boolean;
  className?: string;
}) {
  const { actions } = useQA();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (error) setError("");
  }, [active]);

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          if (!user) {
            navigate("/login");
            return;
          }
          setPending(true);
          setError("");
          try {
            await actions.toggleFavorite(targetType, targetId);
          } catch (err) {
            setError(`收藏失败：${(err as Error).message}`);
          } finally {
            setPending(false);
          }
        }}
        className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs ${active ? "border-rose-200 bg-rose-50 text-rose-600" : "border-slate-200 bg-white text-slate-600"} ${pending ? "cursor-not-allowed opacity-70" : ""} ${className}`.trim()}
      >
        <Heart className={`h-4 w-4 ${active ? "fill-current" : ""}`} />
        {pending ? "处理中..." : active ? "已收藏" : "收藏"}
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
