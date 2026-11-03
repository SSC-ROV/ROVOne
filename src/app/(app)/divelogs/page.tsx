"use client";
import { useI18n } from "@/lib/i18n";
import { isStaff } from "@/lib/roles";


import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { groupColor } from "@/lib/ui";
import { tt } from "@/lib/i18n-core";
import { CalendarIcon, ListPlusIcon, PanelRightOpenIcon, PencilIcon, PlusIcon, Trash2Icon, UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { MultiFilter } from "@/components/tasks/shared";
import { BoardGroup } from "@/components/board/BoardGroup";
import { BoardHeader } from "@/components/board/BoardHeader";
import { PersonCell } from "@/components/board/PersonCell";
import { FormField, RowActions, TableEmpty, TableToolbar, TitleCell } from "@/components/board/BoardTable";
import { fmtMD, todayStr, weekdayCn } from "@/lib/date";
import { useDialogs } from "@/components/ui/Dialogs";
import { PageError, PageLoading } from "@/components/PageState";
import type { Cycle, DiveLog, Me } from "@/lib/types";

export default function DiveLogsPage() {
  const { t, lang } = useI18n();
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
  const [q, setQ] = useState("");
  const [fMonth, setFMonth] = useState<string[]>([]);
  const [fAuthor, setFAuthor] = useState<string[]>([]);
  const [openId, setOpenId] = useState<number | null>(null);

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
      toast(t("目前沒有進行中的專案，請先在「專案」頁提案"), "err");
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
  const monthOf = (date: string) => date.slice(0, 7);
  const monthLabel = (key: string) =>
    new Date(`${key}-01T00:00:00`).toLocaleDateString(lang === "zh" ? "zh-Hant" : "en", { month: "long", year: "numeric" });
  const months = [...new Set(logs.map((log) => monthOf(log.date)))].sort().reverse();
  const needle = q.trim().toLowerCase();
  const visible = logs.filter(
    (log) =>
      (fMonth.length === 0 || fMonth.includes(monthOf(log.date))) &&
      (fAuthor.length === 0 || fAuthor.includes(String(log.created_by))) &&
      (!needle ||
        [log.title, log.participants, log.tested, log.issues, log.fixes, log.next_steps, log.created_by_name ?? ""].join(" ").toLowerCase().includes(needle))
  );
  const narrowing = needle.length > 0 || fMonth.length > 0 || fAuthor.length > 0;
  const openLog = openId != null ? logs.find((log) => log.id === openId) ?? null : null;
  const canEdit = (log: DiveLog) => isStaff(me.role) || log.created_by === me.id;

  function startNew() {
    setEditing(null);
    setForm({ date: todayStr(), title: "", participants: "", tested: "", issues: "", fixes: "", next_steps: "" });
    setShowForm(true);
  }

  function startEdit(log: DiveLog) {
    setOpenId(null);
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
  }

  const textareaCls =
    "field-sizing-content min-h-20 rounded-[8px] border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

  return (
    <div className="space-y-4">
      <BoardHeader
        title={t("水測紀錄")}
        subtitle={t("每次下水的問題與修正都留下紀錄，才不會踩同樣的坑")}
        action={
          <Button onClick={startNew}>
            <PlusIcon /> {tt("新日誌", "New log")}
          </Button>
        }
      />

      <TableToolbar
        query={q}
        onQuery={setQ}
        placeholder={tt("搜尋標題、問題、修正、人員…", "Search titles, issues, fixes, people…")}
        narrowing={narrowing}
        onClear={() => {
          setQ("");
          setFMonth([]);
          setFAuthor([]);
        }}
        shown={visible.length}
        total={logs.length}
        noun={["筆", "logs"]}
        filters={
          <>
            <MultiFilter label={tt("月份", "Month")} icon={<CalendarIcon className="size-3.5" />} value={fMonth} onChange={setFMonth} options={months.map((m) => ({ value: m, label: monthLabel(m) }))} />
            <MultiFilter label={tt("記錄人", "Recorded by")} icon={<UserIcon className="size-3.5" />} value={fAuthor} onChange={setFAuthor} options={authors.map(([id, name]) => ({ value: id, label: name }))} />
          </>
        }
      />

      {visible.length === 0 && (
        <div className="rounded-[8px] border border-dashed border-border bg-card">
          <TableEmpty>{logs.length === 0 ? t("還沒有水測紀錄") : t("沒有符合的結果")}</TableEmpty>
        </div>
      )}
      {months.map((month, mi) => {
        const rows = visible.filter((log) => monthOf(log.date) === month).sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
        if (rows.length === 0) return null;
        return (
          <BoardGroup key={month} title={monthLabel(month)} color={groupColor(mi)} count={rows.length}>
            <table className="board-table is-interactive table-fixed" style={{ minWidth: 1100 }}>
              <colgroup>
                <col style={{ width: 130 }} />
                <col />
                <col style={{ width: 240 }} />
                <col style={{ width: 240 }} />
                <col style={{ width: 170 }} />
                <col style={{ width: 40 }} />
              </colgroup>
              <thead>
                <tr>
                  <th><span className="pl-8">{tt("日期", "Date")}</span></th>
                  <th>{tt("標題", "Title")}</th>
                  <th>{t("發現問題")}</th>
                  <th>{t("下次驗證")}</th>
                  <th>{tt("記錄人", "Recorded by")}</th>
                  <th aria-label={tt("動作", "Actions")} />
                </tr>
              </thead>
              <tbody>
                {rows.map((log, index) => (
                  <tr key={log.id} className="group/row">
                    <td>
                      <span className="flex items-center gap-2.5">
                        <span className="w-6 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{index + 1}</span>
                        <span className="tabular-nums">{fmtMD(log.date)}</span>
                        <span className="text-xs text-muted-foreground">{weekdayCn(log.date)}</span>
                      </span>
                    </td>
                    <td><TitleCell title={log.title} sub={log.participants} onOpen={() => setOpenId(log.id)} /></td>
                    <td className="truncate text-muted-foreground" title={log.issues}>{log.issues || "—"}</td>
                    <td className="truncate text-muted-foreground" title={log.next_steps}>{log.next_steps || "—"}</td>
                    <td><PersonCell name={log.created_by_name} /></td>
                    <td>
                      <RowActions
                        label={log.title}
                        actions={[
                          { label: tt("開啟詳情", "Open details"), icon: <PanelRightOpenIcon />, onSelect: () => setOpenId(log.id) },
                          { label: t("編輯"), icon: <PencilIcon />, onSelect: () => startEdit(log), hidden: !canEdit(log) },
                          { label: t("轉成追蹤任務"), icon: <ListPlusIcon />, onSelect: () => toTask(log), hidden: !(log.next_steps || log.issues) },
                          { label: t("刪除"), icon: <Trash2Icon />, onSelect: () => remove(log), destructive: true, separator: true, hidden: !isStaff(me.role) },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </BoardGroup>
        );
      })}

      <Sheet open={openLog != null} onOpenChange={(open) => { if (!open) setOpenId(null); }}>
        <SheetContent className="w-full gap-0 sm:max-w-[560px]" style={{ width: "min(560px, 100%)", maxWidth: 560 }}>
          {openLog && (
            <>
              <SheetHeader className="border-b border-border px-5">
                <SheetTitle className="text-lg">{openLog.title}</SheetTitle>
                <SheetDescription>
                  {fmtMD(openLog.date)}（{weekdayCn(openLog.date)}）{openLog.participants ? ` · ${openLog.participants}` : ""} · {t("記錄")}：{openLog.created_by_name ?? "—"}
                </SheetDescription>
              </SheetHeader>
              <dl className="flex flex-col gap-2 overflow-y-auto px-5 py-4 text-sm">
                <Section title={t("測試內容")} text={openLog.tested} />
                <Section title={t("發現問題")} text={openLog.issues} tone="text-[var(--c-red)]" />
                <Section title={t("當場修正")} text={openLog.fixes} tone="text-[var(--c-green)]" />
                <Section title={t("下次驗證")} text={openLog.next_steps} tone="text-[var(--c-blue)]" />
              </dl>
              <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-border px-5 py-3">
                {(openLog.next_steps || openLog.issues) && (
                  <Button variant="outline" onClick={() => toTask(openLog)}><ListPlusIcon /> {t("轉成追蹤任務")}</Button>
                )}
                {canEdit(openLog) && (
                  <Button variant="outline" onClick={() => startEdit(openLog)}><PencilIcon /> {t("編輯")}</Button>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={showForm} onOpenChange={setShowForm}>
        <SheetContent className="w-full gap-0 sm:max-w-[560px]" style={{ width: "min(560px, 100%)", maxWidth: 560 }}>
          <form onSubmit={submit} className="flex h-full min-h-0 flex-col">
            <SheetHeader className="border-b border-border px-5">
              <SheetTitle className="text-lg">{editing ? t("編輯日誌") : tt("新日誌", "New log")}</SheetTitle>
              <SheetDescription>{tt("記下這次下水測了什麼、遇到什麼問題", "What you tested on this dive and what went wrong")}</SheetDescription>
            </SheetHeader>
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4 text-sm">
              <FormField label={tt("標題", "Title")}>
                <Input autoFocus className="h-9" placeholder={t("標題，例如：水測 #3 *")} value={form.title} onChange={set("title")} />
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label={tt("日期", "Date")}>
                  <Input className="h-9" type="date" value={form.date} onChange={set("date")} />
                </FormField>
                <FormField label={t("參與人員")}>
                  <Input className="h-9" value={form.participants} onChange={set("participants")} />
                </FormField>
              </div>
              <FormField label={t("這次測了什麼？")}><textarea className={textareaCls} value={form.tested} onChange={set("tested")} /></FormField>
              <FormField label={t("發現什麼問題？")}><textarea className={textareaCls} value={form.issues} onChange={set("issues")} /></FormField>
              <FormField label={t("當場怎麼修正？")}><textarea className={textareaCls} value={form.fixes} onChange={set("fixes")} /></FormField>
              <FormField label={t("下次要驗證什麼？")}><textarea className={textareaCls} value={form.next_steps} onChange={set("next_steps")} /></FormField>
            </div>
            <div className="flex items-center gap-3 border-t border-border px-5 py-3">
              <Button type="button" variant="ghost" className="ml-auto" onClick={() => setShowForm(false)}>{t("取消")}</Button>
              <Button type="submit" disabled={busy || !form.title.trim()}>
                {busy ? t("儲存中…") : editing ? t("儲存變更") : t("儲存日誌")}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Section({ title, text, tone }: { title: string; text: string; tone?: string }) {
  if (!text) return null;
  return (
    <div className="rounded-[6px] bg-muted/50 px-3 py-2">
      <dt className="text-xs font-medium text-muted-foreground">{title}</dt>
      <dd className={`mt-0.5 whitespace-pre-wrap [overflow-wrap:anywhere] ${tone ?? "text-foreground"}`}>{text}</dd>
    </div>
  );
}
