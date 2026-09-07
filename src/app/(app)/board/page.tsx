"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { fmtMD, todayStr } from "@/lib/date";
import {
  BTN,
  CHIP,
  SELECT_CLS,
  STATUSES,
  SUBTEAMS,
  SUBTEAM_CLS,
  priorityDot,
  subteamLabel,
} from "@/lib/ui";
import type { Cycle, Me, Member, MissionTask, Task, TaskStatus } from "@/lib/types";
import TaskModal from "@/components/TaskModal";
import { useI18n } from "@/lib/i18n";
import { useDialogs } from "@/components/ui/Dialogs";

export default function BoardPage() {
  const { t } = useI18n();
  const { toast } = useDialogs();
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [missions, setMissions] = useState<MissionTask[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [fSub, setFSub] = useState<string>("all");
  const [fAssignee, setFAssignee] = useState<string>("all"); // all | none | <id>
  const [modal, setModal] = useState<
    { mode: "create" } | { mode: "edit"; task: Task } | null
  >(null);
  const [dragOver, setDragOver] = useState<TaskStatus | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [t, m, ms, cy, u] = await Promise.all([
      api<{ tasks: Task[] }>("/api/tasks"),
      api<{ members: Member[] }>("/api/members"),
      api<{ missions: MissionTask[] }>("/api/missions").catch(() => ({ missions: [] as MissionTask[] })),
      api<{ cycles: Cycle[] }>("/api/cycles").catch(() => ({ cycles: [] as Cycle[] })),
      api<{ user: Me | null }>("/api/auth/me"),
    ]);
    setTasks(t.tasks);
    setMembers(m.members);
    setMissions(ms.missions);
    setCycles(cy.cycles);
    setMe(u.user);
  }, []);

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, [load]);

  if (error) {
    return (
      <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
        {error}
      </p>
    );
  }
  if (!tasks || !me) {
    return <p className="py-20 text-center text-sm text-slate-500">{t("載入中…")}</p>;
  }

  const filtered = tasks.filter(
    (t) =>
      (fSub === "all" || t.subteam === fSub) &&
      (fAssignee === "all" ||
        (fAssignee === "none" ? !t.assignee_id : t.assignee_id === Number(fAssignee)))
  );

  async function moveTask(task: Task, status: TaskStatus) {
    if (task.status === status) return;
    setTasks((prev) =>
      prev!.map((x) => (x.id === task.id ? { ...x, status } : x))
    );
    try {
      const r = await api<{ task: Task }>(`/api/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, version: task.version }),
      });
      setTasks((prev) => prev!.map((x) => (x.id === task.id ? r.task : x)));
    } catch (err) {
      setTasks((prev) =>
        prev!.map((x) => (x.id === task.id ? { ...x, status: task.status } : x))
      );
      toast(t((err as Error).message), "err");
      if ((err as Error & { status?: number }).status === 409) load();
    }
  }

  function sortByCol(a: Task, b: Task): number {
    const pr = { high: 0, medium: 1, low: 2 } as Record<string, number>;
    if (pr[a.priority] !== pr[b.priority]) return pr[a.priority] - pr[b.priority];
    if (a.due_date && b.due_date) return a.due_date < b.due_date ? -1 : 1;
    if (a.due_date) return -1;
    if (b.due_date) return 1;
    return a.id - b.id;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-bold">{t("任務看板")}</h1>
        <span className="text-sm text-slate-500">
          {t("拖曳卡片可以改變狀態；點卡片看詳情")}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <select
            className={`${SELECT_CLS} w-32`}
            value={fSub}
            onChange={(e) => setFSub(e.target.value)}
          >
            <option value="all">{t("全部組別")}</option>
            {SUBTEAMS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
          <select
            className={`${SELECT_CLS} w-32`}
            value={fAssignee}
            onChange={(e) => setFAssignee(e.target.value)}
          >
            <option value="all">{t("全部成員")}</option>
            <option value="none">{t("未指派")}</option>
            {members.map((m) => (
              <option key={m.id} value={String(m.id)}>
                {m.display_name}
              </option>
            ))}
          </select>
          <button className={BTN} onClick={() => setModal({ mode: "create" })}>
            {t("＋ 新任務")}
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {STATUSES.map((col) => {
          const cards = filtered
            .filter((t) => t.status === col.key)
            .sort(sortByCol);
          return (
            <div
              key={col.key}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(col.key);
              }}
              onDragLeave={() => setDragOver((c) => (c === col.key ? null : c))}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(null);
                const id = Number(e.dataTransfer.getData("text/plain"));
                const task = tasks.find((t) => t.id === id);
                if (task) moveTask(task, col.key);
              }}
              className={`rounded-2xl border p-3 transition ${
                dragOver === col.key
                  ? "border-cyan-500/60 bg-cyan-500/5"
                  : "border-slate-800 bg-slate-900/40"
              }`}
            >
              <div className="mb-3 flex items-center gap-2 px-1">
                <h2 className="font-bold">{col.label}</h2>
                <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                  {cards.length}
                </span>
              </div>
              <div className="space-y-2">
                {cards.map((t) => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    onOpen={() => setModal({ mode: "edit", task: t })}
                    onDragStart={(e) =>
                      e.dataTransfer.setData("text/plain", String(t.id))
                    }
                  />
                ))}
                {cards.length === 0 && (
                  <p className="py-8 text-center text-xs text-slate-600">{t("沒有任務")}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {modal && (
        <TaskModal
          key={modal.mode === "edit" ? `t${modal.task.id}` : "create"}
          mode={modal.mode}
          task={modal.mode === "edit" ? modal.task : null}
          members={members}
          missions={missions}
          cycles={cycles}
          me={me}
          onClose={() => setModal(null)}
          onChanged={() => load().catch(() => {})}
        />
      )}
    </div>
  );
}

function TaskCard({
  task,
  onOpen,
  onDragStart,
}: {
  task: Task;
  onOpen: () => void;
  onDragStart: (e: React.DragEvent) => void;
}) {
  const { t } = useI18n();
  const today = todayStr();
  const overdue = task.due_date && task.due_date < today && task.status !== "done";
  const doneCount = task.items.filter((i) => i.done).length;
  return (
    <button
      draggable
      onDragStart={onDragStart}
      onClick={onOpen}
      className="block w-full cursor-grab rounded-xl border border-slate-800 bg-slate-900 p-3 text-left transition hover:border-cyan-500/50 active:cursor-grabbing"
    >
      <div className="flex items-start gap-2">
        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${priorityDot(task.priority)}`} />
        <p
          className={`flex-1 text-sm font-medium ${
            task.status === "done" ? "text-slate-500 line-through" : ""
          }`}
        >
          {task.title}
        </p>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
        <span className={`${CHIP} ${SUBTEAM_CLS[task.subteam] ?? ""}`}>
          {subteamLabel(task.subteam)}
        </span>
        {task.assignee_name && (
          <span className={`${CHIP} border-slate-700 text-slate-300`}>
            {task.assignee_name}
          </span>
        )}
        {task.due_date && (
          <span
            className={`${CHIP} ${
              overdue
                ? "border-rose-500/40 bg-rose-500/10 text-rose-300"
                : "border-slate-700 text-slate-400"
            }`}
          >
            {overdue ? t("逾期 ") : ""}
            {fmtMD(task.due_date)}
          </span>
        )}
        {task.items.length > 0 && (
          <span className={`${CHIP} border-slate-700 text-slate-400`}>
            ✓ {doneCount}/{task.items.length}
          </span>
        )}
      </div>
    </button>
  );
}
