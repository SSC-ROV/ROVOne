"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { tt } from "@/lib/i18n-core";
import { PRIORITIES, STATUSES } from "@/lib/ui";
import { ColorCell } from "@/components/board/ColorCell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Choice, DueCell } from "./shared";
import type { Cycle } from "@/lib/types";

export type NewTaskInput = {
  title: string;
  description: string;
  cycle_id: number;
  status: string;
  priority: string;
  subteam: string;
  assignee_id: number | null;
  due_date: string | null;
};

export function NewTaskSheet({
  cycles,
  people,
  subteams,
  today,
  defaults,
  onCreate,
  onDone,
}: {
  cycles: Cycle[];
  people: { value: string; label: string }[];
  subteams: { value: string; label: string }[];
  today: string;
  defaults: Partial<NewTaskInput>;
  onCreate: (input: NewTaskInput) => Promise<boolean>;
  onDone: () => void;
}) {
  useI18n();
  const [form, setForm] = useState({
    title: "",
    description: "",
    cycle: defaults.cycle_id ? String(defaults.cycle_id) : cycles[0] ? String(cycles[0].id) : "",
    status: defaults.status ?? "todo",
    priority: defaults.priority ?? "medium",
    subteam: defaults.subteam ?? "general",
    assignee: defaults.assignee_id ? String(defaults.assignee_id) : "none",
    due: defaults.due_date ?? null,
  });
  const [another, setAnother] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  const valid = form.title.trim() !== "" && form.cycle !== "";

  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    const ok = await onCreate({
      title: form.title.trim(),
      description: form.description,
      cycle_id: Number(form.cycle),
      status: form.status,
      priority: form.priority,
      subteam: form.subteam,
      assignee_id: form.assignee === "none" ? null : Number(form.assignee),
      due_date: form.due,
    });
    setBusy(false);
    if (!ok) return;
    if (another) setForm((prev) => ({ ...prev, title: "", description: "" }));
    else onDone();
  }

  const statusOptions = STATUSES.map((item) => ({ value: item.key, label: item.label, color: item.color }));
  const priorityOptions = PRIORITIES.map((item) => ({ value: item.key, label: item.label, color: item.color }));

  return (
    <form
      className="flex h-full min-h-0 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          submit();
        }
      }}
    >
      <SheetHeader className="border-b border-border px-5">
        <SheetTitle className="text-lg">{tt("新任務", "New task")}</SheetTitle>
        <SheetDescription>{tt("任務需歸屬一個進行中的開發週期", "Tasks belong to an open development cycle")}</SheetDescription>
      </SheetHeader>

      {cycles.length === 0 ? (
        <p className="m-5 rounded-[8px] bg-muted p-4 text-sm text-muted-foreground">
          {tt("目前沒有進行中的開發週期，請先在「開發週期」頁提案", "No active development cycle right now. Propose one on the Development Cycles page first.")}
        </p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">{tt("標題", "Title")}</span>
            <Input
              autoFocus
              value={form.title}
              onChange={(event) => set("title", event.target.value)}
              placeholder={tt("例如：完成推進器選型", "e.g. Thruster selection")}
              className="h-9"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">{tt("描述", "Description")}</span>
            <textarea
              className="field-sizing-content min-h-24 rounded-[8px] border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              value={form.description}
              placeholder={tt("補充說明、規格、連結…", "Details, specs, links…")}
              onChange={(event) => set("description", event.target.value)}
            />
          </label>
          <div className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
            <div className="col-span-2 flex flex-col gap-1.5">
              <span className="font-medium">{tt("開發週期", "Cycle")}</span>
              <Choice
                value={form.cycle}
                onChange={(value) => set("cycle", value)}
                options={cycles.map((cycle) => ({ value: String(cycle.id), label: cycle.title }))}
                ariaLabel={tt("開發週期", "Cycle")}
                className="w-full"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="font-medium">{tt("狀態", "Status")}</span>
              <div className="overflow-hidden rounded-[4px]">
                <ColorCell value={form.status} options={statusOptions} onChange={(value) => set("status", value)} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="font-medium">{tt("優先級", "Priority")}</span>
              <div className="overflow-hidden rounded-[4px]">
                <ColorCell value={form.priority} options={priorityOptions} onChange={(value) => set("priority", value)} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="font-medium">{tt("負責人", "Assignee")}</span>
              <Choice value={form.assignee} onChange={(value) => set("assignee", value)} options={people} className="w-full" ariaLabel={tt("負責人", "Assignee")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="font-medium">{tt("組別", "Subteam")}</span>
              <Choice value={form.subteam} onChange={(value) => set("subteam", value)} options={subteams} className="w-full" ariaLabel={tt("組別", "Subteam")} />
            </div>
            <div className="col-span-2 flex flex-col gap-1.5">
              <span className="font-medium">{tt("截止日", "Due date")}</span>
              <div className="-ml-1.5">
                <DueCell task={{ due_date: form.due, status: form.status as "todo" }} today={today} onChange={(value) => set("due", value)} />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 border-t border-border px-5 py-3">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" className="size-4 accent-[#0073ea]" checked={another} onChange={(event) => setAnother(event.target.checked)} />
          {tt("建立後繼續新增", "Create another")}
        </label>
        <Button type="button" variant="ghost" className="ml-auto" onClick={onDone}>
          {tt("取消", "Cancel")}
        </Button>
        <Button type="submit" disabled={!valid || busy}>
          {busy ? tt("建立中…", "Creating…") : tt("建立任務", "Create task")}
        </Button>
      </div>
    </form>
  );
}
