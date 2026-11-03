"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowRightIcon,
  CalendarIcon,
  CalendarPlusIcon,
  CheckIcon,
  FlagIcon,
  FolderIcon,
  LinkIcon,
  MessageSquareIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  UserIcon,
  XIcon,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n";
import { tt } from "@/lib/i18n-core";
import { fmtMD } from "@/lib/date";
import { PRIORITIES, STATUSES, eventType, groupColor, priorityLabel, statusLabel } from "@/lib/ui";
import { Label, StatusIcon } from "@/components/board/ColorCell";
import { Avatar, shortName } from "@/components/board/PersonCell";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { DateCell, DueCell, Progress } from "./shared";
import { AssigneeList, FieldRow, LabelList, OptionList, SidebarPicker } from "./Pickers";
import type { ChecklistItem, Cycle, Task, TeamEvent } from "@/lib/types";

type Toast = (msg: string, kind?: "ok" | "err" | "info") => void;
type Confirm = (opts: { title: string; message?: string; confirmText?: string; danger?: boolean }) => Promise<boolean>;

type Entry = {
  id: number;
  kind: string;
  body: string;
  meta: Record<string, unknown>;
  created_at: string;
  edited_at: string | null;
  user_id: number | null;
  user_name: string | null;
};
type Timeline = { created: { at: string; user_id: number | null; user_name: string | null }; activity: Entry[] };

/** "just now", "5m ago", "3h ago", "2d ago", "3w ago", then a date. */
export function timeAgo(iso: string) {
  const then = new Date(iso.includes("T") || iso.endsWith("Z") ? iso : iso.replace(" ", "T") + "Z").getTime();
  const sec = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (sec < 60) return tt("剛剛", "just now");
  const min = Math.round(sec / 60);
  if (min < 60) return tt(`${min} 分鐘前`, `${min}m ago`);
  const hr = Math.round(min / 60);
  if (hr < 24) return tt(`${hr} 小時前`, `${hr}h ago`);
  const day = Math.round(hr / 24);
  if (day < 7) return tt(`${day} 天前`, `${day}d ago`);
  if (day < 60) return tt(`${Math.round(day / 7)} 週前`, `${Math.round(day / 7)}w ago`);
  return new Date(then).toLocaleDateString();
}

/** Square checklist box; the real <input type="checkbox"> sits before it as a visually hidden peer. */
function ItemCheckbox({ checked, disabled }: { checked: boolean; disabled?: boolean }) {
  return (
    <span
      aria-hidden
      className={`flex size-[18px] shrink-0 items-center justify-center rounded-[4px] border-[1.5px] transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-[color-mix(in_srgb,var(--c-blue)_45%,transparent)] ${
        checked ? "border-[var(--c-green)] bg-[var(--c-green)] text-white" : "border-input bg-background"
      } ${disabled ? "opacity-70" : "hover:border-[var(--c-green)]"}`}
    >
      {checked && <CheckIcon className="size-3.5" strokeWidth={3} />}
    </span>
  );
}

export function TaskSheet({
  task,
  today,
  editable,
  staff,
  me,
  cycles,
  people,
  subteams,
  onPatch,
  onItems,
  onDelete,
  onReload,
  confirm,
  toast,
}: {
  task: Task;
  today: string;
  editable: boolean;
  staff: boolean;
  me: { id: number; display_name: string };
  cycles: Cycle[];
  people: { value: string; label: string }[];
  subteams: { value: string; label: string }[];
  onPatch: (body: Record<string, unknown>) => Promise<void>;
  onItems: (items: ChecklistItem[]) => void;
  onDelete: () => Promise<void>;
  onReload: () => Promise<void>;
  confirm: Confirm;
  toast: Toast;
}) {
  const { t } = useI18n();
  const [draftTitle, setDraftTitle] = useState(task.title);
  const [editingTitle, setEditingTitle] = useState(false);
  const [description, setDescription] = useState(task.description);
  const [editingDescription, setEditingDescription] = useState(false);
  const [seen, setSeen] = useState({ title: task.title, description: task.description });
  const [itemText, setItemText] = useState("");
  const [editingItem, setEditingItem] = useState<{ id: number; text: string } | null>(null);
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [events, setEvents] = useState<TeamEvent[]>([]);
  const [comment, setComment] = useState("");
  const [posting, setPosting] = useState(false);
  const [editingComment, setEditingComment] = useState<{ id: number; body: string } | null>(null);
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [labelsOpen, setLabelsOpen] = useState(false);

  // Load the timeline and linked events; reload whenever the task changes (version bump).
  useEffect(() => {
    let alive = true;
    Promise.all([
      api<Timeline>(`/api/tasks/${task.id}/activity`),
      api<{ events: TeamEvent[] }>("/api/events").catch(() => ({ events: [] as TeamEvent[] })),
    ])
      .then(([activity, ev]) => {
        if (!alive) return;
        setTimeline(activity);
        setEvents(ev.events.filter((event) => event.task_id === task.id));
      })
      .catch(() => {
        if (alive) setTimeline((prev) => prev ?? { created: { at: "", user_id: null, user_name: null }, activity: [] });
      });
    return () => {
      alive = false;
    };
  }, [task.id, task.version]);

  // Pick up edits made elsewhere without clobbering what the user is typing.
  if (seen.title !== task.title || seen.description !== task.description) {
    if (seen.title !== task.title && !editingTitle) setDraftTitle(task.title);
    if (seen.description !== task.description && !editingDescription) setDescription(task.description);
    setSeen({ title: task.title, description: task.description });
  }

  const items = task.items;
  const doneCount = items.filter((item) => item.done).length;
  const cycle = cycles.find((item) => item.id === task.cycle_id);
  const cycleOptions = cycles
    .filter((item) => item.id === task.cycle_id || !["completed", "rejected"].includes(item.status))
    .map((item) => ({ value: String(item.id), label: item.title }));
  const statusOptions = STATUSES.map((item) => ({ value: item.key, label: item.label, color: item.color }));
  const priorityOptions = PRIORITIES.map((item) => ({ value: item.key, label: item.label, color: item.color }));
  const priority = PRIORITIES.find((item) => item.key === task.priority);
  const subteamName = subteams.find((item) => item.value === task.subteam)?.label ?? task.subteam;
  const scheduleHref = `/calendar?new=1&task=${task.id}${task.due_date ? `&date=${task.due_date}` : ""}`;

  async function saveTitle() {
    setEditingTitle(false);
    const next = draftTitle.trim();
    if (!next) return setDraftTitle(task.title);
    if (next !== task.title) await onPatch({ title: next });
  }

  async function saveDescription() {
    setEditingDescription(false);
    if (description !== task.description) await onPatch({ description });
  }

  async function addItem() {
    const text = itemText.trim();
    if (!text) return;
    setItemText("");
    try {
      const res = await api<{ item: ChecklistItem }>(`/api/tasks/${task.id}/items`, { method: "POST", body: JSON.stringify({ text }) });
      onItems([...items, res.item]);
    } catch (err) {
      setItemText(text);
      toast(t((err as Error).message), "err");
    }
  }

  async function itemCall(item: ChecklistItem, init: RequestInit, optimistic: ChecklistItem[]) {
    onItems(optimistic);
    try {
      await api(`/api/items/${item.id}`, init);
    } catch (err) {
      toast(t((err as Error).message), "err");
      onReload().catch(() => {});
    }
  }

  function toggleItem(item: ChecklistItem) {
    const done = item.done ? 0 : 1;
    itemCall(item, { method: "PATCH", body: JSON.stringify({ done: !!done }) }, items.map((row) => (row.id === item.id ? { ...row, done } : row)));
  }

  function renameItem(item: ChecklistItem, text: string) {
    setEditingItem(null);
    const next = text.trim();
    if (!next || next === item.text) return;
    itemCall(item, { method: "PATCH", body: JSON.stringify({ text: next }) }, items.map((row) => (row.id === item.id ? { ...row, text: next } : row)));
  }

  async function postComment() {
    const body = comment.trim();
    if (!body || posting) return;
    setPosting(true);
    try {
      const res = await api<{ entry: Entry }>(`/api/tasks/${task.id}/activity`, { method: "POST", body: JSON.stringify({ body }) });
      setTimeline((prev) => (prev ? { ...prev, activity: [...prev.activity, res.entry] } : prev));
      setComment("");
    } catch (err) {
      toast(t((err as Error).message), "err");
    } finally {
      setPosting(false);
    }
  }

  async function saveComment(entry: Entry, body: string) {
    setEditingComment(null);
    const next = body.trim();
    if (!next || next === entry.body) return;
    try {
      await api(`/api/activity/${entry.id}`, { method: "PATCH", body: JSON.stringify({ body: next }) });
      setTimeline((prev) => prev && { ...prev, activity: prev.activity.map((row) => (row.id === entry.id ? { ...row, body: next, edited_at: new Date().toISOString() } : row)) });
    } catch (err) {
      toast(t((err as Error).message), "err");
    }
  }

  async function deleteComment(entry: Entry) {
    const ok = await confirm({ title: tt("刪除這則留言？", "Delete this comment?"), confirmText: tt("刪除", "Delete"), danger: true });
    if (!ok) return;
    try {
      await api(`/api/activity/${entry.id}`, { method: "DELETE" });
      setTimeline((prev) => prev && { ...prev, activity: prev.activity.filter((row) => row.id !== entry.id) });
    } catch (err) {
      toast(t((err as Error).message), "err");
    }
  }

  async function remove() {
    const ok = await confirm({
      title: tt(`刪除「${task.title}」？`, `Delete "${task.title}"?`),
      message: tt("刪除後無法復原。", "This can't be undone."),
      confirmText: tt("刪除", "Delete"),
      danger: true,
    });
    if (ok) await onDelete();
  }

  async function copyLink() {
    const url = `${window.location.origin}/tasks?task=${task.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast(tt("已複製連結", "Link copied"), "ok");
    } catch {
      toast(url, "info");
    }
  }

  const stateBadge = {
    todo: { bg: "var(--c-green)", label: tt("待辦", "Todo") },
    doing: { bg: "var(--c-yellow)", label: tt("進行中", "In progress") },
    done: { bg: "var(--c-purple)", label: tt("已完成", "Done") },
  }[task.status] ?? { bg: "var(--c-gray)", label: task.status };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header: title, number, state badge, project */}
      <div className="border-b border-border px-6 pt-5 pb-4 pr-14">
        <div className="flex items-start gap-3">
          <SheetTitle className="min-w-0 flex-1 text-[26px] leading-tight font-normal">
            {editingTitle ? (
              <textarea
                autoFocus
                value={draftTitle}
                rows={1}
                onChange={(event) => setDraftTitle(event.target.value.replace(/\n/g, ""))}
                onBlur={saveTitle}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    event.currentTarget.blur();
                  }
                  if (event.key === "Escape") {
                    setDraftTitle(task.title);
                    setEditingTitle(false);
                  }
                }}
                aria-label={tt("標題", "Title")}
                className="field-sizing-content w-full resize-none rounded-[6px] border border-ring bg-background px-2 py-1 text-[22px] outline-none"
              />
            ) : (
              <span className="group/title">
                <span className="break-words">{task.title}</span>
                {editable && (
                  <button
                    type="button"
                    onClick={() => setEditingTitle(true)}
                    className="ml-2 inline-flex size-7 translate-y-[-3px] items-center justify-center rounded-[6px] text-muted-foreground opacity-0 transition-opacity group-hover/title:opacity-100 hover:bg-muted hover:text-foreground focus-visible:opacity-100"
                    aria-label={tt("編輯標題", "Edit title")}
                  >
                    <PencilIcon className="size-4" />
                  </button>
                )}
              </span>
            )}
          </SheetTitle>
          <div className="flex shrink-0 items-center gap-1">
            <Button variant="ghost" size="icon-sm" onClick={copyLink} aria-label={tt("複製連結", "Copy link")} title={tt("複製連結", "Copy link")}>
              <LinkIcon />
            </Button>
            {staff && (
              <Button variant="ghost" size="icon-sm" onClick={remove} aria-label={tt("刪除", "Delete")} title={tt("刪除", "Delete")} className="hover:text-destructive">
                <Trash2Icon />
              </Button>
            )}
          </div>
        </div>
        <SheetDescription render={<div />} className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span
            className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 font-medium text-white transition-colors duration-300"
            style={{ background: `color-mix(in srgb, ${stateBadge.bg} 85%, black)` }}
          >
            <StatusIcon status={task.status} className="[&_*]:!stroke-white [&_circle]:!fill-none [&_path]:!fill-white" />
            {stateBadge.label}
          </span>
          <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border px-2.5 text-muted-foreground">
            <FolderIcon className="size-3.5" />
            {cycle ? cycle.title : tt("未分專案", "No project")}
          </span>
          {timeline?.created.at && (
            <span className="text-muted-foreground">
              {timeline.created.user_name ? `${shortName(timeline.created.user_name)} ` : ""}
              {tt(`建立於 ${timeAgo(timeline.created.at)}`, `opened ${timeAgo(timeline.created.at)}`)}
            </span>
          )}
        </SheetDescription>
      </div>

      <div className="grid min-h-0 flex-1 overflow-y-auto md:grid-cols-[minmax(0,1fr)_17rem]">
        {/* Main column */}
        <div className="flex min-w-0 flex-col gap-6 px-6 py-5">
          {/* Description, shown like the opening comment */}
          <article className="overflow-hidden rounded-[6px] border border-border">
            <header className="flex items-center gap-2 border-b border-border bg-muted/60 px-3 py-2 text-sm">
              <Avatar name={timeline?.created.user_name ?? null} size={22} />
              <span className="font-semibold">{timeline?.created.user_name ? shortName(timeline.created.user_name) : tt("某人", "Someone")}</span>
              <span className="text-muted-foreground">{tt("描述", "description")}</span>
              {editable && !editingDescription && (
                <button
                  type="button"
                  onClick={() => setEditingDescription(true)}
                  className="ml-auto inline-flex h-7 items-center gap-1 rounded-[6px] px-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <PencilIcon className="size-3.5" /> {tt("編輯", "Edit")}
                </button>
              )}
            </header>
            {editingDescription ? (
              <div className="flex flex-col gap-2 p-3">
                <textarea
                  autoFocus
                  className="field-sizing-content min-h-32 rounded-[6px] border border-input bg-background px-3 py-2 text-sm leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
                  value={description}
                  placeholder={tt("加入細節、規格、連結…", "Add details, specs, links…")}
                  onChange={(event) => setDescription(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) saveDescription();
                  }}
                />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setDescription(task.description); setEditingDescription(false); }}>
                    {tt("取消", "Cancel")}
                  </Button>
                  <Button size="sm" onClick={saveDescription}>{tt("儲存", "Save")}</Button>
                </div>
              </div>
            ) : (
              <div className={`px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${task.description.trim() ? "" : "text-muted-foreground italic"}`}>
                {task.description.trim() || tt("沒有描述。", "No description provided.")}
              </div>
            )}
          </article>

          {/* Subtasks */}
          <section className="rounded-[6px] border border-border">
            <header className="flex items-center gap-3 border-b border-border px-3 py-2">
              <h3 className="text-sm font-semibold">{tt("子任務", "Subtasks")}</h3>
              {items.length > 0 && (
                <span className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
                  {doneCount} / {items.length}
                  <Progress done={doneCount} total={items.length} label={false} className="w-28" />
                  {Math.round((doneCount / items.length) * 100)}%
                </span>
              )}
            </header>
            <ul className="flex flex-col">
              {items.map((item) => (
                <li key={item.id} className="group flex min-h-10 items-center gap-2.5 border-b border-border px-3 transition-colors last:border-b-0 hover:bg-muted/50">
                  {editingItem?.id === item.id ? (
                    <>
                      <ItemCheckbox checked={!!item.done} disabled />
                      <input
                        autoFocus
                        value={editingItem.text}
                        onChange={(event) => setEditingItem({ id: item.id, text: event.target.value })}
                        onBlur={() => renameItem(item, editingItem.text)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") renameItem(item, editingItem.text);
                          if (event.key === "Escape") setEditingItem(null);
                        }}
                        className="h-7 min-w-0 flex-1 rounded-[6px] border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring"
                      />
                    </>
                  ) : (
                    <label className={`flex min-w-0 flex-1 items-center gap-2.5 py-1.5 ${editable ? "cursor-pointer" : ""}`}>
                      <input
                        type="checkbox"
                        className="peer sr-only"
                        checked={!!item.done}
                        disabled={!editable}
                        onChange={() => toggleItem(item)}
                      />
                      <ItemCheckbox checked={!!item.done} disabled={!editable} />
                      <span className={`min-w-0 flex-1 text-sm break-words ${item.done ? "text-muted-foreground line-through" : ""}`}>
                        {item.text}
                      </span>
                    </label>
                  )}
                  {editable && editingItem?.id !== item.id && (
                    <button
                      type="button"
                      onClick={() => setEditingItem({ id: item.id, text: item.text })}
                      className="flex size-7 shrink-0 items-center justify-center rounded-[6px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted hover:text-foreground focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
                      aria-label={tt("重新命名子任務", "Rename subtask")}
                    >
                      <PencilIcon className="size-3.5" />
                    </button>
                  )}
                  {editable && (
                    <button
                      type="button"
                      onClick={() => itemCall(item, { method: "DELETE" }, items.filter((row) => row.id !== item.id))}
                      className="flex size-7 shrink-0 items-center justify-center rounded-[6px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted hover:text-foreground focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
                      aria-label={tt("刪除子任務", "Delete subtask")}
                    >
                      <XIcon className="size-3.5" />
                    </button>
                  )}
                </li>
              ))}
              {items.length === 0 && <li className="px-3 py-3 text-sm text-muted-foreground">{tt("沒有子任務", "No subtasks yet")}</li>}
            </ul>
            {editable && (
              <form
                className="flex items-center gap-2 border-t border-border px-3 transition-colors focus-within:bg-muted/40"
                onSubmit={(event) => {
                  event.preventDefault();
                  addItem();
                }}
              >
                <PlusIcon className="size-4 shrink-0 text-muted-foreground" />
                <input
                  value={itemText}
                  placeholder={tt("新增子任務，按 Enter 加入", "Add a subtask, press Enter")}
                  onChange={(event) => setItemText(event.target.value)}
                  className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </form>
            )}
          </section>

          {/* Activity timeline */}
          <section aria-label={tt("動態", "Activity")}>
            <h3 className="mb-3 text-sm font-semibold">{tt("動態", "Activity")}</h3>
            <ol className="relative flex flex-col gap-4 before:absolute before:top-2 before:bottom-2 before:left-[15px] before:w-0.5 before:bg-border">
              {timeline === null && (
                <li className="relative pl-11 text-sm text-muted-foreground">{tt("載入中…", "Loading…")}</li>
              )}
              {timeline?.activity.length === 0 && (
                <li className="relative pl-11 text-sm text-muted-foreground">{tt("還沒有動態，留下第一則留言吧。", "No activity yet. Leave the first comment.")}</li>
              )}
              {timeline?.activity.map((entry) =>
                entry.kind === "comment" ? (
                  <li key={entry.id} className="relative animate-in pl-11 duration-300 fade-in slide-in-from-bottom-1">
                    <span className="absolute top-1 left-0 rounded-full ring-4 ring-card">
                      <Avatar name={entry.user_name} size={32} />
                    </span>
                    <article className="group/comment overflow-hidden rounded-[6px] border border-border transition-colors hover:border-[color-mix(in_srgb,var(--c-gray)_60%,transparent)]">
                      <header className="flex items-center gap-2 border-b border-border bg-muted/60 px-3 py-1.5 text-sm">
                        <span className="font-semibold">{entry.user_name ? shortName(entry.user_name) : tt("某人", "Someone")}</span>
                        <span className="text-muted-foreground">
                          {tt("留言於", "commented")} {timeAgo(entry.created_at)}
                          {entry.edited_at ? ` · ${tt("已編輯", "edited")}` : ""}
                        </span>
                        {(entry.user_id === me.id || staff) && (
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              className="ml-auto flex size-7 items-center justify-center rounded-[6px] text-muted-foreground opacity-0 transition-opacity group-hover/comment:opacity-100 hover:bg-muted hover:text-foreground focus-visible:opacity-100 aria-expanded:opacity-100"
                              aria-label={tt("留言選項", "Comment options")}
                            >
                              <MoreHorizontalIcon className="size-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              {entry.user_id === me.id && (
                                <DropdownMenuItem onClick={() => setEditingComment({ id: entry.id, body: entry.body })}>
                                  <PencilIcon /> {tt("編輯", "Edit")}
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem variant="destructive" onClick={() => deleteComment(entry)}>
                                <Trash2Icon /> {tt("刪除", "Delete")}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </header>
                      {editingComment?.id === entry.id ? (
                        <div className="flex flex-col gap-2 p-3">
                          <textarea
                            autoFocus
                            value={editingComment.body}
                            onChange={(event) => setEditingComment({ id: entry.id, body: event.target.value })}
                            className="field-sizing-content min-h-20 rounded-[6px] border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring"
                          />
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => setEditingComment(null)}>{tt("取消", "Cancel")}</Button>
                            <Button size="sm" onClick={() => saveComment(entry, editingComment.body)}>{tt("更新留言", "Update comment")}</Button>
                          </div>
                        </div>
                      ) : (
                        <p className="px-3 py-2.5 text-sm leading-relaxed whitespace-pre-wrap">{entry.body}</p>
                      )}
                    </article>
                  </li>
                ) : (
                  <li key={entry.id} className="relative flex min-h-8 animate-in items-center gap-2 pl-11 text-sm text-muted-foreground duration-300 fade-in">
                    <span className="absolute left-[3px] flex size-[26px] items-center justify-center rounded-full border border-border bg-muted text-muted-foreground ring-4 ring-card [&_svg]:size-3.5">
                      <ChangeIcon entry={entry} />
                    </span>
                    {entry.user_name && <Avatar name={entry.user_name} size={18} />}
                    <span className="min-w-0">
                      <span className="font-semibold text-foreground">{entry.user_name ? shortName(entry.user_name) : tt("某人", "Someone")}</span>{" "}
                      <ChangeText entry={entry} cycles={cycles} />{" "}
                      <span className="whitespace-nowrap">{timeAgo(entry.created_at)}</span>
                    </span>
                  </li>
                )
              )}
            </ol>
          </section>

          {/* New comment */}
          <section className="flex gap-3 border-t border-border pt-5">
            <Avatar name={me.display_name} size={32} />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <h3 className="text-sm font-semibold">{tt("新增留言", "Add a comment")}</h3>
              <textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) postComment();
                }}
                placeholder={tt("分享進度、問題或想法…", "Share progress, questions or ideas…")}
                className="field-sizing-content min-h-24 rounded-[6px] border border-input bg-background px-3 py-2 text-sm leading-relaxed outline-none transition-shadow focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">{tt("Ctrl + Enter 送出", "Ctrl + Enter to send")}</span>
                <Button size="sm" disabled={!comment.trim() || posting} onClick={postComment}>
                  <MessageSquareIcon /> {posting ? tt("送出中…", "Posting…") : tt("留言", "Comment")}
                </Button>
              </div>
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <aside className="flex flex-col border-t border-border px-5 py-2 text-sm md:border-t-0 md:border-l">
          <div className="border-b border-border py-2">
            <SidebarPicker
              title={tt("負責人", "Assignees")}
              disabled={!editable}
              open={assigneeOpen}
              onOpenChange={setAssigneeOpen}
              face={
                task.assignees?.length ? (
                  <span className="flex min-w-0 flex-col gap-1.5">
                    {task.assignees.map((person) => (
                      <span key={person.id} className="flex min-w-0 items-center gap-2">
                        <Avatar name={person.display_name} size={22} />
                        <span className="truncate font-semibold">{shortName(person.display_name)}</span>
                      </span>
                    ))}
                  </span>
                ) : (
                  <span className="text-muted-foreground">{tt("尚未指派", "No one assigned")}</span>
                )
              }
            >
              <AssigneeList
                people={people}
                value={task.assignee_ids ?? []}
                onChange={(ids) => onPatch({ assignee_ids: ids })}
              />
            </SidebarPicker>
            {editable && !(task.assignee_ids ?? []).includes(me.id) && (
              <button
                type="button"
                className="mx-2 mt-0.5 block text-xs text-[var(--c-blue)] hover:underline"
                onClick={() => onPatch({ assignee_ids: [...(task.assignee_ids ?? []), me.id] })}
              >
                {task.assignee_ids?.length ? tt("把自己加入", "Add yourself") : tt("指派給自己", "Assign yourself")}
              </button>
            )}
          </div>

          <div className="border-b border-border py-2">
            <SidebarPicker
              title={tt("標籤", "Labels")}
              disabled={!editable}
              open={labelsOpen}
              onOpenChange={setLabelsOpen}
              face={
                <span className="flex flex-wrap gap-1.5">
                  {priority && <Label color={priority.color}>{priority.label}</Label>}
                  <Label color={groupColor(Math.max(0, subteams.findIndex((item) => item.value === task.subteam)))}>{subteamName}</Label>
                </span>
              }
            >
              <LabelList
                groups={[
                  { key: "priority", title: tt("優先級", "Priority"), value: task.priority, options: priorityOptions, onChange: (value) => value !== task.priority && onPatch({ priority: value }) },
                  {
                    key: "subteam",
                    title: tt("組別", "Subteam"),
                    value: task.subteam,
                    options: subteams.map((item, i) => ({ ...item, color: groupColor(i) })),
                    onChange: (value) => value !== task.subteam && onPatch({ subteam: value }),
                  },
                ]}
              />
            </SidebarPicker>
          </div>

          <SideSection title={tt("專案", "Project")}>
            <div className="overflow-hidden rounded-[6px] border border-border">
              <div className="flex items-center gap-2 border-b border-border px-3 py-2 font-semibold">
                <FolderIcon className="size-4 text-muted-foreground" />
                <span className="min-w-0 truncate">{cycle ? cycle.title : tt("未分專案", "No project")}</span>
              </div>
              <div className="flex flex-col gap-0.5 p-1">
                <FieldRow label={tt("狀態", "Status")} disabled={!editable} face={<Label color={STATUSES.find((s) => s.key === task.status)?.color ?? "var(--c-gray)"}>{statusLabel(task.status)}</Label>}>
                  {(close) => (
                    <OptionList
                      value={task.status}
                      options={statusOptions}
                      icon={(option) => <StatusIcon status={option.value} />}
                      onPick={(value) => {
                        close();
                        if (value !== task.status) onPatch({ status: value });
                      }}
                    />
                  )}
                </FieldRow>
                <FieldRow
                  label={tt("優先級", "Priority")}
                  disabled={!editable}
                  face={priority ? <Label color={priority.color}>{priority.label}</Label> : <span className="text-muted-foreground">{tt("選擇", "Choose an option")}</span>}
                >
                  {(close) => (
                    <OptionList
                      value={task.priority}
                      options={priorityOptions}
                      onPick={(value) => {
                        close();
                        if (value !== task.priority) onPatch({ priority: value });
                      }}
                    />
                  )}
                </FieldRow>
                <DateCell rowLabel={tt("開始日", "Start")} value={task.start_date} today={today} disabled={!editable} onChange={(value) => onPatch({ start_date: value })} />
                <DueCell rowLabel={tt("截止日", "Due")} task={task} today={today} disabled={!editable} onChange={(value) => onPatch({ due_date: value })} />
                <FieldRow
                  label={tt("組別", "Subteam")}
                  disabled={!editable}
                  face={<Label color={groupColor(Math.max(0, subteams.findIndex((item) => item.value === task.subteam)))}>{subteamName}</Label>}
                >
                  {(close) => (
                    <OptionList
                      value={task.subteam}
                      options={subteams.map((item, i) => ({ ...item, color: groupColor(i) }))}
                      onPick={(value) => {
                        close();
                        if (value !== task.subteam) onPatch({ subteam: value });
                      }}
                    />
                  )}
                </FieldRow>
                <FieldRow
                  label={tt("專案", "Project")}
                  disabled={!editable || cycleOptions.length === 0}
                  face={<span className="block truncate">{cycle ? cycle.title : <span className="text-muted-foreground">{tt("選擇", "Choose an option")}</span>}</span>}
                >
                  {(close) => (
                    <OptionList
                      value={task.cycle_id != null ? String(task.cycle_id) : ""}
                      options={cycleOptions.map((item) => ({ ...item, color: "var(--c-gray)" }))}
                      icon={() => <FolderIcon className="size-3.5 shrink-0 text-muted-foreground" />}
                      onPick={(value) => {
                        close();
                        if (Number(value) !== task.cycle_id) onPatch({ cycle_id: Number(value) });
                      }}
                    />
                  )}
                </FieldRow>
              </div>
            </div>
          </SideSection>

          <SideSection
            title={tt("行事曆活動", "Calendar events")}
            action={
              staff ? (
                <a href={scheduleHref} className="inline-flex size-7 items-center justify-center rounded-[6px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" title={tt("安排活動", "Schedule an event")} aria-label={tt("安排活動", "Schedule an event")}>
                  <CalendarPlusIcon className="size-4" />
                </a>
              ) : null
            }
          >
            {events.length === 0 ? (
              <p className="text-muted-foreground">
                {tt("沒有相關活動", "None yet")}
                {staff && (
                  <>
                    {" · "}
                    <a href={scheduleHref} className="text-[var(--c-blue)] hover:underline">{tt("安排一個", "Schedule one")}</a>
                  </>
                )}
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {events.map((event) => (
                  <li key={event.id}>
                    <a
                      href={`/calendar?date=${event.date}&event=${event.id}`}
                      className="group/ev flex items-start gap-2 rounded-[6px] px-1.5 py-1 transition-colors hover:bg-muted [&>span:first-child]:mt-1.5"
                    >
                      <span className="size-2 shrink-0 rounded-full" style={{ background: eventType(event.type).color }} />
                      <span className="line-clamp-2 min-w-0 flex-1">{event.title}</span>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{fmtMD(event.date)}{event.time ? ` ${event.time}` : ""}</span>
                      <ArrowRightIcon className="size-3.5 shrink-0 -translate-x-1 text-muted-foreground opacity-0 transition-all group-hover/ev:translate-x-0 group-hover/ev:opacity-100" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </SideSection>

          {task.completed_at && (
            <SideSection title={tt("完成於", "Completed")}>
              <span className="tabular-nums">{new Date(task.completed_at).toLocaleString()}</span>
            </SideSection>
          )}

          {!editable && (
            <p className="my-3 rounded-[6px] bg-muted px-3 py-2 text-xs text-muted-foreground">
              {tt("只有隊長、負責人或建立者可以修改這個任務，但所有人都可以留言。", "Only leaders, the assignee or the creator can edit this task. Anyone can comment.")}
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

function SideSection({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="border-b border-border py-3 last:border-b-0">
      <div className="mb-1.5 flex items-center justify-between">
        <h4 className="text-xs font-semibold text-muted-foreground">{title}</h4>
        {action}
      </div>
      {children}
    </section>
  );
}

function ChangeIcon({ entry }: { entry: Entry }) {
  switch (entry.kind) {
    case "status":
      return <StatusIcon status={String(entry.meta.to)} size={14} />;
    case "assignee":
      return <UserIcon />;
    case "priority":
      return <FlagIcon />;
    case "due_date":
    case "start_date":
      return <CalendarIcon />;
    case "project":
      return <FolderIcon />;
    default:
      return <PencilIcon />;
  }
}

function ChangeText({ entry, cycles }: { entry: Entry; cycles: Cycle[] }) {
  const to = entry.meta.to as string | number | null;
  const from = entry.meta.from as string | number | null;
  switch (entry.kind) {
    case "status":
      return (
        <>
          {tt("將狀態改為", "moved this to")} <Label color={STATUSES.find((s) => s.key === to)?.color ?? "var(--c-gray)"}>{statusLabel(String(to))}</Label>
        </>
      );
    case "priority":
      return (
        <>
          {tt("將優先級改為", "set priority to")} <Label color={PRIORITIES.find((p) => p.key === to)?.color ?? "var(--c-gray)"}>{priorityLabel(String(to))}</Label>
        </>
      );
    case "assignee": {
      const added = (entry.meta.added as { name: string }[] | undefined) ?? null;
      const removed = (entry.meta.removed as { name: string }[] | undefined) ?? [];
      if (added) {
        const names = (list: { name: string }[]) => (
          <span className="font-semibold text-foreground">{list.map((person) => shortName(person.name)).join(", ")}</span>
        );
        if (added.length && removed.length) return <>{tt("指派給", "assigned")} {names(added)} {tt("並移除", "and removed")} {names(removed)}</>;
        if (added.length) return <>{tt("指派給", "assigned")} {names(added)}</>;
        return <>{tt("移除了負責人", "unassigned")} {names(removed)}</>;
      }
      return to ? <>{tt("指派給", "assigned this to")} <span className="font-semibold text-foreground">{shortName(String(entry.meta.to_name ?? ""))}</span></> : <>{tt("取消了指派", "removed the assignee")}</>;
    }
    case "due_date":
      return to ? <>{tt("將截止日設為", "set the due date to")} <span className="font-semibold text-foreground">{fmtMD(String(to))}</span></> : <>{tt("清除了截止日", "cleared the due date")}</>;
    case "start_date":
      return to ? <>{tt("將開始日設為", "set the start date to")} <span className="font-semibold text-foreground">{fmtMD(String(to))}</span></> : <>{tt("清除了開始日", "cleared the start date")}</>;
    case "project":
      return <>{tt("移到專案", "moved this to project")} <span className="font-semibold text-foreground">{cycles.find((c) => c.id === Number(to))?.title ?? "—"}</span></>;
    case "title":
      return <>{tt("將標題從", "changed the title from")} <span className="line-through">{String(from)}</span> {tt("改為", "to")} <span className="font-semibold text-foreground">{String(to)}</span></>;
    default:
      return <>{tt("更新了任務", "updated this task")}</>;
  }
}
