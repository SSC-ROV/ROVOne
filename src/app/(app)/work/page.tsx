"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SearchIcon } from "lucide-react";
import { api } from "@/lib/api-client";
import { isStaff } from "@/lib/roles";
import { useI18n } from "@/lib/i18n";
import { useSubteams } from "@/lib/subteams";
import { useDialogs } from "@/components/ui/Dialogs";
import { PageEmpty, PageError, PageLoading } from "@/components/PageState";
import { PRIORITIES, STATUSES, groupColor, priorityLabel, statusLabel } from "@/lib/ui";
import { BoardGroup } from "@/components/board/BoardGroup";
import { BoardHeader } from "@/components/board/BoardHeader";
import { PriorityCell, StatusCell } from "@/components/board/ColorCell";
import { PersonCell } from "@/components/board/PersonCell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ChecklistItem, Cycle, Me, Member, Task } from "@/lib/types";

const OPEN_STATUSES = new Set(["active", "late", "approved", "pending_leader", "pending_teacher"]);

export default function WorkPage() {
  const { t } = useI18n();
  const { subteams } = useSubteams();
  const { toast, confirm } = useDialogs();
  const [me, setMe] = useState<Me | null>(null);
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState("");
  const [view, setView] = useState("table");
  const [query, setQuery] = useState("");
  const [owner, setOwner] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [subteam, setSubteam] = useState("all");
  const [title, setTitle] = useState("");
  const [cycleId, setCycleId] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);

  const load = useCallback(async () => {
    const [userRes, taskRes, cycleRes, memberRes] = await Promise.all([
      api<{ user: Me | null }>("/api/auth/me"),
      api<{ tasks: Task[] }>("/api/tasks"),
      api<{ cycles: Cycle[] }>("/api/cycles"),
      api<{ members: Member[] }>("/api/members"),
    ]);
    setMe(userRes.user);
    setTasks(taskRes.tasks);
    setCycles(cycleRes.cycles);
    setMembers(memberRes.members);
    setCycleId((current) => {
      if (current) return current;
      const first = cycleRes.cycles.find((cycle) => OPEN_STATUSES.has(cycle.status));
      return first ? String(first.id) : "";
    });
  }, []);

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, [load]);

  useEffect(() => {
    function openQueued() {
      const raw = sessionStorage.getItem("rov-open-task");
      if (!raw || !tasks) return;
      const id = Number(raw);
      if (!tasks.some((task) => task.id === id)) return;
      sessionStorage.removeItem("rov-open-task");
      setOpenId(id);
    }
    openQueued();
    window.addEventListener("rov-open-task", openQueued);
    return () => window.removeEventListener("rov-open-task", openQueued);
  }, [tasks]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (tasks ?? []).filter((task) => {
      if (needle && !task.title.toLowerCase().includes(needle)) return false;
      if (statusFilter !== "all" && task.status !== statusFilter) return false;
      if (owner === "me" && task.assignee_id !== me?.id) return false;
      if (owner !== "all" && owner !== "me" && String(task.assignee_id ?? "") !== owner) return false;
      if (subteam !== "all" && task.subteam !== subteam) return false;
      return true;
    });
  }, [tasks, owner, subteam, me, query, statusFilter]);

  const groups = useMemo(() => {
    const grouped = [...cycles]
      .sort((a, b) => a.title.localeCompare(b.title))
      .map((cycle) => ({
        id: String(cycle.id),
        title: cycle.title,
        tasks: filtered
          .filter((task) => task.cycle_id === cycle.id)
          .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id),
      }));
    const loose = filtered.filter((task) => task.cycle_id == null || !cycles.some((cycle) => cycle.id === task.cycle_id));
    if (loose.length) grouped.push({ id: "none", title: t("未分週期"), tasks: loose });
    return grouped;
  }, [cycles, filtered, t]);

  async function patch(task: Task, body: Record<string, unknown>) {
    try {
      const res = await api<{ task: Task }>(`/api/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ ...body, version: task.version }),
      });
      setTasks((prev) =>
        (prev ?? []).map((item) =>
          item.id === task.id ? { ...item, ...res.task, items: res.task.items ?? item.items } : item
        )
      );
    } catch (err) {
      toast(t((err as Error).message), "err");
      load().catch(() => {});
    }
  }

  async function createTask(taskTitle: string, forCycleId: number) {
    try {
      await api("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          title: taskTitle.trim(),
          cycle_id: forCycleId,
          subteam: subteam === "all" ? "general" : subteam,
        }),
      });
      await load();
      return true;
    } catch (err) {
      toast(t((err as Error).message), "err");
      return false;
    }
  }

  async function addTask() {
    if (!title.trim() || !cycleId) return;
    const ok = await createTask(title, Number(cycleId));
    if (ok) setTitle("");
  }

  function canEdit(task: Task) {
    if (!me) return false;
    return isStaff(me.role) || task.assignee_id === me.id || task.created_by === me.id;
  }

  if (error) return <PageError message={error} />;
  if (!tasks || !me) return <PageLoading label={t("載入中…")} />;

  const openTask = tasks.find((task) => task.id === openId) ?? null;
  const addable = cycles.filter((cycle) => OPEN_STATUSES.has(cycle.status));
  const narrowing = query.trim() !== "" || statusFilter !== "all" || owner !== "all" || subteam !== "all";
  const shownGroups = groups
    .map((group, index) => ({ group, index }))
    .filter(({ group }) => !narrowing || group.tasks.length > 0);

  const statusOptions = STATUSES.map((item) => ({ value: item.key, label: item.label, color: item.color }));
  const priorityOptions = PRIORITIES.map((item) => ({ value: item.key, label: item.label, color: item.color }));
  const people = [{ value: "none", label: "—" }, ...members.map((member) => ({ value: String(member.id), label: member.display_name }))];

  return (
    <div className="flex w-full flex-col">
      <BoardHeader
        title={t("工作")}
        views={
          <Tabs value={view} onValueChange={setView}>
            <TabsList>
              <TabsTrigger value="table">{t("表格")}</TabsTrigger>
              <TabsTrigger value="board">{t("看板")}</TabsTrigger>
            </TabsList>
          </Tabs>
        }
        filters={
          <div className="flex min-h-8 flex-wrap items-center gap-1.5">
            <label className="flex h-7 items-center gap-1.5 rounded-[4px] px-1.5 text-muted-foreground focus-within:bg-muted">
              <SearchIcon className="size-3.5 shrink-0" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("搜尋")}
                aria-label={t("搜尋")}
                className="h-7 w-36 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground sm:w-48"
              />
            </label>
            <Choice
              value={owner}
              onChange={setOwner}
              options={[
                { value: "all", label: t("全部成員") },
                { value: "me", label: t("指派給我") },
                ...members.map((member) => ({ value: String(member.id), label: member.display_name })),
              ]}
            />
            <Choice
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "all", label: t("全部狀態") },
                ...STATUSES.map((item) => ({ value: item.key, label: item.label })),
              ]}
            />
            <Choice
              value={subteam}
              onChange={setSubteam}
              options={[
                { value: "all", label: t("全部組別") },
                ...subteams.map((item) => ({ value: item.key, label: item.label })),
              ]}
            />
            <Button size="sm" variant={owner === "me" ? "default" : "outline"} onClick={() => setOwner(owner === "me" ? "all" : "me")}>
              {t("指派給我")}
            </Button>
          </div>
        }
        action={
          <>
            <Input
              className="max-w-xs"
              placeholder={t("＋ 新任務")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addTask();
              }}
            />
            <Choice
              value={cycleId}
              onChange={setCycleId}
              options={addable.map((cycle) => ({ value: String(cycle.id), label: cycle.title }))}
            />
            <Button onClick={addTask} disabled={!title.trim() || !cycleId}>{t("加入")}</Button>
          </>
        }
      />

      {view === "table" ? (
        <div className="flex flex-col gap-4">
          {shownGroups.map(({ group, index }) => {
            const cycle = cycles.find((item) => String(item.id) === group.id);
            return (
            <BoardGroup
              key={group.id}
              title={group.title}
              color={groupColor(index)}
              count={group.tasks.length}
              footer={
                cycle && OPEN_STATUSES.has(cycle.status) ? (
                  <AddTaskRow onCreate={(taskTitle) => createTask(taskTitle, cycle.id)} />
                ) : null
              }
            >
              {group.tasks.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground">{t("尚未新增任務，用下方輸入快速加入")}</p>
              ) : (
                <table className="board-table">
                  <thead>
                    <tr>
                      <th>{t("任務")}</th>
                      <th>{t("負責人")}</th>
                      <th className="color-cell">{t("狀態")}</th>
                      <th className="color-cell">{t("優先級")}</th>
                      <th>{t("截止日")}</th>
                      <th>{t("組別")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.tasks.map((task) => (
                      <tr key={task.id}>
                        <td>
                          <button type="button" className="block max-w-full truncate text-left hover:underline" onClick={() => setOpenId(task.id)}>
                            {task.title}
                          </button>
                        </td>
                        <td>
                          <PersonCell
                            name={task.assignee_name}
                            disabled={!canEdit(task)}
                            options={people}
                            onChange={(value) => patch(task, { assignee_id: value === "none" ? null : Number(value) })}
                          />
                        </td>
                        <td className="color-cell">
                          <StatusCell
                            value={task.status}
                            disabled={!canEdit(task)}
                            options={statusOptions}
                            onChange={(value) => patch(task, { status: value })}
                          />
                        </td>
                        <td className="color-cell">
                          <PriorityCell
                            value={task.priority}
                            disabled={!canEdit(task)}
                            options={priorityOptions}
                            onChange={(value) => patch(task, { priority: value })}
                          />
                        </td>
                        <td>
                          <Input
                            type="date"
                            className="h-8 w-36 border-0 bg-transparent shadow-none"
                            disabled={!canEdit(task)}
                            value={task.due_date ?? ""}
                            onChange={(e) => patch(task, { due_date: e.target.value || null })}
                          />
                        </td>
                        <td>
                          <Choice
                            value={task.subteam}
                            disabled={!canEdit(task)}
                            onChange={(value) => patch(task, { subteam: value })}
                            options={subteams.map((item) => ({ value: item.key, label: item.label }))}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </BoardGroup>
            );
          })}
          {shownGroups.length === 0 && (
            <PageEmpty>{narrowing ? t("沒有符合的結果") : t("目前沒有進行中的週期")}</PageEmpty>
          )}
        </div>
      ) : (
        <div className="grid gap-4 bg-[#f6f7fb] p-3 md:grid-cols-3 dark:bg-[#090a0c]">
          {STATUSES.map((column) => (
            <section
              key={column.key}
              className="flex min-h-64 flex-col gap-2"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                const id = Number(event.dataTransfer.getData("text/plain"));
                const task = tasks.find((item) => item.id === id);
                if (task && canEdit(task) && task.status !== column.key) patch(task, { status: column.key });
              }}
            >
              <div
                className="flex h-9 items-center justify-between px-3 text-sm"
                style={{ background: column.color, color: column.color === "#c4c4c4" ? "#323338" : "#fff" }}
              >
                <h2 className="font-medium">{column.label}</h2>
                <span>{filtered.filter((task) => task.status === column.key).length}</span>
              </div>
              {filtered
                .filter((task) => task.status === column.key)
                .map((task) => (
                  <article
                    key={task.id}
                    draggable={canEdit(task)}
                    onDragStart={(event) => event.dataTransfer.setData("text/plain", String(task.id))}
                    className="flex flex-col gap-2 rounded-[8px] border border-border bg-card p-3"
                  >
                    <button type="button" className="text-left font-medium hover:underline" onClick={() => setOpenId(task.id)}>
                      {task.title}
                    </button>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <PersonCell name={task.assignee_name} />
                      {task.due_date && <span className="tabular-nums">{task.due_date}</span>}
                      <span className="px-1.5 py-0.5 text-white" style={{ background: PRIORITIES.find((item) => item.key === task.priority)?.color }}>
                        {priorityLabel(task.priority)}
                      </span>
                    </div>
                  </article>
                ))}
            </section>
          ))}
        </div>
      )}

      <Sheet open={openTask != null} onOpenChange={(open) => { if (!open) setOpenId(null); }}>
        <SheetContent className="w-full sm:max-w-[700px]" style={{ width: "min(700px, 100%)", maxWidth: 700 }}>
          {openTask && (
            <TaskSheet
              key={openTask.id + "-" + openTask.version}
              task={openTask}
              editable={canEdit(openTask)}
              staff={isStaff(me.role)}
              onPatch={(body) => patch(openTask, body)}
              onReload={load}
              onClose={() => setOpenId(null)}
              confirm={confirm}
              toast={toast}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function AddTaskRow({ onCreate }: { onCreate: (title: string) => Promise<boolean> }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="flex h-9 items-center gap-2 border-t border-border px-3"
      onSubmit={async (event) => {
        event.preventDefault();
        const next = draft.trim();
        if (!next || busy) return;
        setBusy(true);
        const ok = await onCreate(next);
        setBusy(false);
        if (ok) setDraft("");
      }}
    >
      <span className="text-sm text-primary" aria-hidden>+</span>
      <input
        value={draft}
        disabled={busy}
        onChange={(event) => setDraft(event.target.value)}
        placeholder={t("＋ 新任務")}
        aria-label={t("＋ 新任務")}
        className="h-8 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </form>
  );
}

function Choice({
  value,
  options,
  disabled,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const current = options.find((option) => option.value === value);
  return (
    <Select value={value} onValueChange={(next) => next && onChange(String(next))} disabled={disabled}>
      <SelectTrigger size="sm">
        <SelectValue>{current?.label ?? value}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

function TaskSheet({
  task,
  editable,
  staff,
  onPatch,
  onReload,
  onClose,
  confirm,
  toast,
}: {
  task: Task;
  editable: boolean;
  staff: boolean;
  onPatch: (body: Record<string, unknown>) => Promise<void>;
  onReload: () => Promise<void>;
  onClose: () => void;
  confirm: (opts: { title: string; message?: string; confirmText?: string; danger?: boolean }) => Promise<boolean>;
  toast: (msg: string, kind?: "ok" | "err" | "info") => void;
}) {
  const { t } = useI18n();
  const [draftTitle, setDraftTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [itemText, setItemText] = useState("");

  async function save() {
    if (!draftTitle.trim()) return;
    await onPatch({ title: draftTitle.trim(), description });
  }

  async function addItem() {
    if (!itemText.trim()) return;
    try {
      await api(`/api/tasks/${task.id}/items`, {
        method: "POST",
        body: JSON.stringify({ text: itemText.trim() }),
      });
      setItemText("");
      await onReload();
    } catch (err) {
      toast(t((err as Error).message), "err");
    }
  }

  async function toggleItem(item: ChecklistItem) {
    try {
      await api(`/api/items/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ done: !item.done }),
      });
      await onReload();
    } catch (err) {
      toast(t((err as Error).message), "err");
    }
  }

  async function remove() {
    const ok = await confirm({
      title: `${t("刪除")}「${task.title}」？`,
      message: t("刪除後無法復原。"),
      confirmText: t("刪除"),
      danger: true,
    });
    if (!ok) return;
    await api(`/api/tasks/${task.id}`, { method: "DELETE" });
    await onReload();
    onClose();
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>{task.title}</SheetTitle>
        <SheetDescription>{statusLabel(task.status)} · {priorityLabel(task.priority)}</SheetDescription>
      </SheetHeader>
      <div className="flex flex-col gap-3 overflow-y-auto px-4 pb-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{t("標題")}</span>
          <Input value={draftTitle} disabled={!editable} onChange={(e) => setDraftTitle(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{t("描述")}</span>
          <textarea
            className="min-h-24 rounded-lg border border-input bg-background px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            value={description}
            placeholder={t("描述")}
            disabled={!editable}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">{t("子任務")}</p>
          {task.items.map((item) => (
            <label key={item.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!item.done} disabled={!editable} onChange={() => toggleItem(item)} />
              <span className={item.done ? "text-muted-foreground line-through" : ""}>{item.text}</span>
            </label>
          ))}
          {editable && (
            <div className="flex gap-2">
              <Input
                value={itemText}
                placeholder={t("子任務")}
                onChange={(e) => setItemText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addItem();
                }}
              />
              <Button variant="outline" onClick={addItem}>{t("加入")}</Button>
            </div>
          )}
        </div>
        {editable && <Button onClick={save}>{t("儲存變更")}</Button>}
        {staff && <Button variant="destructive" onClick={remove}>{t("刪除")}</Button>}
      </div>
    </>
  );
}
