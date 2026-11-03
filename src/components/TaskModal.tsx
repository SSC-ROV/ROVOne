"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { BTN, BTN_GHOST, INPUT_CLS, PRIORITIES, STATUSES } from "@/lib/ui";
import { useI18n } from "@/lib/i18n";
import { useDialogs } from "@/components/ui/Dialogs";
import { ChevronDownIcon } from "lucide-react";
import { ColorCell } from "@/components/board/ColorCell";
import { AvatarStack, PeopleChecklist, peopleSummary } from "@/components/board/PersonCell";
import { Choice } from "@/components/tasks/shared";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { isAssignedTo, type ChecklistItem, type Me, type Member, type Task } from "@/lib/types";

export default function TaskModal({
  mode,
  task,
  cycleId,
  cycleTitle,
  members,
  subteams,
  me,
  onClose,
  onChanged,
}: {
  mode: "create" | "edit";
  task: Task | null;
  cycleId: number;
  cycleTitle: string;
  members: Member[];
  subteams: { key: string; label: string }[];
  me: Me;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t } = useI18n();
  const { confirm, toast } = useDialogs();
  const canEdit =
    mode === "create" ||
    isStaffRole(me.role) ||
    (!!task && isAssignedTo(task, me.id)) ||
    task?.created_by === me.id;

  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [status, setStatus] = useState(task?.status ?? "todo");
  const [priority, setPriority] = useState(task?.priority ?? "medium");
  const [subteam, setSubteam] = useState(task?.subteam ?? "general");
  const [dueDate, setDueDate] = useState(task?.due_date ?? "");
  const [assigneeIds, setAssigneeIds] = useState<number[]>(task?.assignee_ids ?? []);
  const [items, setItems] = useState<ChecklistItem[]>(task?.items ?? []);
  const [newItem, setNewItem] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const people = members.map((m) => ({ value: String(m.id), label: m.display_name }));
  const assigneeNames = assigneeIds.map((id) => members.find((m) => m.id === id)?.display_name ?? "").filter(Boolean);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save() {
    if (!title.trim()) {
      setError(t("請填寫任務標題"));
      return;
    }
    setBusy(true);
    setError("");
    const payload = {
      title: title.trim(),
      description,
      status,
      priority,
      subteam,
      due_date: dueDate || null,
      assignee_ids: assigneeIds,
      cycle_id: cycleId,
      ...(task ? { version: task.version } : {}),
    };
    try {
      if (mode === "create") {
        await api("/api/tasks", { method: "POST", body: JSON.stringify(payload) });
      } else {
        await api(`/api/tasks/${task!.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      }
      onChanged();
      onClose();
    } catch (err) {
      setError(t((err as Error).message));
      setBusy(false);
    }
  }

  async function remove() {
    if (!task) return;
    const ok = await confirm({
      title: `${t("刪除")}「${task.title}」？`,
      message: t("刪除後無法復原。"),
      confirmText: t("刪除"),
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await api(`/api/tasks/${task.id}`, { method: "DELETE" });
      onChanged();
      onClose();
    } catch (err) {
      setError(t((err as Error).message));
      setBusy(false);
    }
  }

  async function addItem() {
    if (!newItem.trim() || !task) return;
    try {
      const r = await api<{ item: ChecklistItem }>(`/api/tasks/${task.id}/items`, {
        method: "POST",
        body: JSON.stringify({ text: newItem.trim() }),
      });
      setItems((prev) => [...prev, r.item]);
      setNewItem("");
      onChanged();
    } catch (err) {
      toast(t((err as Error).message), "err");
    }
  }

  async function toggleItem(item: ChecklistItem) {
    try {
      const r = await api<{ item: ChecklistItem }>(`/api/items/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ done: !item.done }),
      });
      setItems((prev) => prev.map((i) => (i.id === item.id ? r.item : i)));
      onChanged();
    } catch (err) {
      toast(t((err as Error).message), "err");
    }
  }

  async function deleteItem(item: ChecklistItem) {
    try {
      await api(`/api/items/${item.id}`, { method: "DELETE" });
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      onChanged();
    } catch (err) {
      toast(t((err as Error).message), "err");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-hairline bg-surface-1 p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">
            {mode === "create" ? t("新增任務") : canEdit ? t("編輯任務") : t("任務詳情")}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-ink-subtle transition hover:bg-surface-2 hover:text-ink"
          >
            ✕
          </button>
        </div>

        <p className="mb-3 text-xs text-ink-tertiary">
          {t("所屬專案")}：{cycleTitle}
        </p>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm text-ink-subtle">{t("標題")}</label>
            <input
              className={INPUT_CLS}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={!canEdit}
              placeholder={t("例如：完成推進器選型")}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-ink-subtle">{t("描述")}</label>
            <textarea
              className={`${INPUT_CLS} min-h-20 resize-y`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={!canEdit}
              placeholder={t("補充說明、規格、連結…")}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm text-ink-subtle">{t("組別")}</label>
              <Choice
                value={subteam}
                onChange={(value) => setSubteam(value as Task["subteam"])}
                options={subteams.map((s) => ({ value: s.key, label: s.label }))}
                disabled={!canEdit}
                className="w-full"
                ariaLabel={t("組別")}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-ink-subtle">{t("負責人")}</label>
              <Popover>
                <PopoverTrigger
                  type="button"
                  disabled={!canEdit}
                  aria-label={t("負責人")}
                  className="flex h-7 w-full min-w-0 items-center gap-2 rounded-[min(var(--radius-md),10px)] border border-input bg-transparent px-2 text-left text-sm hover:bg-muted disabled:cursor-default disabled:hover:bg-transparent dark:bg-input/30"
                >
                  {assigneeNames.length ? <AvatarStack names={assigneeNames} size={18} /> : null}
                  <span className={`min-w-0 flex-1 truncate ${assigneeNames.length ? "" : "text-muted-foreground"}`}>
                    {assigneeNames.length ? peopleSummary(assigneeNames) : t("未指派")}
                  </span>
                  <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </PopoverTrigger>
                <PopoverContent className="max-h-80 w-64 max-w-[calc(100vw-2rem)] gap-0.5 overflow-y-auto p-1" align="start">
                  <PeopleChecklist options={people} value={assigneeIds} onChange={setAssigneeIds} />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <label className="mb-1 block text-sm text-ink-subtle">{t("優先級")}</label>
              <ColorCell
                kind="priority"
                value={priority}
                options={PRIORITIES.map((p) => ({ value: p.key, label: p.label, color: p.color }))}
                disabled={!canEdit}
                onChange={(value) => setPriority(value as Task["priority"])}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-ink-subtle">{t("狀態")}</label>
              <ColorCell
                value={status}
                options={STATUSES.map((s) => ({ value: s.key, label: s.label, color: s.color }))}
                disabled={!canEdit}
                onChange={(value) => setStatus(value as Task["status"])}
              />
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-sm text-ink-subtle">{t("截止日期")}</label>
              <input
                type="date"
                className={INPUT_CLS}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={!canEdit}
              />
            </div>
          </div>

          {mode === "edit" && (
            <div>
              <label className="mb-1 block text-sm text-ink-subtle">
                {t("子任務")} ({items.filter((i) => i.done).length}/{items.length})
              </label>
              <ul className="mb-2 space-y-1.5">
                {items.map((item) => (
                  <li key={item.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      checked={!!item.done}
                      onChange={() => toggleItem(item)}
                      disabled={!canEdit}
                    />
                    <span className={`flex-1 ${item.done ? "text-ink-tertiary line-through" : ""}`}>
                      {item.text}
                    </span>
                    {canEdit && (
                      <button
                        onClick={() => deleteItem(item)}
                        className="text-ink-tertiary transition hover:text-rose-400"
                      >
                        ✕
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {canEdit && (
                <div className="flex gap-2">
                  <input
                    className={INPUT_CLS}
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addItem()}
                    placeholder={t("新增子任務，按 Enter 送出")}
                  />
                  <button className={BTN_GHOST} onClick={addItem}>
                    {t("加入")}
                  </button>
                </div>
              )}
            </div>
          )}

          {error && (
            <p className="rounded-lg border border-rose-500/30 bg-red-50 px-3 py-2 text-sm text-[#eb5757]">
              {error}
            </p>
          )}

          {canEdit ? (
            <div className="flex items-center gap-2 pt-2">
              <button className={BTN} onClick={save} disabled={busy}>
                {busy ? t("處理中…") : mode === "create" ? t("建立任務") : t("儲存")}
              </button>
              <button className={BTN_GHOST} onClick={onClose} disabled={busy}>
                {t("取消")}
              </button>
              {mode === "edit" && isStaffRole(me.role) && (
                <button
                  onClick={remove}
                  disabled={busy}
                  className="ml-auto text-sm text-ink-tertiary transition hover:text-rose-400"
                >
                  {t("刪除任務")}
                </button>
              )}
            </div>
          ) : (
            <p className="pt-2 text-xs text-ink-tertiary">
              {t("只有隊長、負責人或建立者可以修改這個任務。")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function isStaffRole(role: string) {
  return role === "leader" || role === "teacher";
}
