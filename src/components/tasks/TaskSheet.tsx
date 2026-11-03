"use client";

import { useState } from "react";
import { CheckIcon, LinkIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { api } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n";
import { tt } from "@/lib/i18n-core";
import { PRIORITIES, STATUSES } from "@/lib/ui";
import { ColorCell } from "@/components/board/ColorCell";
import { PersonCell } from "@/components/board/PersonCell";
import { Button } from "@/components/ui/button";
import { SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Choice, DueCell, Progress } from "./shared";
import type { ChecklistItem, Cycle, Task } from "@/lib/types";

type Toast = (msg: string, kind?: "ok" | "err" | "info") => void;
type Confirm = (opts: { title: string; message?: string; confirmText?: string; danger?: boolean }) => Promise<boolean>;

export function TaskSheet({
  task,
  today,
  editable,
  staff,
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
  const [description, setDescription] = useState(task.description);
  const [seen, setSeen] = useState({ title: task.title, description: task.description });
  const [itemText, setItemText] = useState("");
  const [editingItem, setEditingItem] = useState<{ id: number; text: string } | null>(null);

  // Pick up edits made elsewhere (a reload) without clobbering what the user is typing.
  if (seen.title !== task.title || seen.description !== task.description) {
    if (seen.title !== task.title) setDraftTitle(task.title);
    if (seen.description !== task.description) setDescription(task.description);
    setSeen({ title: task.title, description: task.description });
  }

  const items = task.items;
  const doneCount = items.filter((item) => item.done).length;
  const cycle = cycles.find((item) => item.id === task.cycle_id);
  const cycleOptions = cycles
    .filter((item) => item.id === task.cycle_id || !["completed", "rejected"].includes(item.status))
    .map((item) => ({ value: String(item.id), label: item.title }));

  async function saveTitle() {
    const next = draftTitle.trim();
    if (!next) {
      setDraftTitle(task.title);
      return;
    }
    if (next !== task.title) await onPatch({ title: next });
  }

  async function saveDescription() {
    if (description !== task.description) await onPatch({ description });
  }

  async function addItem() {
    const text = itemText.trim();
    if (!text) return;
    setItemText("");
    try {
      const res = await api<{ item: ChecklistItem }>(`/api/tasks/${task.id}/items`, {
        method: "POST",
        body: JSON.stringify({ text }),
      });
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
    itemCall(
      item,
      { method: "PATCH", body: JSON.stringify({ done: !!done }) },
      items.map((row) => (row.id === item.id ? { ...row, done } : row))
    );
  }

  function renameItem(item: ChecklistItem, text: string) {
    setEditingItem(null);
    const next = text.trim();
    if (!next || next === item.text) return;
    itemCall(
      item,
      { method: "PATCH", body: JSON.stringify({ text: next }) },
      items.map((row) => (row.id === item.id ? { ...row, text: next } : row))
    );
  }

  function removeItem(item: ChecklistItem) {
    itemCall(item, { method: "DELETE" }, items.filter((row) => row.id !== item.id));
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

  const statusOptions = STATUSES.map((item) => ({ value: item.key, label: item.label, color: item.color }));
  const priorityOptions = PRIORITIES.map((item) => ({ value: item.key, label: item.label, color: item.color }));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-border px-5 pt-4 pb-3 pr-14">
        <SheetDescription className="min-w-0 flex-1 truncate">
          {cycle ? cycle.title : tt("未分週期", "No cycle")} · #{task.id}
        </SheetDescription>
        <Button variant="ghost" size="icon-sm" onClick={copyLink} aria-label={tt("複製連結", "Copy link")} title={tt("複製連結", "Copy link")}>
          <LinkIcon />
        </Button>
        {staff && (
          <Button variant="ghost" size="icon-sm" onClick={remove} aria-label={tt("刪除", "Delete")} title={tt("刪除", "Delete")}>
            <Trash2Icon className="text-[#df2f4a]" />
          </Button>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-5 py-4">
        <div className="flex items-start gap-3">
          <button
            type="button"
            disabled={!editable}
            onClick={() => onPatch({ status: task.status === "done" ? "todo" : "done" })}
            className={`mt-1 flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
              task.status === "done" ? "border-[#00c875] bg-[#00c875] text-white" : "border-input hover:border-[#00c875] hover:text-[#00c875]"
            } disabled:pointer-events-none`}
            aria-label={task.status === "done" ? tt("標記為未完成", "Mark incomplete") : tt("標記為完成", "Mark complete")}
            title={task.status === "done" ? tt("標記為未完成", "Mark incomplete") : tt("標記為完成", "Mark complete")}
          >
            <CheckIcon className="size-3.5" strokeWidth={3} />
          </button>
          <SheetTitle className="min-w-0 flex-1">
            <textarea
              value={draftTitle}
              disabled={!editable}
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
                }
              }}
              aria-label={tt("標題", "Title")}
              className={`field-sizing-content w-full resize-none rounded-[4px] bg-transparent px-1 py-0.5 font-heading text-xl leading-snug font-medium outline-none hover:bg-muted/60 focus:bg-muted/60 disabled:hover:bg-transparent ${
                task.status === "done" ? "text-muted-foreground line-through" : ""
              }`}
            />
          </SheetTitle>
        </div>

        <dl className="grid grid-cols-[7rem_1fr] items-center gap-x-3 gap-y-2 text-sm">
          <dt className="text-muted-foreground">{tt("狀態", "Status")}</dt>
          <dd className="max-w-48 overflow-hidden rounded-[4px]">
            <ColorCell value={task.status} options={statusOptions} disabled={!editable} onChange={(value) => onPatch({ status: value })} />
          </dd>
          <dt className="text-muted-foreground">{tt("優先級", "Priority")}</dt>
          <dd className="max-w-48 overflow-hidden rounded-[4px]">
            <ColorCell value={task.priority} options={priorityOptions} disabled={!editable} onChange={(value) => onPatch({ priority: value })} />
          </dd>
          <dt className="text-muted-foreground">{tt("負責人", "Assignee")}</dt>
          <dd className="flex h-8 items-center">
            <PersonCell
              name={task.assignee_name}
              disabled={!editable}
              options={people}
              onChange={(value) => onPatch({ assignee_id: value === "none" ? null : Number(value) })}
            />
          </dd>
          <dt className="text-muted-foreground">{tt("截止日", "Due date")}</dt>
          <dd className="-ml-1.5 flex h-8 items-center">
            <DueCell task={task} today={today} disabled={!editable} onChange={(value) => onPatch({ due_date: value })} />
          </dd>
          <dt className="text-muted-foreground">{tt("組別", "Subteam")}</dt>
          <dd>
            <Choice value={task.subteam} disabled={!editable} options={subteams} onChange={(value) => onPatch({ subteam: value })} ariaLabel={tt("組別", "Subteam")} />
          </dd>
          <dt className="text-muted-foreground">{tt("開發週期", "Cycle")}</dt>
          <dd>
            <Choice
              value={task.cycle_id != null ? String(task.cycle_id) : ""}
              disabled={!editable || cycleOptions.length === 0}
              options={cycleOptions}
              onChange={(value) => onPatch({ cycle_id: Number(value) })}
              ariaLabel={tt("開發週期", "Cycle")}
            />
          </dd>
          {task.completed_at && (
            <>
              <dt className="text-muted-foreground">{tt("完成於", "Completed")}</dt>
              <dd className="tabular-nums">{new Date(task.completed_at).toLocaleString()}</dd>
            </>
          )}
        </dl>

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">{tt("描述", "Description")}</h3>
          <textarea
            className="field-sizing-content min-h-28 rounded-[8px] border border-input bg-background px-3 py-2 text-sm leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-80"
            value={description}
            placeholder={editable ? tt("加入細節、規格、連結…", "Add details, specs, links…") : tt("沒有描述", "No description")}
            disabled={!editable}
            onChange={(event) => setDescription(event.target.value)}
            onBlur={saveDescription}
          />
          {editable && description !== task.description && (
            <p className="text-xs text-muted-foreground">{tt("離開欄位時自動儲存", "Saves when you click away")}</p>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-medium">{tt("子任務", "Subtasks")}</h3>
            {items.length > 0 && <Progress done={doneCount} total={items.length} className="w-40" />}
          </div>
          <ul className="flex flex-col">
            {items.map((item) => (
              <li key={item.id} className="group flex min-h-9 items-center gap-2.5 rounded-[4px] px-1 hover:bg-muted/60">
                <input
                  type="checkbox"
                  className="size-4 shrink-0 accent-[#00c875]"
                  checked={!!item.done}
                  disabled={!editable}
                  onChange={() => toggleItem(item)}
                  aria-label={item.text}
                />
                {editingItem?.id === item.id ? (
                  <input
                    autoFocus
                    value={editingItem.text}
                    onChange={(event) => setEditingItem({ id: item.id, text: event.target.value })}
                    onBlur={() => renameItem(item, editingItem.text)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") renameItem(item, editingItem.text);
                      if (event.key === "Escape") setEditingItem(null);
                    }}
                    className="h-7 min-w-0 flex-1 rounded-[4px] border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring"
                  />
                ) : (
                  <button
                    type="button"
                    disabled={!editable}
                    onClick={() => setEditingItem({ id: item.id, text: item.text })}
                    className={`min-w-0 flex-1 py-1 text-left text-sm ${item.done ? "text-muted-foreground line-through" : ""}`}
                  >
                    {item.text}
                  </button>
                )}
                {editable && (
                  <button
                    type="button"
                    onClick={() => removeItem(item)}
                    className="flex size-7 shrink-0 items-center justify-center rounded-[4px] text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted hover:text-foreground focus-visible:opacity-100"
                    aria-label={tt("刪除子任務", "Delete subtask")}
                  >
                    <XIcon className="size-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
          {items.length === 0 && !editable && <p className="text-sm text-muted-foreground">{tt("沒有子任務", "No subtasks")}</p>}
          {editable && (
            <form
              className="flex items-center gap-2 rounded-[4px] border border-dashed border-input px-2 focus-within:border-ring"
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
                className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </form>
          )}
        </section>

        {!editable && (
          <p className="rounded-[8px] bg-muted px-3 py-2 text-xs text-muted-foreground">
            {tt("只有隊長、負責人或建立者可以修改這個任務", "Only leaders, the assignee or the creator can edit this task")}
          </p>
        )}
      </div>
    </div>
  );
}
