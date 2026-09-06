"use client";

import { useState } from "react";

export default function ApproveActions({ token }: { token: string }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"approved" | "rejected" | null>(null);
  const [error, setError] = useState("");

  async function decide(decision: "approved" | "rejected") {
    setBusy(decision);
    setError("");
    try {
      const res = await fetch(`/api/approve/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, note }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || "送出失敗");
        setBusy(null);
        return;
      }
      window.location.reload();
    } catch {
      setError("連線失敗，請稍後再試");
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <textarea
        className="min-h-16 w-full resize-y rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
        placeholder="給學生的備註（選填，例如：記得附發票）"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      {error && (
        <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{error}</p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => decide("approved")}
          disabled={busy !== null}
          className="rounded-lg bg-emerald-500 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
        >
          {busy === "approved" ? "送出中…" : "✓ 核准"}
        </button>
        <button
          onClick={() => decide("rejected")}
          disabled={busy !== null}
          className="rounded-lg border border-rose-500/50 py-2.5 text-sm font-semibold text-rose-300 transition hover:bg-rose-500/10 disabled:opacity-50"
        >
          {busy === "rejected" ? "送出中…" : "✕ 駁回"}
        </button>
      </div>
    </div>
  );
}
