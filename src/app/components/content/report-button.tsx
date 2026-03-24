import { Flag } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { apiRequest } from "../../api/client";
import { useAuth } from "../../auth-context";

const reasons = ["垃圾内容", "广告营销", "攻击辱骂", "色情低俗", "侵权抄袭", "其他"];

export function ReportButton({
  targetType,
  targetId,
  compact = false,
}: {
  targetType: "question" | "answer" | "article" | "comment" | "chat_message";
  targetId: string;
  compact?: boolean;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(reasons[0]);
  const [detail, setDetail] = useState("");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"error" | "success">("success");
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          if (!user) {
            navigate("/login");
            return;
          }
          setOpen((current) => {
            const next = !current;
            if (next) {
              setMessage("");
              setMessageTone("success");
              setSubmitted(false);
              setPending(false);
              setReason(reasons[0]);
              setDetail("");
            }
            return next;
          });
        }}
        className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs ${compact ? "border-slate-200 bg-white/70 text-slate-600" : "border-slate-200 bg-white/80 text-slate-700"}`.trim()}
      >
        <Flag className="h-3.5 w-3.5" />
        举报
      </button>
      {open && (
        <div className="app-panel-strong absolute right-0 top-11 z-20 w-72 rounded-[1.2rem] p-3 shadow-[0_24px_52px_rgba(24,33,51,0.18)]">
          <p className="mb-2 text-sm font-medium text-slate-900">提交举报</p>
          <select disabled={pending || submitted} className="app-input mb-2 h-10 rounded-[0.9rem] px-3 text-sm disabled:bg-slate-100" value={reason} onChange={(event) => setReason(event.target.value)}>
            {reasons.map((item) => <option key={item}>{item}</option>)}
          </select>
          <textarea disabled={pending || submitted} className="app-input mb-2 min-h-24 rounded-[0.9rem] p-3 text-sm disabled:bg-slate-100" value={detail} onChange={(event) => setDetail(event.target.value)} placeholder="补充说明（可选）" />
          {message && <p className={`mb-2 text-xs ${messageTone === "error" ? "text-red-600" : "text-green-600"}`}>{message}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending || submitted}
              className="rounded-[0.9rem] bg-[var(--danger)] px-3 py-1.5 text-xs text-white disabled:cursor-not-allowed disabled:opacity-60"
              onClick={async () => {
                setPending(true);
                setMessage("");
                try {
                  await apiRequest("/reports", {
                    method: "POST",
                    body: JSON.stringify({ targetType, targetId: Number(targetId.replace(/\D/g, "")), reason, detail }),
                  });
                  setMessageTone("success");
                  setMessage("举报已提交");
                  setSubmitted(true);
                } catch (err) {
                  setMessageTone("error");
                  setMessage((err as Error).message);
                } finally {
                  setPending(false);
                }
              }}
            >
              {submitted ? "已提交" : pending ? "提交中..." : "提交"}
            </button>
            <button type="button" disabled={pending} className="app-button-ghost rounded-[0.9rem] px-3 py-1.5 text-xs disabled:bg-slate-100" onClick={() => setOpen(false)}>
              关闭
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
