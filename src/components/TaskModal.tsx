"use client";
import { useI18n } from "@/lib/i18n";
import { isStaff } from "@/lib/roles";


import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import {
  BTN,
  BTN_GHOST,
  INPUT_CLS,
  PRIORITIES,
  STATUSES,
  SUBTEAMS,
} from "@/lib/ui";
import { useDialogs } from "@/components/ui/Dialogs";
import { cycleStatus } from "@/lib/ui";
import type { ChecklistItem, Cycle, Me, Member, Task } from "@/lib/types";

export default function TaskModal({
  mode,
  task,
  members,
  cycles,
  me,
  onClose,
  onChanged,
}: {
  mode: "create" | "edit";
  task: Task | null;
  members: Member[];
  cycles?: Cycle[];
  me: Me;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t } = useI18n();
  const { confirm, toast } = useDialogs();
  const canEdit =
    mode === "create" ||
    isStaff(me.role) ||
    task?.assignee_id === me.id ||
    task?.created_by === me.id;

  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [status, setStatus] = useState(task?.status ?? "todo");
  const [priority, setPriority] = useState(task?.priority ?? "medium");
  const [subteam, setSubteam] = useState(task?.subteam ?? "general");
  const [dueDate, setDueDate] = useState(task?.due_date ?? "");
  const [assigneeId, setAssigneeId] = useState<string>(
    task?.assignee_id ? String(task.assignee_id) : ""
  );
  const [cycleId, setCycleId] = useState<string>(
    task?.cycle_id ? String(task.cycle_id) : ""
  );
  const [items, setItems] = useState<ChecklistItem[]>(task?.items ?? []);
  const [newItem, setNewItem] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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
      version: task?.version,
      title: title.trim(),
      description,
      status,
      priority,
      subteam,
      due_date: dueDate || null,
      assignee_id: assigneeId ? Number(assigneeId) : null,
      cycle_id: cycleId ? Number(cycleId) : null,
    };
    try {
      if (mode === "create") {
        await api("/api/tasks", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      } else {
        await api(`/api/tasks/${task!.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
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
      const r = await api<{ item: ChecklistItem }>(
        `/api/tasks/${task.id}/items`,
        { method: "POST", body: JSON.stringify({ text: newItem.trim() }) }
      );
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
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">
            {mode === "create" ? t("新增任務") : canEdit ? t("編輯任務") : t("任務詳情")}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm text-slate-400">{t("標題")}</label>
            <input
              className={INPUT_CLS}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={!canEdit}
              placeholder="例如：完成推進器選型"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-400">{t("描述")}</label>
            <textarea
              className={`${INPUT_CLS} min-h-20 resize-y`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={!canEdit}
              placeholder="補充說明、規格、連結…"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm text-slate-400">{t("組別")}</label>
              <select
                className={INPUT_CLS}
                value={subteam}
                onChange={(e) => setSubteam(e.target.value as Task["subteam"])}
                disabled={!canEdit}
              >
                {SUBTEAMS.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-400">{t("負責人")}</label>
              <select
                className={INPUT_CLS}
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                disabled={!canEdit}
              >
                <option value="">未指派</option>
                {members.map((m) => (
                  <option key={m.id} value={String(m.id)}>
                    {m.display_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-400">{t("優先級")}</label>
              <select
                className={INPUT_CLS}
                value={priority}
                onChange={(e) => setPriority(e.target.value as Task["priority"])}
                disabled={!canEdit}
              >
                {PRIORITIES.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-400">{t("狀態")}</label>
              <select
                className={INPUT_CLS}
                value={status}
                onChange={(e) => setStatus(e.target.value as Task["status"])}
                disabled={!canEdit}
              >
                {STATUSES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-sm text-slate-400">{t("所屬開發週期（選填）")}</label>
              <select
                className={INPUT_CLS}
                value={cycleId}
                onChange={(e) => setCycleId(e.target.value)}
                disabled={!canEdit}
              >
                <option value="">{t("不對應")}</option>
                {(cycles ?? [])
                  .filter((c) => c.status === "active" || c.status === "pending_leader" || c.status === "pending_teacher")
                  .map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.title}（{cycleStatus(c.status).label}）
                    </option>
                  ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-sm text-slate-400">{t("截止日期")}</label>
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
              <label className="mb-1 block text-sm text-slate-400">
                {t("子任務")} ({items.filter((i) => i.done).length}/{items.length})
              </label>
              <ul className="mb-2 space-y-1.5">
                {items.map((item) => (
                  <li key={item.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-cyan-500"
                      checked={!!item.done}
                      onChange={() => toggleItem(item)}
                      disabled={!canEdit}
                    />
                    <span
                      className={`flex-1 ${
                        item.done ? "text-slate-500 line-through" : ""
                      }`}
                    >
                      {item.text}
                    </span>
                    {canEdit && (
                      <button
                        onClick={() => deleteItem(item)}
                        className="text-slate-500 transition hover:text-rose-400"
                        title="刪除子任務"
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
          {mode === "create" && (
            <p className="text-xs text-slate-500">
              子任務清單在建立任務後即可{t("加入")}。
            </p>
          )}

          {error && (
            <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
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
              {mode === "edit" && isStaff(me.role) && (
                <button
                  onClick={remove}
                  disabled={busy}
                  className="ml-auto text-sm text-slate-500 transition hover:text-rose-400"
                >
                  {t("刪除任務")}
                </button>
              )}
            </div>
          ) : (
            <p className="pt-2 text-xs text-slate-500">{t("只有隊長、負責人或建立者可以修改這個任務。")}</p>
          )}
        </div>
      </div>
    </div>
  );
}
