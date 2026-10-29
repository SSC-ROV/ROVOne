"use client";
import { useI18n } from "@/lib/i18n";
import { isStaff } from "@/lib/roles";


import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { INPUT_CLS } from "@/lib/ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtMD, todayStr, weekdayCn } from "@/lib/date";
import { useDialogs } from "@/components/ui/Dialogs";
import { PageEmpty, PageError, PageLoading } from "@/components/PageState";
import type { Cycle, DiveLog, Me } from "@/lib/types";

export default function DiveLogsPage() {
  const { t } = useI18n();
  const { confirm, toast } = useDialogs();
  const [logs, setLogs] = useState<DiveLog[] | null>(null);
  const [cycles, setCycles] = useState<Cycle[] | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    date: todayStr(),
    title: "",
    participants: "",
    tested: "",
    issues: "",
    fixes: "",
    next_steps: "",
  });
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<DiveLog | null>(null);
  const [filterDate, setFilterDate] = useState("");
  const [filterAuthor, setFilterAuthor] = useState("all");

  async function load() {
    const [l, e, u, cy] = await Promise.all([
      api<{ logs: DiveLog[] }>("/api/divelogs"),
      api<{ events: unknown[] }>("/api/events").catch(() => ({ events: [] })),
      api<{ user: Me | null }>("/api/auth/me"),
      api<{ cycles: Cycle[] }>("/api/cycles").catch(() => ({ cycles: [] as Cycle[] })),
    ]);
    setLogs(l.logs);
    setCycles(cy.cycles);
    setMe(u.user);
  }

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, []);

  if (error) return <PageError message={error} />;
  if (!logs || !me) return <PageLoading label={t("載入中…")} />;

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setBusy(true);
    try {
      if (editing) {
        await api(`/api/divelogs/${editing.id}`, { method: "PATCH", body: JSON.stringify(form) });
        toast(t("日誌已更新"));
      } else {
        await api("/api/divelogs", { method: "POST", body: JSON.stringify(form) });
        toast(t("日誌已儲存"));
      }
      setEditing(null);
      setForm({ date: todayStr(), title: "", participants: "", tested: "", issues: "", fixes: "", next_steps: "" });
      setShowForm(false);
      await load();
    } catch (err) {
      toast(t((err as Error).message), "err");
    } finally {
      setBusy(false);
    }
  }

  async function toTask(log: DiveLog) {
    const candidates = (cycles ?? []).filter((c) => c.status === "active");
    if (candidates.length === 0) {
      toast(t("目前沒有進行中的開發週期，請先在「開發週期」頁提案"), "err");
      return;
    }
    const mine = candidates.find((c) => c.proposer_id === me?.id || c.members.some((m) => m.id === me?.id));
    const target = mine ?? candidates[0];
    const ok = await confirm({
      title: `${t("轉成任務")}：${log.title}`,
      message: t("會建立一筆指派給你的高優先級任務，內容附上日誌重點。"),
      confirmText: t("建立任務"),
    });
    if (!ok) return;
    try {
      await api("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          title: `${t("驗證：")}${log.title}${t(" 的修正項")}`,
          description: `${t("來自水測日誌（")}${log.date}${t("）\n測試：")}${log.tested}${t("\n問題：")}${log.issues}${t("\n修正：")}${log.fixes}${t("\n待驗證：")}${log.next_steps}`,
          subteam: "general",
          priority: "high",
          assignee_id: me!.id,
          cycle_id: target.id,
        }),
      });
      toast(t("已建立任務") + `（${target.title}）` + t("，記得到看板補截止日"));
    } catch (err) {
      toast(t((err as Error).message), "err");
    }
  }

  async function remove(log: DiveLog) {
    const ok = await confirm({
      title: `${t("刪除日誌")}「${log.title}」？`,
      confirmText: t("刪除"),
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/api/divelogs/${log.id}`, { method: "DELETE" });
      toast("已刪除");
      await load();
    } catch (err) {
      toast(t((err as Error).message), "err");
    }
  }

  const authors = Array.from(
    new Map(
      logs
        .filter((log) => log.created_by != null)
        .map((log) => [String(log.created_by), log.created_by_name ?? String(log.created_by)])
    ).entries()
  );
  const visible = logs.filter(
    (log) =>
      (!filterDate || log.date === filterDate) &&
      (filterAuthor === "all" || String(log.created_by) === filterAuthor)
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="board-title">{t("水測日誌")}</h1>
        <span className="text-sm text-ink-tertiary">{t("每次下水的問題與修正都留下紀錄，才不會踩同樣的坑")}</span>
        <Input className="ml-auto w-40" type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
        <Select value={filterAuthor} onValueChange={(value) => value && setFilterAuthor(value)}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("全部作者")}</SelectItem>
            {authors.map(([id, name]) => (
              <SelectItem key={id} value={id}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          onClick={() => {
            if (showForm && !editing) {
              setShowForm(false);
              return;
            }
            setEditing(null);
            setForm({ date: todayStr(), title: "", participants: "", tested: "", issues: "", fixes: "", next_steps: "" });
            setShowForm(true);
          }}
        >
          {t("＋ 新增日誌")}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent>
        <form onSubmit={submit} className="space-y-3">
          {editing && <h2 className="font-bold">{t("編輯日誌")}</h2>}
          <div className="grid gap-3 sm:grid-cols-3">
            <Input type="date" value={form.date} onChange={set("date")} />
            <Input placeholder={t("標題，例如：水測 #3 *")} value={form.title} onChange={set("title")} />
            <Input placeholder={t("參與人員")} value={form.participants} onChange={set("participants")} />
          </div>
          <textarea className={`${INPUT_CLS} min-h-16 resize-y`} placeholder={t("這次測了什麼？")} value={form.tested} onChange={set("tested")} />
          <div className="grid gap-3 sm:grid-cols-2">
            <textarea className={`${INPUT_CLS} min-h-16 resize-y`} placeholder={t("發現什麼問題？")} value={form.issues} onChange={set("issues")} />
            <textarea className={`${INPUT_CLS} min-h-16 resize-y`} placeholder={t("當場怎麼修正？")} value={form.fixes} onChange={set("fixes")} />
          </div>
          <textarea className={`${INPUT_CLS} min-h-16 resize-y`} placeholder={t("下次要驗證什麼？")} value={form.next_steps} onChange={set("next_steps")} />
          <Button type="submit" disabled={busy || !form.title.trim()}>
            {busy ? t("儲存中…") : editing ? t("儲存變更") : t("儲存日誌")}
          </Button>
        </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {visible.length === 0 && (
          <PageEmpty>{logs.length === 0 ? t("還沒有水測紀錄") : t("沒有符合的結果")}</PageEmpty>
        )}
        {visible.map((log) => (
          <Card key={log.id} className="rounded-none border-l-[6px] border-l-[#579bfc] py-0">
            <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-sky-500/40 bg-sky-500/10 px-2.5 py-0.5 text-xs text-sky-600">
                {fmtMD(log.date)}（{weekdayCn(log.date)}）
              </span>
              <span className="font-bold">{log.title}</span>
              {log.participants && <span className="text-sm text-ink-subtle">{log.participants}</span>}
              <span className="ml-auto text-xs text-ink-tertiary">{t("記錄")}：{log.created_by_name ?? "—"}</span>
            </div>
            <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
              <Section title={t("測試內容")} text={log.tested} />
              <Section title={t("發現問題")} text={log.issues} tone="text-danger" />
              <Section title={t("當場修正")} text={log.fixes} tone="text-success" />
              <Section title={t("下次驗證")} text={log.next_steps} tone="text-primary" />
            </dl>
            <div className="mt-2 flex gap-3 text-xs">
              {(log.next_steps || log.issues) && (
                <Button type="button" variant="link" className="h-auto px-0" onClick={() => toTask(log)}>
                  {t("轉成追蹤任務")}
                </Button>
              )}
              {(isStaff(me.role) || log.created_by === me.id) && (
                <Button
                  type="button"
                  variant="link"
                  className="h-auto px-0 text-muted-foreground"
                  onClick={() => {
                    setEditing(log);
                    setForm({
                      date: log.date,
                      title: log.title,
                      participants: log.participants,
                      tested: log.tested,
                      issues: log.issues,
                      fixes: log.fixes,
                      next_steps: log.next_steps,
                    });
                    setShowForm(true);
                  }}
                >
                  {t("編輯")}
                </Button>
              )}
              {isStaff(me.role) && (
                <Button type="button" variant="link" className="ml-auto h-auto px-0 text-muted-foreground hover:text-destructive" onClick={() => remove(log)}>
                  {t("刪除")}
                </Button>
              )}
            </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Section({ title, text, tone }: { title: string; text: string; tone?: string }) {
  if (!text) return null;
  return (
    <div className="rounded-xl bg-surface-2/50 px-3 py-2">
      <dt className="text-xs text-ink-tertiary">{title}</dt>
      <dd className={`whitespace-pre-wrap ${tone ?? "text-ink-muted"}`}>{text}</dd>
    </div>
  );
}
