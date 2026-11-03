"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  CalendarRangeIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  ClockAlertIcon,
  HandIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  RotateCcwIcon,
  Trash2Icon,
  UsersIcon,
  XIcon,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { tt } from "@/lib/i18n-core";
import TaskModal from "@/components/TaskModal";
import CycleTimeline from "@/components/CycleTimeline";
import { useSubteams } from "@/lib/subteams";
import { api } from "@/lib/api-client";
import { useDialogs } from "@/components/ui/Dialogs";
import { PageError, PageLoading } from "@/components/PageState";
import { INPUT_CLS, cycleStatus } from "@/lib/ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { BoardHeader } from "@/components/board/BoardHeader";
import { Label, StatusIcon } from "@/components/board/ColorCell";
import { Avatar, AvatarStack, peopleSummary, shortName } from "@/components/board/PersonCell";
import { Choice, Progress } from "@/components/tasks/shared";
import { isStaff } from "@/lib/roles";
import { daysBetween, fmtMD, todayStr } from "@/lib/date";
import { isAssignedTo, type Cycle, type CycleStatus, type Me, type Member, type Task } from "@/lib/types";

type Action = "approve" | "reject" | "complete" | "resubmit" | "marklate";

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
  const [modal, setModal] = useState<{ mode: "create"; cycleId: number } | { mode: "edit"; task: Task } | null>(null);
  const [error, setError] = useState("");
  const [fSubteam, setFSubteam] = useState("all");
  const [fAssignee, setFAssignee] = useState("all");
  const [showHistory, setShowHistory] = useState(false);
  const [showStats, setShowStats] = useState(false);

  const load = useCallback(async () => {
    const [c, m, u, tk] = await Promise.all([
      api<{ cycles: Cycle[] }>("/api/cycles"),
      api<{ members: Member[] }>("/api/members"),
      api<{ user: Me | null }>("/api/auth/me"),
      api<{ tasks: Task[] }>("/api/tasks"),
    ]);
    setCycles(c.cycles);
    setMembers(m.members);
    setTasks(tk.tasks);
    setMe(u.user);
  }, []);
  const bgReload = () => {
    load().catch(() => {});
  };

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, [load]);

  useEffect(() => {
    function openQueued() {
      const raw = sessionStorage.getItem("rov-open-task");
      if (!raw || !tasks) return;
      const task = tasks.find((x) => x.id === Number(raw));
      if (!task) return;
      sessionStorage.removeItem("rov-open-task");
      setModal({ mode: "edit", task });
      if (task.cycle_id) setExpanded((prev) => new Set(prev).add(task.cycle_id as number));
    }
    openQueued();
    window.addEventListener("rov-open-task", openQueued);
    return () => window.removeEventListener("rov-open-task", openQueued);
  }, [tasks]);

  if (error) return <PageError message={error} />;
  if (!cycles || !me) return <PageLoading label={t("載入中…")} />;

  const today = todayStr();
  const staff = isStaff(me.role);
  const meId = me.id;
  const allTasks = tasks ?? [];

  function cycleVisible(c: Cycle) {
    if (fAssignee !== "all") {
      const id = Number(fAssignee);
      const onCycle = c.proposer_id === id || c.members.some((m) => m.id === id);
      const onTask = allTasks.some((task) => task.cycle_id === c.id && isAssignedTo(task, id));
      if (!onCycle && !onTask) return false;
    }
    if (fSubteam !== "all") {
      const ids = [c.proposer_id, ...c.members.map((m) => m.id)].filter((x): x is number => x != null);
      const memberHit = ids.some((id) => members.find((m) => m.id === id)?.subteam === fSubteam);
      const taskHit = allTasks.some((task) => task.cycle_id === c.id && task.subteam === fSubteam);
      if (!memberHit && !taskHit) return false;
    }
    return true;
  }

  const visible = cycles.filter(cycleVisible);
  const pending = visible.filter((c) => c.status === "pending_leader" || c.status === "pending_teacher");
  const active = visible.filter((c) => c.status === "active");
  const upcoming = visible.filter((c) => c.status === "approved");
  const late = visible.filter((c) => c.status === "late");
  const history = visible.filter((c) => c.status === "completed" || c.status === "rejected");

  // Demo and teacher accounts are left out of invitations and stats.
  const DEMO_USERNAMES = ["leader", "member", "teacher", "dashboard"];
  const invitableMembers = members.filter((m) => m.role !== "teacher" && !DEMO_USERNAMES.includes(m.username));
  // Open to claim: posted by a leader, not yet claimed, approved or active, and not posted by me.
  const claimableOpen = visible.filter(
    (c) => c.claimable && !c.claimed_by && (c.status === "active" || c.status === "approved") && c.proposer_id !== meId
  );
  const filtering = fSubteam !== "all" || fAssignee !== "all";

  // Optimistic tick: update the screen now, sync in the background, roll back on failure.
  async function toggleTaskDone(task: Task) {
    const nextStatus = task.status === "done" ? "doing" : "done";
    const snapshot = tasks;
    setTasks((prev) =>
      prev!.map((x) => (x.id === task.id ? { ...x, status: nextStatus, completed_at: nextStatus === "done" ? new Date().toISOString() : null } : x))
    );
    setCycles((prev) =>
      prev!.map((c) => {
        if (c.id !== task.cycle_id) return c;
        const delta = nextStatus === "done" ? 1 : task.status === "done" ? -1 : 0;
        return { ...c, task_done: Math.max(0, c.task_done + delta) };
      })
    );
    try {
      await api(`/api/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ status: nextStatus, version: task.version }) });
      bgReload();
    } catch (err) {
      setTasks(snapshot);
      toast(t((err as Error).message), "err");
    }
  }

  async function act(c: Cycle, action: Action) {
    let note: string | null = "";
    if (action === "reject") {
      note = await prompt({ title: tt(`駁回「${c.title}」`, `Reject "${c.title}"`), label: tt("給提案人的備註（可留空）", "Note for the proposer (optional)") });
      if (note === null) return;
    }
    if (action === "complete") {
      const open = allTasks.filter((task) => task.cycle_id === c.id && task.status !== "done").length;
      const ok = await confirm({
        title: tt(`將「${c.title}」標記為完成？`, `Mark "${c.title}" as complete?`),
        message: open
          ? tt(`還有 ${open} 項任務未完成。完成後專案會移到歷史，無法再加入任務。`, `${open} task${open === 1 ? " is" : "s are"} still open. Completed projects move to history and can't take new tasks.`)
          : tt("完成後專案會移到歷史，無法再加入任務。", "Completed projects move to history and can't take new tasks."),
        confirmText: tt("標記完成", "Mark complete"),
      });
      if (!ok) return;
    }
    try {
      const r = await api<{ status: CycleStatus }>(`/api/cycles/${c.id}`, { method: "PATCH", body: JSON.stringify({ action, note: note ?? "" }) });
      const message =
        action === "approve"
          ? r.status === "approved" || r.status === "active"
            ? tt("已核准", "Approved")
            : t("已核准，送老師最終審批")
          : action === "reject"
            ? t("已駁回")
            : action === "complete"
              ? t("專案已完成，辛苦了！")
              : action === "marklate"
                ? t("已標記為遲交")
                : t("已重新提交");
      toast(message, "ok");
      await load();
    } catch (err) {
      toast(t((err as Error).message), "err");
    }
  }

  async function claim(c: Cycle) {
    try {
      await api(`/api/cycles/${c.id}`, { method: "PATCH", body: JSON.stringify({ action: "claim" }) });
      toast(t("認領成功！專案已加入你的名下"), "ok");
      await load();
    } catch (err) {
      toast(t((err as Error).message), "err");
    }
  }

  async function removeCycle(c: Cycle) {
    const ok = await confirm({ title: `${t("刪除專案「")}${c.title}${t("」？")}`, message: t("任務不會被刪除，只會解除關聯。"), confirmText: t("刪除"), danger: true });
    if (!ok) return;
    try {
      await api(`/api/cycles/${c.id}`, { method: "DELETE" });
      toast(t("已刪除"));
      await load();
    } catch (err) {
      toast(t((err as Error).message), "err");
    }
  }

  function toggleExpand(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Per-member project counts (proposed or collaborating).
  const stats = invitableMembers
    .map((m) => {
      const mine = cycles.filter((c) => (c.proposer_id === m.id && !(c.claimable && !c.count_for_leader)) || c.members.some((x) => x.id === m.id));
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

  const card = (c: Cycle, extra?: ReactNode) => {
    const canManage = staff || c.proposer_id === meId;
    const decision = c.status === "pending_leader" ? (staff ? "approve" : null) : c.status === "pending_teacher" ? (me.role === "teacher" ? "approve" : "wait") : null;
    return (
      <ProjectCard
        key={c.id}
        cycle={c}
        today={today}
        tasks={allTasks.filter((task) => task.cycle_id === c.id)}
        expanded={expanded.has(c.id)}
        onToggle={() => toggleExpand(c.id)}
        canComplete={canManage && ["active", "late", "approved"].includes(c.status)}
        onComplete={() => act(c, "complete")}
        decision={decision}
        onApprove={() => act(c, "approve")}
        onReject={() => act(c, "reject")}
        menu={[
          ...(c.status.startsWith("pending") && canManage ? [{ label: tt("編輯", "Edit"), icon: <PencilIcon />, onSelect: () => setForm({ editing: c }) }] : []),
          ...(staff && c.status === "active" && c.end_date < today ? [{ label: tt("標記遲交", "Mark late"), icon: <ClockAlertIcon />, onSelect: () => act(c, "marklate") }] : []),
          ...(c.status === "rejected" && c.proposer_id === meId ? [{ label: tt("修改後重新提交", "Resubmit"), icon: <RotateCcwIcon />, onSelect: () => act(c, "resubmit") }] : []),
          ...(staff || (c.proposer_id === meId && c.status === "rejected")
            ? [{ label: tt("刪除專案", "Delete project"), icon: <Trash2Icon />, danger: true, onSelect: () => removeCycle(c) }]
            : []),
        ]}
        onOpenTask={(task) => setModal({ mode: "edit", task })}
        onToggleDone={toggleTaskDone}
        onChanged={bgReload}
        extra={extra}
      />
    );
  };

  const section = (title: string, color: string, list: Cycle[], render: (c: Cycle) => ReactNode, hint?: string) =>
    list.length > 0 && (
      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold">
          <span className="size-2.5 rounded-full" style={{ background: color }} />
          {title}
          <span className="rounded-full bg-muted px-2 text-xs leading-5 font-medium tabular-nums text-muted-foreground">{list.length}</span>
          {hint && <span className="hidden truncate text-sm font-normal text-muted-foreground sm:inline">{hint}</span>}
        </h2>
        {list.map(render)}
      </section>
    );

  return (
    <div className="flex w-full min-w-0 flex-col gap-6 pb-24">
      <BoardHeader
        title={t("專案")}
        subtitle={tt(`${active.length} 個進行中 · ${upcoming.length} 個即將開始 · ${pending.length} 個審批中`, `${active.length} active · ${upcoming.length} upcoming · ${pending.length} in review`)}
        action={
          <Button onClick={() => setForm({ editing: null })}>
            <PlusIcon /> {tt("提案新專案", "Propose project")}
          </Button>
        }
        filters={
          <>
            <Choice
              value={fSubteam}
              onChange={setFSubteam}
              options={[{ value: "all", label: t("全部組別") }, ...subteams.map((s) => ({ value: s.key, label: s.label }))]}
              ariaLabel={tt("組別", "Subteam")}
            />
            <Choice
              value={fAssignee}
              onChange={setFAssignee}
              options={[{ value: "all", label: t("全部成員") }, ...invitableMembers.map((m) => ({ value: String(m.id), label: shortName(m.display_name) }))]}
              ariaLabel={tt("成員", "Member")}
            />
            {filtering && (
              <Button variant="ghost" size="sm" onClick={() => { setFSubteam("all"); setFAssignee("all"); }}>
                <XIcon /> {tt("清除篩選", "Clear filters")}
              </Button>
            )}
            <span className="ml-auto text-xs text-muted-foreground">{t("提案 → 隊長審批 → 老師審批 → 進行中；任務在專案卡片內直接新增")}</span>
          </>
        }
      />

      {modal && (
        <TaskModal
          key={modal.mode === "edit" ? "e" + modal.task.id : "c" + modal.cycleId}
          mode={modal.mode === "edit" ? "edit" : "create"}
          task={modal.mode === "edit" ? modal.task : null}
          cycleId={(modal.mode === "edit" ? modal.task.cycle_id : modal.cycleId) ?? 0}
          cycleTitle={cycles.find((x) => x.id === (modal.mode === "edit" ? modal.task.cycle_id : modal.cycleId))?.title ?? ""}
          members={invitableMembers}
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

      <CycleTimeline cycles={visible} today={today} />

      {section(tt("待審批", "Needs review"), "var(--c-orange)", staff || me.role === "teacher" ? pending : pending.filter((c) => c.proposer_id === meId || c.members.some((m) => m.id === meId)), (c) => card(c))}

      {section(tt("可認領", "Open to claim"), "var(--c-blue)", claimableOpen, (c) =>
        card(
          c,
          !staff && (
            <Button size="sm" onClick={() => claim(c)}>
              <HandIcon /> {t("認領")}
            </Button>
          )
        )
      )}

      {section(tt("遲交", "Late"), "var(--c-red)", late, (c) => card(c))}

      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold">
          <span className="size-2.5 rounded-full" style={{ background: "var(--c-yellow)" }} />
          {tt("進行中", "Active")}
          <span className="rounded-full bg-muted px-2 text-xs leading-5 font-medium tabular-nums text-muted-foreground">{active.length}</span>
        </h2>
        {active.length === 0 && (
          <p className="rounded-[6px] border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            {filtering ? t("沒有符合的結果") : t("目前沒有進行中的專案")}
          </p>
        )}
        {active.map((c) => card(c))}
      </section>

      {section(tt("即將開始", "Upcoming"), "var(--c-green)", upcoming, (c) => card(c), tt("已核准，在開始日自動進入進行中", "Approved; becomes active on its start date"))}

      {history.length > 0 && (
        <section className="flex flex-col gap-3">
          <button type="button" onClick={() => setShowHistory((v) => !v)} className="flex items-center gap-2 self-start rounded-[6px] px-1 text-[15px] font-semibold text-muted-foreground hover:text-foreground">
            <ChevronDownIcon className="size-4 transition-transform" style={{ transform: showHistory ? "none" : "rotate(-90deg)" }} />
            {tt("已完成與已駁回", "Completed & rejected")}
            <span className="rounded-full bg-muted px-2 text-xs leading-5 font-medium tabular-nums">{history.length}</span>
          </button>
          {showHistory && history.map((c) => card(c))}
        </section>
      )}

      <section className="overflow-hidden rounded-[6px] border border-border bg-card">
        <button type="button" onClick={() => setShowStats((v) => !v)} className="flex h-11 w-full items-center gap-2 px-4 text-left text-[15px] font-semibold hover:bg-muted/60">
          <ChevronDownIcon className="size-4 text-muted-foreground transition-transform" style={{ transform: showStats ? "none" : "rotate(-90deg)" }} />
          <UsersIcon className="size-4 text-muted-foreground" /> {t("成員專案統計")}
        </button>
        {showStats && (
          <div className="overflow-x-auto border-t border-border">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-semibold">{t("成員")}</th>
                  <th className="px-2 py-2 font-semibold">{t("進行中")}</th>
                  <th className="px-2 py-2 font-semibold">{t("已核准")}</th>
                  <th className="px-2 py-2 font-semibold">{t("遲交")}</th>
                  <th className="px-2 py-2 font-semibold">{t("審批中")}</th>
                  <th className="px-2 py-2 font-semibold">{t("已完成")}</th>
                  <th className="px-2 py-2 font-semibold">{t("總計")}</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s) => (
                  <tr key={s.member.id} className="border-t border-border">
                    <td className="px-4 py-2">
                      <span className="flex items-center gap-2">
                        <Avatar name={s.member.display_name} size={22} />
                        <span className="truncate">{shortName(s.member.display_name)}</span>
                      </span>
                    </td>
                    <td className="px-2 py-2 tabular-nums">{s.active}</td>
                    <td className="px-2 py-2 tabular-nums">{s.approved}</td>
                    <td className={`px-2 py-2 tabular-nums ${s.late ? "text-destructive" : ""}`}>{s.late}</td>
                    <td className="px-2 py-2 tabular-nums">{s.pending}</td>
                    <td className="px-2 py-2 tabular-nums">{s.completed}</td>
                    <td className="px-2 py-2 font-semibold tabular-nums">{s.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">{t("統計包含「提案」與「作為合作成員」的專案；已核准的專案在開始日自動轉為進行中。")}</p>
          </div>
        )}
      </section>
    </div>
  );
}

type MenuEntry = { label: string; icon: ReactNode; danger?: boolean; onSelect: () => void };

function ProjectCard({
  cycle: c,
  today,
  tasks,
  expanded,
  onToggle,
  canComplete,
  onComplete,
  decision,
  onApprove,
  onReject,
  menu,
  onOpenTask,
  onToggleDone,
  onChanged,
  extra,
}: {
  cycle: Cycle;
  today: string;
  tasks: Task[];
  expanded: boolean;
  onToggle: () => void;
  canComplete: boolean;
  onComplete: () => void;
  decision: "approve" | "wait" | null;
  onApprove: () => void;
  onReject: () => void;
  menu: MenuEntry[];
  onOpenTask: (task: Task) => void;
  onToggleDone: (task: Task) => void;
  onChanged: () => void;
  extra?: ReactNode;
}) {
  const { t } = useI18n();
  const st = cycleStatus(c.status);
  const left = daysBetween(today, c.end_date);
  const running = c.status === "active" || c.status === "late";
  const people = [...(c.proposer_name ? [{ id: c.proposer_id ?? 0, display_name: c.proposer_name }] : []), ...c.members.filter((m) => m.id !== c.proposer_id)];
  const ordered = [...tasks].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
  const closed = c.status === "completed" || c.status === "rejected";

  return (
    <article className="min-w-0 overflow-hidden rounded-[8px] border border-border bg-card transition-colors hover:border-[color-mix(in_srgb,var(--c-gray)_55%,transparent)]">
      <div className="flex flex-col gap-3 px-4 py-3.5">
        <div className="flex min-w-0 items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <Label color={st.color}>{st.label}</Label>
              <h3 className="min-w-0 truncate text-base font-semibold" title={c.title}>{c.title}</h3>
            </div>
            {c.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{c.description}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {extra}
            {decision === "approve" && (
              <>
                <Button size="sm" onClick={onApprove}>
                  <CheckCircle2Icon /> {tt("批准", "Approve")}
                </Button>
                <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={onReject}>
                  <XIcon /> {tt("駁回", "Reject")}
                </Button>
              </>
            )}
            {decision === "wait" && <span className="text-xs text-muted-foreground">{t("等待老師審批中")}</span>}
            {canComplete && (
              <Button size="sm" variant="outline" onClick={onComplete} className="hover:border-[var(--c-green)] hover:text-[var(--c-green)]">
                <CheckCircle2Icon /> {tt("標記完成", "Mark complete")}
              </Button>
            )}
            {menu.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger className="flex size-8 items-center justify-center rounded-[6px] text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={tt("更多", "More")}>
                  <MoreHorizontalIcon className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  {menu.map((item, i) => (
                    <span key={item.label}>
                      {item.danger && i > 0 && <DropdownMenuSeparator />}
                      <DropdownMenuItem variant={item.danger ? "destructive" : "default"} onClick={item.onSelect}>
                        {item.icon} {item.label}
                      </DropdownMenuItem>
                    </span>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 tabular-nums">
            <CalendarRangeIcon className="size-4" />
            {fmtMD(c.start_date)} – {fmtMD(c.end_date)}
            {running && (
              <span className={`ml-1 rounded-full px-2 text-xs leading-5 font-medium ${left < 0 ? "bg-[color-mix(in_srgb,var(--c-red)_16%,transparent)] text-destructive" : left <= 3 ? "bg-[color-mix(in_srgb,var(--c-yellow)_20%,transparent)] text-warning" : "bg-muted"}`}>
                {left < 0 ? tt(`逾期 ${-left} 天`, `${-left}d over`) : tt(`剩 ${left} 天`, `${left}d left`)}
              </span>
            )}
          </span>
          {people.length > 0 && (
            <span className="inline-flex min-w-0 items-center gap-2">
              <span className="flex -space-x-1.5">
                {people.slice(0, 5).map((p) => (
                  <span key={p.id} className="rounded-full ring-2 ring-card">
                    <Avatar name={p.display_name} size={22} />
                  </span>
                ))}
              </span>
              <span className="truncate">
                {people.slice(0, 2).map((p) => shortName(p.display_name)).join(", ")}
                {people.length > 2 ? ` +${people.length - 2}` : ""}
              </span>
            </span>
          )}
          {c.claimed_by_name && <span>{tt(`由 ${shortName(c.claimed_by_name)} 認領`, `Claimed by ${shortName(c.claimed_by_name)}`)}</span>}
          {c.task_total > 0 && <Progress done={c.task_done} total={c.task_total} className="ml-auto w-44" />}
        </div>
        {closed && c.decided_note && <p className="text-xs text-muted-foreground">{t("審批備註")}：{c.decided_note}</p>}
      </div>

      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex h-9 w-full items-center gap-2 border-t border-border px-4 text-left text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
      >
        <ChevronDownIcon className="size-4 transition-transform duration-150" style={{ transform: expanded ? "none" : "rotate(-90deg)" }} />
        {tt(`任務（${tasks.length}）`, `Tasks (${tasks.length})`)}
      </button>
      {expanded && <ProjectTasks cycle={c} tasks={ordered} today={today} closed={closed} onOpenTask={onOpenTask} onToggleDone={onToggleDone} onChanged={onChanged} />}
    </article>
  );
}

/** Task table inside a project: title, assignee, status, start, due and a bar showing where the task sits in the project. */
function ProjectTasks({
  cycle,
  tasks,
  today,
  closed,
  onOpenTask,
  onToggleDone,
  onChanged,
}: {
  cycle: Cycle;
  tasks: Task[];
  today: string;
  closed: boolean;
  onOpenTask: (task: Task) => void;
  onToggleDone: (task: Task) => void;
  onChanged: () => void;
}) {
  const { t } = useI18n();
  const { toast } = useDialogs();
  const [quick, setQuick] = useState("");
  const span = Math.max(1, daysBetween(cycle.start_date, cycle.end_date));
  const pos = (d: string) => Math.max(0, Math.min(100, (daysBetween(cycle.start_date, d) / span) * 100));
  const todayPos = today >= cycle.start_date && today <= cycle.end_date ? pos(today) : null;

  async function quickAdd() {
    const title = quick.trim();
    if (!title) return;
    try {
      await api("/api/tasks", { method: "POST", body: JSON.stringify({ title, cycle_id: cycle.id, subteam: "general" }) });
      setQuick("");
      onChanged();
    } catch (err) {
      toast(t((err as Error).message), "err");
    }
  }

  return (
    <div className="border-t border-border">
      <div className="overflow-x-auto">
        <table className="board-table table-fixed" style={{ minWidth: 820 }}>
          <colgroup>
            <col />
            <col style={{ width: 140 }} />
            <col style={{ width: 84 }} />
            <col style={{ width: 84 }} />
            <col style={{ width: 200 }} />
          </colgroup>
          <thead>
            <tr>
              <th className="!pl-4">{tt("標題", "Title")}</th>
              <th>{t("負責人")}</th>
              <th>{tt("開始日", "Start")}</th>
              <th>{t("截止日")}</th>
              <th>{tt("時程", "Timeline")}</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => {
              const start = task.start_date ?? null;
              const due = task.due_date;
              const from = start ?? due;
              const to = due ?? start;
              const overdue = task.status !== "done" && due != null && due < today;
              return (
                <tr key={task.id} className="group/row">
                  <td className="!pl-4">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => onToggleDone(task)}
                        className="flex shrink-0 rounded-full transition-transform hover:scale-110 active:scale-95"
                        aria-label={task.status === "done" ? tt("標記為未完成", "Mark incomplete") : tt("標記為完成", "Mark complete")}
                      >
                        <StatusIcon status={task.status} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenTask(task)}
                        title={task.title}
                        className={`min-w-0 truncate text-left hover:text-[var(--c-blue)] hover:underline hover:underline-offset-4 ${task.status === "done" ? "text-muted-foreground line-through" : ""}`}
                      >
                        {task.title}
                      </button>
                    </span>
                  </td>
                  <td>
                    {task.assignees?.length ? (
                      <span className="flex min-w-0 items-center gap-2" title={task.assignees.map((person) => person.display_name).join(", ")}>
                        <AvatarStack names={task.assignees.map((person) => person.display_name)} size={22} />
                        <span className="truncate">{peopleSummary(task.assignees.map((person) => person.display_name))}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="tabular-nums">{start ? fmtMD(start) : <span className="text-muted-foreground">—</span>}</td>
                  <td className={`tabular-nums ${overdue ? "font-medium text-destructive" : ""}`}>{due ? fmtMD(due) : <span className="text-muted-foreground">—</span>}</td>
                  <td>
                    <span className="relative block h-2 rounded-full bg-muted" title={from ? `${fmtMD(from)} – ${fmtMD(to!)}` : tt("未設定日期", "No dates")}>
                      {from && (
                        <span
                          className="absolute top-0 h-full rounded-full"
                          style={{
                            left: `${pos(from)}%`,
                            width: `max(6px, ${pos(to!) - pos(from)}%)`,
                            background: task.status === "done" ? "var(--c-purple)" : overdue ? "var(--c-red)" : "var(--c-blue)",
                          }}
                        />
                      )}
                      {todayPos != null && <span className="absolute -top-1 h-4 w-px bg-foreground/50" style={{ left: `${todayPos}%` }} />}
                    </span>
                  </td>
                </tr>
              );
            })}
            {tasks.length === 0 && (
              <tr>
                <td colSpan={5} className="!pl-4 text-sm text-muted-foreground">{t("尚未新增任務，用下方輸入快速加入")}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {!closed && (
        <form
          className="flex items-center gap-2 px-4 transition-colors focus-within:bg-muted/40"
          onSubmit={(event) => {
            event.preventDefault();
            quickAdd();
          }}
        >
          <PlusIcon className="size-4 shrink-0 text-muted-foreground" />
          <input
            value={quick}
            onChange={(event) => setQuick(event.target.value)}
            placeholder={tt("新增任務，按 Enter 加入", "Add a task, press Enter")}
            className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </form>
      )}
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
  const staffCreating = !editing && isStaff(me.role);
  const [claimable, setClaimable] = useState(false);
  const [countForLeader, setCountForLeader] = useState(true);

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
          body: JSON.stringify({
            title: title.trim(), description, start_date: start, end_date: end, member_ids: picked,
            claimable: staffCreating ? claimable : undefined,
            count_for_leader: staffCreating && claimable ? countForLeader : undefined,
          }),
        });
        toast(claimable && staffCreating ? t("已發佈，等老師審批後開放認領") : t("提案已送出，等審批結果"));
      }
      onSaved();
    } catch (error) {
      setErr((error as Error).message);
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{editing ? `${t("編輯專案")}：${editing.title}` : t("提案新專案")}</CardTitle>
      </CardHeader>
      <CardContent>
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_10rem_10rem]">
        <Input placeholder={t("專案名稱，例如：推進系統重構 *")} value={title} onChange={(e) => setTitle(e.target.value)} />
        <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} title={t("開始日期")} />
        <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} title={t("結束日期")} />
      </div>
      <textarea
        className={`${INPUT_CLS} min-h-16 resize-y`}
        placeholder={t("這個專案要做什麼？目標是什麼？（選填）")}
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
                <Button
                  type="button"
                  key={m.id}
                  variant={on ? "default" : "outline"}
                  onClick={() => setPicked(on ? picked.filter((x) => x !== m.id) : [...picked, m.id])}
                >
                  {on ? "✓ " : "+ "}
                  {m.display_name}
                </Button>
              );
            })}
          </div>
        )}
      </div>
      {err && (
        <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{err}</p>
      )}
      {staffCreating && (
        <div className="space-y-2 rounded-lg border border-hairline bg-surface-2/60 p-3">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={claimable} onChange={(e) => setClaimable(e.target.checked)} className="h-4 w-4 accent-primary" />
            {t("開放給隊員認領")}
          </label>
          {claimable && (
            <label className="flex items-center gap-2 pl-6 text-sm text-ink-subtle">
              <input type="checkbox" checked={countForLeader} onChange={(e) => setCountForLeader(e.target.checked)} className="h-4 w-4 accent-primary" />
              {t("計入隊長專案統計")}
            </label>
          )}
        </div>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? t("送出中…") : editing ? t("儲存變更") : t("送出提案")}
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          {t("取消")}
        </Button>
      </div>
    </form>
      </CardContent>
    </Card>
  );
}
