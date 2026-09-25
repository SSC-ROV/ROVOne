"use client";
import { useI18n } from "@/lib/i18n";
import TaskModal from "@/components/TaskModal";
import CycleTimeline from "@/components/CycleTimeline";
import { useSubteams } from "@/lib/subteams";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { useDialogs } from "@/components/ui/Dialogs";
import { BTN, BTN_GHOST, CHIP, INPUT_CLS, cycleStatus } from "@/lib/ui";
import { isStaff } from "@/lib/roles";
import { daysBetween, fmtMD, todayStr } from "@/lib/date";
import type { Cycle, CycleStatus, Me, Member, Task } from "@/lib/types";

export default function CyclesPage() {
  const { t } = useI18n();
  const { subteams } = useSubteams();
  const { confirm, prompt, toast } = useDialogs();
  const [cycles, setCycles] = useState<Cycle[] | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [form, setForm] = useState<null | { editing: Cycle | null }>(null);
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [modal, setModal] = useState<
    { mode: "create"; cycleId: number } | { mode: "edit"; task: Task } | null
  >(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [c, m, u, t] = await Promise.all([
      api<{ cycles: Cycle[] }>("/api/cycles"),
      api<{ members: Member[] }>("/api/members"),
      api<{ user: Me | null }>("/api/auth/me"),
      api<{ tasks: Task[] }>("/api/tasks"),
    ]);
    setCycles(c.cycles);
    setMembers(m.members);
    setTasks(t.tasks);
    setMe(u.user);
  }, []);
  const bgReload = () => { load().catch(() => {}); };

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, [load]);

  if (error) {
    return (
      <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">{error}</p>
    );
  }
  if (!cycles || !me) {
    return <p className="py-20 text-center text-sm text-ink-tertiary">{t("載入中…")}</p>;
  }

  // today 必須在下方 filter 之前宣告（approvedNotStarted 會用到，否則暫時性死區 ReferenceError）
  const today = todayStr();
  const pending = cycles.filter((c) => c.status === "pending_leader" || c.status === "pending_teacher");
  const active = cycles.filter((c) => c.status === "active");
  const approvedNotStarted = cycles.filter(
    (c) => c.status === "approved" && c.start_date > today
  );
  const late = cycles.filter((c) => c.status === "late");
  const history = cycles.filter((c) => c.status === "completed" || c.status === "rejected");
  const myRole = me.role;
  const meId = me.id;
  // 示範帳號（leader/member/teacher）與所有老師帳號：不進週期邀請名單與成員統計
  const DEMO_USERNAMES = ["leader", "member", "teacher"];
  const invitableMembers = members.filter(
    (m) => m.role !== "teacher" && !DEMO_USERNAMES.includes(m.username)
  );

  // 樂觀更新：任務勾選（立即改畫面，背景同步；失敗則還原）
  async function toggleTaskDone(task: Task) {
    const nextStatus = task.status === "done" ? "doing" : "done";
    const snapshot = tasks;
    setTasks((prev) =>
      prev!.map((x) =>
        x.id === task.id
          ? { ...x, status: nextStatus, completed_at: nextStatus === "done" ? new Date().toISOString() : null }
          : x
      )
    );
    setCycles((prev) =>
      prev!.map((c) => {
        if (c.id !== task.cycle_id) return c;
        const delta = nextStatus === "done" ? 1 : task.status === "done" ? -1 : 0;
        return { ...c, task_done: Math.max(0, c.task_done + delta) };
      })
    );
    try {
      await api(`/api/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus, version: task.version }),
      });
      bgReload();
    } catch (err) {
      setTasks(snapshot);
      toast(t((err as Error).message), "err");
    }
  }

  // 樂觀更新：快速新增任務（先插臨時項，再由背景重載取得正式資料）
  async function quickAddTask(cycleId: number, title: string) {
    if (!title.trim()) return;
    try {
      await api("/api/tasks", {
        method: "POST",
        body: JSON.stringify({ title: title.trim(), cycle_id: cycleId, subteam: "general" }),
      });
      bgReload();
    } catch (err) {
      toast(t((err as Error).message), "err");
    }
  }

  async function act(c: Cycle, action: "approve" | "reject" | "complete" | "resubmit" | "marklate") {
    let note: string | null = "";
    if (action === "reject") {
      note = await prompt({ title: `駁回「${c.title}」`, label: "給提案人的備註（可留空）" });
      if (note === null) return;
    }
    try {
      const r = await api<{ status: CycleStatus }>(`/api/cycles/${c.id}`, {
        method: "PATCH",
        body: JSON.stringify({ action, note: note ?? "" }),
      });
      toast(
        action === "approve"
          ? r.status === "active" ? "" : t("已核准，送老師最終審批")
          : action === "reject" ? t("已駁回")
          : action === "complete" ? t("週期已完成，辛苦了！")
          : action === "marklate" ? t("已標記為遲交")
          : t("已重新提交"),
        "ok"
      );
      await load();
    } catch (err) {
      toast(t((err as Error).message), "err");
    }
  }

  async function removeCycle(c: Cycle) {
    const ok = await confirm({ title: `${t("刪除週期「")}${c.title}${t("」？")}`, message: t("任務不會被刪除，只會解除關聯。"), confirmText: t("刪除"), danger: true });
    if (!ok) return;
    try {
      await api(`/api/cycles/${c.id}`, { method: "DELETE" });
      toast(t("已刪除"));
      await load();
    } catch (err) {
      toast(t((err as Error).message), "err");
    }
  }

  function canDecide(c: Cycle): "approve" | "wait" | false {
    if (c.status === "pending_leader") return isStaff(myRole) ? "approve" : false;
    if (c.status === "pending_teacher") return myRole === "teacher" ? "approve" : "wait";
    return false;
  }

  // 幹部統計：每個成員參與（提案或合作）的週期數量
  const stats = invitableMembers
    .map((m) => {
      const mine = cycles.filter(
        (c) => c.proposer_id === m.id || c.members.some((x) => x.id === m.id)
      );
      return {
        member: m,
        active: mine.filter((c) => c.status === "active").length,
        approved: mine.filter((c) => c.status === "approved").length,
        late: mine.filter((c) => c.status === "late").length,
        pending: mine.filter((c) => c.status.startsWith("pending")).length,
        completed: mine.filter((c) => c.status === "completed").length,
        total: mine.length,
      };
    })
    .sort((a, b) => b.total - a.total || a.member.id - b.member.id);

  return (
    <div className="space-y-5">
      <CycleTimeline cycles={cycles} today={today} />

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-bold">{t("開發週期")}</h1>
        <span className="text-sm text-ink-tertiary">
          {t("提案 → 隊長審批 → 老師審批 → 進行中；任務在週期卡片內直接新增")}
        </span>
        <button className={`${BTN} ml-auto`} onClick={() => setForm({ editing: null })}>
          {t("＋ 提案新週期")}
        </button>
      </div>

      {modal && (
        <TaskModal
          key={modal.mode === "edit" ? "e" + modal.task.id : "c" + modal.cycleId}
          mode={modal.mode === "edit" ? "edit" : "create"}
          task={modal.mode === "edit" ? modal.task : null}
          cycleId={(modal.mode === "edit" ? modal.task.cycle_id : modal.cycleId) ?? 0}
          cycleTitle={
            modal.mode === "edit"
              ? (cycles.find((x) => x.id === modal.task.cycle_id)?.title ?? "")
              : (cycles.find((x) => x.id === modal.cycleId)?.title ?? "")
          }
          members={members}
          subteams={subteams}
          me={me}
          onClose={() => setModal(null)}
          onChanged={load}
        />
      )}

      {form && (
        <CycleForm
          editing={form.editing}
          members={invitableMembers.filter((m) => m.id !== meId)}
          me={me}
          onClose={() => setForm(null)}
          onSaved={async () => {
            setForm(null);
            await load();
          }}
        />
      )}

      {isStaff(myRole) && pending.length > 0 && (
        <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
          <h2 className="mb-3 font-bold text-amber-300">{t("待審批")}（{pending.length}）</h2>
          <div className="space-y-3">
            {pending.map((c) => {
              const dec = canDecide(c);
              return (
                <div key={c.id} className="rounded-xl border border-hairline bg-surface-1/70 p-4">
                  <CycleHead c={c} today={today} />
                  <div className="mt-2 flex flex-wrap gap-2">
                    {dec === "approve" && (
                      <>
                        <button className={BTN} onClick={() => act(c, "approve")}>
                          {c.status === "pending_teacher" ? t("✓ 批准（標記已核准）") : t("✓ 批准，送老師審批")}
                        </button>
                        <button className={`${BTN_GHOST} text-rose-300`} onClick={() => act(c, "reject")}>
                          {t("✕ 駁回")}
                        </button>
                      </>
                    )}
                    {dec === "wait" && <p className="text-xs text-ink-tertiary">{t("等待老師審批中")}</p>}
                    <button className={`${BTN_GHOST} ml-auto`} onClick={() => setForm({ editing: c })}>
                      {t("編輯")}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-bold">{t("進行中")}（{active.length}）</h2>
        {active.length === 0 && (
          <p className="rounded-2xl border border-hairline bg-surface-1 py-10 text-center text-sm text-ink-tertiary">
            {t("目前沒有進行中的週期")}
          </p>
        )}
        {active.map((c) => (
          <div key={c.id} className="rounded-2xl border border-hairline bg-surface-1 p-4">
            <CycleHead c={c} today={today} />
            <TaskProgress done={c.task_done} total={c.task_total} />
            <div className="mt-2 flex flex-wrap gap-2">
              {(isStaff(me.role) || c.proposer_id === me.id) && (
                <button className={BTN_GHOST} onClick={() => act(c, "complete")}>
                  {t("🏁 標記完成")}
                </button>
              )}
              {isStaff(me.role) && (
                <button className={`${BTN_GHOST} text-ink-tertiary`} onClick={() => removeCycle(c)}>
                  {t("刪除")}
                </button>
              )}
            </div>
          </div>
        ))}
      </section>

      {approvedNotStarted.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-bold text-emerald-300">{t("已核准")}（{approvedNotStarted.length}）</h2>
          {approvedNotStarted.map((c) => (
            <div key={c.id} className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
              <CycleHead c={c} today={today} />
              <TaskProgress done={c.task_done} total={c.task_total} />
              <p className="mt-2 text-xs text-ink-tertiary">
                {t("開始日期")} {fmtMD(c.start_date)} {t("後自動進入進行中")}
              </p>
            </div>
          ))}
        </section>
      )}

      {late.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-bold text-orange-300">{t("遲交")}（{late.length}）</h2>
          {late.map((c) => (
            <div key={c.id} className="rounded-2xl border border-orange-400/30 bg-orange-400/5 p-4">
              <CycleHead c={c} today={today} />
              <TaskProgress done={c.task_done} total={c.task_total} />
              <CycleTasks
                cycle={c}
                tasks={(tasks ?? []).filter((x) => x.cycle_id === c.id)}
                expanded={expanded.has(c.id)}
                onToggleExpand={() =>
                  setExpanded((prev) => {
                    const n = new Set(prev);
                    n.has(c.id) ? n.delete(c.id) : n.add(c.id);
                    return n;
                  })
                }
                me={me}
                onChanged={load}
                onEdit={(task) => setModal({ mode: "edit", task })}
                onToggleDone={(task) => toggleTaskDone(task)}
                onQuickAdd={(title) => quickAddTask(c.id, title)}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {(isStaff(myRole) || c.proposer_id === meId) && (
                  <button className={BTN_GHOST} onClick={() => act(c, "complete")}>
                    🏁 {t("標記完成")}
                  </button>
                )}
                {isStaff(myRole) && (
                  <button className={`${BTN_GHOST} text-ink-tertiary`} onClick={() => removeCycle(c)}>
                    {t("刪除")}
                  </button>
                )}
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="rounded-2xl border border-hairline bg-surface-1 p-5">
        <h2 className="mb-3 font-bold">{t("成員週期統計")}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-tertiary">
                  <th className="px-2 py-2 font-medium">#</th>
                  <th className="px-2 py-2 font-medium">{t("成員")}</th>
                  <th className="px-2 py-2 font-medium">{t("進行中")}</th>
                  <th className="px-2 py-2 font-medium">{t("已核准")}</th>
                  <th className="px-2 py-2 font-medium">{t("遲交")}</th>
                  <th className="px-2 py-2 font-medium">{t("審批中")}</th>
                  <th className="px-2 py-2 font-medium">{t("已完成")}</th>
                  <th className="px-2 py-2 font-medium">{t("總計")}</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s, i) => (
                  <tr key={s.member.id} className="border-t border-hairline/60">
                    <td className="px-2 py-2.5 tabular-nums text-ink-tertiary">{i + 1}</td>
                    <td className="px-2 py-2.5">{s.member.display_name}</td>
                    <td className="px-2 py-2.5 tabular-nums text-primary-hover">{s.active}</td>
                    <td className="px-2 py-2.5 tabular-nums text-emerald-300">{s.approved}</td>
                    <td className="px-2 py-2.5 tabular-nums text-orange-300">{s.late}</td>
                    <td className="px-2 py-2.5 tabular-nums text-amber-300">{s.pending}</td>
                    <td className="px-2 py-2.5 tabular-nums text-emerald-300">{s.completed}</td>
                    <td className="px-2 py-2.5 tabular-nums font-bold">{s.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-ink-tertiary">{t("統計包含「提案」與「作為合作成員」的週期；已核准的週期在開始日自動轉為進行中。")}</p>
      </section>

      {history.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-bold text-ink-subtle">{t("歷史")}（{history.length}）</h2>
          {history.map((c) => (
            <div key={c.id} className="rounded-2xl border border-hairline bg-surface-1 p-4">
              <CycleHead c={c} today={today} />
              {c.status === "rejected" && c.proposer_id === me.id && (
                <button className={`${BTN_GHOST} mt-2`} onClick={() => act(c, "resubmit")}>
                  {t("修改後重新提交")}
                </button>
              )}
              {(isStaff(me.role) || (c.proposer_id === meId && c.status === "rejected")) && (
                <button className="ml-3 text-xs text-ink-tertiary hover:text-rose-400" onClick={() => removeCycle(c)}>
                  {t("刪除")}
                </button>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function CycleHead({ c, today }: { c: Cycle; today: string }) {
  const { t } = useI18n();
  const st = cycleStatus(c.status);
  const left = daysBetween(today, c.end_date);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${st.chip}`}>
          {st.label}
        </span>
        <span className="font-bold">{c.title}</span>
        <span className="ml-auto text-xs tabular-nums text-ink-subtle">
          {fmtMD(c.start_date)} ~ {fmtMD(c.end_date)}
          {c.status === "active" && (
            <span className={`ml-2 ${left < 0 ? "text-rose-400" : left <= 3 ? "text-amber-300" : "text-ink-tertiary"}`}>
              {left < 0 ? `${t("已超過結束日")} ${-left} ${t("天")}` : `${t("剩")} ${left} ${t("天")}`}
            </span>
          )}
        </span>
      </div>
      {c.description && <p className="mt-1 text-sm text-ink-subtle">{c.description}</p>}
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-tertiary">
        <span>{t("提案")}：{c.proposer_name ?? "—"}</span>
        {c.members.length > 0 && (
          <span className="flex flex-wrap items-center gap-1">
            · {t("合作")}：
            {c.members.map((m) => (
              <span key={m.id} className={`${CHIP} border-hairline-strong text-ink-muted`}>
                {m.display_name}
              </span>
            ))}
          </span>
        )}
      </div>
      {(c.status === "rejected" || c.status === "completed") && c.decided_note && (
        <p className="mt-1 text-xs text-ink-subtle">{t("審批備註")}：{c.decided_note}</p>
      )}
    </div>
  );
}

function TaskProgress({ done, total }: { done: number; total: number }) {
  const { t } = useI18n();
  if (total === 0) {
    return <p className="mt-2 text-xs text-ink-tertiary">{t("尚未新增任務，用下方輸入快速加入")}</p>;
  }
  const pct = Math.round((done / total) * 100);
  return (
    <div className="mt-2 flex items-center gap-3 text-xs text-ink-subtle">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <span className="tabular-nums">
        {t("任務")} {done}/{total}（{pct}%）
      </span>
    </div>
  );
}

function CycleForm({
  editing,
  members,
  me,
  onClose,
  onSaved,
}: {
  editing: Cycle | null;
  members: Member[];
  me: Me;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const { toast } = useDialogs();
  const [title, setTitle] = useState(editing?.title ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [start, setStart] = useState(editing?.start_date ?? "");
  const [end, setEnd] = useState(editing?.end_date ?? "");
  const [picked, setPicked] = useState<number[]>(
    editing?.members.filter((m) => m.id !== me.id).map((m) => m.id) ?? []
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !start || !end) {
      setErr(t("請填寫名稱與起訖日期"));
      return;
    }
    if (end < start) {
      setErr(t("結束日期不能早於開始日期"));
      return;
    }
    setBusy(true);
    setErr("");
    try {
      if (editing) {
        await api(`/api/cycles/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify({ title: title.trim(), description, start_date: start, end_date: end, member_ids: picked }),
        });
        toast(t("已更新提案"));
      } else {
        await api("/api/cycles", {
          method: "POST",
          body: JSON.stringify({ title: title.trim(), description, start_date: start, end_date: end, member_ids: picked }),
        });
        toast(t("提案已送出，等審批結果"));
      }
      onSaved();
    } catch (error) {
      setErr((error as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-hairline bg-surface-1 p-5">
      <h2 className="font-bold">{editing ? `${t("編輯週期")}：${editing.title}` : t("提案新開發週期")}</h2>
      <div className="grid gap-3 sm:grid-cols-[1fr_10rem_10rem]">
        <input className={INPUT_CLS} placeholder={t("週期名稱，例如：推進系統重構 *")} value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className={INPUT_CLS} type="date" value={start} onChange={(e) => setStart(e.target.value)} title={t("開始日期")} />
        <input className={INPUT_CLS} type="date" value={end} onChange={(e) => setEnd(e.target.value)} title={t("結束日期")} />
      </div>
      <textarea
        className={`${INPUT_CLS} min-h-16 resize-y`}
        placeholder={t("這個週期要做什麼？目標是什麼？（選填）")}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <div>
        <p className="mb-1 text-sm text-ink-subtle">{t("合作成員（可多選）")}</p>
        {members.length === 0 ? (
          <p className="text-xs text-ink-tertiary">{t("目前沒有其他成員可選")}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {members.map((m) => {
              const on = picked.includes(m.id);
              return (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => setPicked(on ? picked.filter((x) => x !== m.id) : [...picked, m.id])}
                  className={`rounded-full border px-3 py-1 text-sm transition ${
                    on
                      ? "border-primary/60 bg-primary/15 text-primary-hover"
                      : "border-hairline-strong text-ink-subtle hover:border-hairline-strong"
                  }`}
                >
                  {on ? "✓ " : "+ "}
                  {m.display_name}
                </button>
              );
            })}
          </div>
        )}
      </div>
      {err && (
        <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{err}</p>
      )}
      <div className="flex gap-2">
        <button className={BTN} disabled={busy}>
          {busy ? t("送出中…") : editing ? t("儲存變更") : t("送出提案")}
        </button>
        <button type="button" className={BTN_GHOST} onClick={onClose}>
          {t("取消")}
        </button>
      </div>
    </form>
  );
}


function CycleTasks({
  cycle,
  tasks,
  expanded,
  onToggleExpand,
  me,
  onChanged,
  onEdit,
  onToggleDone,
  onQuickAdd,
}: {
  cycle: Cycle;
  tasks: Task[];
  expanded: boolean;
  onToggleExpand: () => void;
  me: Me;
  onChanged: () => void;
  onEdit: (task: Task) => void;
  onToggleDone: (task: Task) => void;
  onQuickAdd: (title: string) => void;
}) {
  const { t } = useI18n();
  const { toast } = useDialogs();
  const [quick, setQuick] = useState("");

  // 樂觀更新由父層處理


  async function quickAdd() {
    if (!quick.trim()) return;
    try {
      await api("/api/tasks", {
        method: "POST",
        body: JSON.stringify({ title: quick.trim(), cycle_id: cycle.id, subteam: "general" }),
      });
      setQuick("");
      onChanged();
    } catch (err) {
      toast(t((err as Error).message), "err");
    }
  }

  return (
    <div className="mt-2">
      <button
        className="text-xs text-ink-subtle transition hover:text-ink"
        onClick={onToggleExpand}
      >
        {expanded ? "▾" : "▸"} {t("任務")}（{tasks.length}）
      </button>
      {expanded && (
        <div className="mt-2 space-y-1.5">
          {tasks.map((task) => (
            <div key={task.id} className="flex items-center gap-2 rounded-lg bg-surface-2/50 px-2.5 py-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={task.status === "done"}
                onChange={() => onToggleDone(task)}
                title={t("任務")}
              />
              <button
                className="flex-1 truncate text-left text-ink hover:text-ink"
                onClick={() => onEdit(task)}
              >
                <span className={task.status === "done" ? "text-ink-tertiary line-through" : ""}>{task.title}</span>
              </button>
              {task.due_date && (
                <span className="shrink-0 text-xs text-ink-tertiary">{fmtMD(task.due_date)}</span>
              )}
              {task.assignee_name && (
                <span className="shrink-0 text-xs text-ink-tertiary">{task.assignee_name}</span>
              )}
            </div>
          ))}
          {tasks.length === 0 && (
            <p className="rounded-lg bg-surface-2/40 px-2.5 py-2 text-xs text-ink-tertiary">
              {t("尚未新增任務，用下方輸入快速加入")}
            </p>
          )}
          <div className="flex gap-2">
            <input
              className="w-full rounded-lg border border-hairline-strong bg-surface-1 px-3 py-1.5 text-sm text-ink placeholder:text-ink-tertiary focus:border-primary focus:outline-none"
              placeholder={t("＋ 新任務")}
              value={quick}
              onChange={(e) => setQuick(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && quickAdd()}
            />
            <button
              className="rounded-lg bg-surface-2 px-3 py-1.5 text-sm text-ink transition hover:bg-surface-3"
              onClick={quickAdd}
            >
              {t("加入")}
            </button>
          </div>
          <p className="text-xs text-ink-tertiary">
            {t("點任務名稱可編輯詳情（負責人、截止日、子任務）")}
          </p>
        </div>
      )}
    </div>
  );
}
