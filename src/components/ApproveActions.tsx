"use client";
import { useI18n } from "@/lib/i18n";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function ApproveActions({ token }: { token: string }) {
  const { t } = useI18n();
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
        setError(t(body.error || "送出失敗"));
        setBusy(null);
        return;
      }
      window.location.reload();
    } catch {
      setError(t("連線失敗，請稍後再試"));
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <textarea
        className="min-h-16 w-full resize-y rounded-lg border border-hairline-strong bg-surface-1 px-3 py-2 text-sm text-ink placeholder:text-ink-tertiary focus:border-primary focus:outline-none"
        placeholder={t("給學生的備註（選填，例如：記得附發票）")}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      {error && (
        <p className="rounded-lg border border-rose-500/30 bg-red-50 px-3 py-2 text-sm text-[#eb5757]">{error}</p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Button type="button" onClick={() => decide("approved")} disabled={busy !== null} className="bg-[#00c875] text-white hover:bg-[#00a861]">
          {busy === "approved" ? t("送出中…") : t("✓ 核准")}
        </Button>
        <Button type="button" variant="destructive" onClick={() => decide("rejected")} disabled={busy !== null}>
          {busy === "rejected" ? t("送出中…") : t("✕ 駁回")}
        </Button>
      </div>
    </div>
  );
}
