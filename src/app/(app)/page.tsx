"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckIcon, LayoutTemplateIcon, PencilIcon, PlusIcon, RotateCcwIcon } from "lucide-react";
import { api } from "@/lib/api-client";
import { todayStr } from "@/lib/date";
import { tt } from "@/lib/i18n-core";
import { useI18n } from "@/lib/i18n";
import { useSubteams } from "@/lib/subteams";
import { PageError, PageLoading } from "@/components/PageState";
import { BoardHeader } from "@/components/board/BoardHeader";
import { Button } from "@/components/ui/button";
import { useDialogs } from "@/components/ui/Dialogs";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { WidgetBody, type DashData } from "@/components/dashboard/widgets";
import { TemplatesDialog, WidgetFrame, WidgetLibrary } from "@/components/dashboard/DashboardEditor";
import {
  TEMPLATES,
  buildTemplate,
  newWidgetId,
  widgetDef,
  type DashboardLayout,
  type TemplateKey,
  type WidgetConfig,
  type WidgetSize,
} from "@/lib/dashboard/catalog";
import type { Cycle, Me, Part, Settings, Task, TeamEvent } from "@/lib/types";

export default function DashboardPage() {
  const { t } = useI18n();
  const { subteams } = useSubteams();
  const { confirm, toast } = useDialogs();
  const [me, setMe] = useState<Me | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [cycles, setCycles] = useState<Cycle[] | null>(null);
  const [events, setEvents] = useState<TeamEvent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  /** Saved layout; null = never customized (show the Overview template). */
  const [saved, setSaved] = useState<DashboardLayout | null | undefined>(undefined);
  const [draft, setDraft] = useState<DashboardLayout | null>(null);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const scrollTo = useRef<string | null>(null);

  useEffect(() => {
    (async () => {
      const [u, s, c, e, taskRes, partRes, dash] = await Promise.all([
        api<{ user: Me | null }>("/api/auth/me"),
        api<Settings>("/api/settings"),
        api<{ cycles: Cycle[] }>("/api/cycles"),
        api<{ events: TeamEvent[] }>("/api/events"),
        api<{ tasks: Task[] }>("/api/tasks"),
        api<{ parts: Part[] }>("/api/parts"),
        api<{ layout: DashboardLayout | null }>("/api/dashboard").catch(() => ({ layout: null })),
      ]);
      if (!u.user) {
        window.location.href = "/login";
        return;
      }
      setMe(u.user);
      setSettings(s);
      setCycles(c.cycles);
      setEvents(e.events);
      setTasks(taskRes.tasks);
      setParts(partRes.parts);
      setSaved(dash.layout);
    })().catch((err: Error) => setError(err.message));
  }, []);

  const editing = draft != null;
  const fallback = useMemo(() => buildTemplate("overview", subteams), [subteams]);
  const layout = draft ?? saved ?? fallback;

  // Bring a newly added widget into view.
  useEffect(() => {
    if (!scrollTo.current) return;
    document.getElementById(`w-${scrollTo.current}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    scrollTo.current = null;
  }, [draft]);

  if (error) return <PageError message={t(error)} />;
  if (!cycles || !me || !settings || saved === undefined) return <PageLoading label={t("載入中…")} />;

  const subteamName = (key: string) => {
    const s = subteams.find((x) => x.key === key);
    return s ? s.label : key;
  };
  const data: DashData = { me, settings, cycles, events, tasks, parts, today: todayStr(), subteamLabel: subteamName };
  const subteamOptions = subteams.map((s) => ({ key: s.key, label: s.label }));

  async function persist(next: DashboardLayout) {
    setSaving(true);
    try {
      const res = await api<{ layout: DashboardLayout }>("/api/dashboard", { method: "PUT", body: JSON.stringify({ layout: next }) });
      setSaved(res.layout);
      return true;
    } catch (err) {
      toast(t((err as Error).message), "err");
      return false;
    } finally {
      setSaving(false);
    }
  }

  const update = (fn: (widgets: WidgetConfig[]) => WidgetConfig[]) =>
    setDraft((d) => (d ? { ...d, widgets: fn(d.widgets) } : d));

  function addWidget(type: string, size: WidgetSize) {
    const def = widgetDef(type);
    if (!def) return;
    const id = newWidgetId();
    scrollTo.current = id;
    update((ws) => [...ws, { id, type: def.type as WidgetConfig["type"], size, settings: {} }]);
    setLibraryOpen(false);
  }

  function move(id: string, delta: number) {
    update((ws) => {
      const i = ws.findIndex((w) => w.id === id);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= ws.length) return ws;
      const next = [...ws];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function dropOn(targetId: string) {
    if (!dragId || dragId === targetId) return;
    update((ws) => {
      const from = ws.findIndex((w) => w.id === dragId);
      const to = ws.findIndex((w) => w.id === targetId);
      if (from < 0 || to < 0) return ws;
      const next = [...ws];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }

  async function pickTemplate(key: TemplateKey) {
    const tpl = TEMPLATES.find((x) => x.key === key)!;
    const ok = await confirm({
      title: tt(`套用「${tpl.zh}」範本？`, `Use the ${tpl.en} template?`),
      message: tt("目前的儀表板會被這個範本取代。", "Your current dashboard will be replaced by this template."),
      confirmText: tt("套用", "Use template"),
    });
    if (!ok) return;
    const next = buildTemplate(key, subteams);
    setTemplatesOpen(false);
    if (editing) {
      setDraft(next);
    } else if (await persist(next)) {
      toast(tt(`已套用「${tpl.zh}」`, `Switched to ${tpl.en}`));
    }
  }

  async function finishEditing() {
    if (draft && (await persist(draft))) {
      setDraft(null);
      setLibraryOpen(false);
      toast(tt("儀表板已儲存", "Dashboard saved"));
    }
  }

  async function resetToTemplate() {
    const tpl = TEMPLATES.find((x) => x.key === layout.template) ?? TEMPLATES[0];
    const ok = await confirm({
      title: tt("重設儀表板？", "Reset the dashboard?"),
      message: tt(`會回到「${tpl.zh}」範本的原始樣子。`, `This puts back the original ${tpl.en} template.`),
      confirmText: tt("重設", "Reset"),
      danger: true,
    });
    if (ok) setDraft(buildTemplate(tpl.key, subteams));
  }

  const chipsFor = (w: WidgetConfig) => {
    const chips: string[] = [];
    if (w.settings.subteam) chips.push(subteamName(w.settings.subteam));
    if (w.settings.mine) chips.push(tt("我的", "Mine"));
    if (w.settings.groupBy === "person") chips.push(tt("依成員", "By person"));
    return chips;
  };

  return (
    <div className="flex w-full flex-col">
      <BoardHeader
        title={t("總覽")}
        subtitle={settings.team_name}
        action={
          editing ? (
            <>
              <Button type="button" variant="ghost" onClick={resetToTemplate}>
                <RotateCcwIcon /> {tt("重設", "Reset")}
              </Button>
              <Button type="button" variant="outline" onClick={() => setTemplatesOpen(true)}>
                <LayoutTemplateIcon /> {tt("範本", "Templates")}
              </Button>
              <Button type="button" variant="outline" className="lg:hidden" onClick={() => setLibraryOpen(true)}>
                <PlusIcon /> {tt("新增元件", "Add widget")}
              </Button>
              <Button type="button" variant="ghost" onClick={() => { setDraft(null); setLibraryOpen(false); }}>
                {tt("取消", "Cancel")}
              </Button>
              <Button type="button" onClick={finishEditing} disabled={saving}>
                <CheckIcon /> {saving ? tt("儲存中…", "Saving…") : tt("完成", "Done")}
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => setTemplatesOpen(true)}>
                <LayoutTemplateIcon /> {tt("範本", "Templates")}
              </Button>
              <Button type="button" variant="outline" onClick={() => setDraft(structuredClone(layout))}>
                <PencilIcon /> {tt("自訂", "Customize")}
              </Button>
            </>
          )
        }
      />

      <div className="flex items-start gap-5">
        <div className="@container min-w-0 flex-1">
          {editing && (
            <p className="mb-3 text-sm text-muted-foreground">
              {tt(
                "拖曳元件可調整順序；點齒輪可改大小與篩選；點左上角的 − 移除。",
                "Drag widgets to reorder, use the gear to change size and filters, and the − in the corner to remove."
              )}
            </p>
          )}
          {layout.widgets.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-[12px] border border-dashed border-border px-4 py-16 text-center">
              <p className="text-sm text-muted-foreground">{tt("儀表板是空的。", "Your dashboard is empty.")}</p>
              <div className="flex gap-2">
                {!editing && (
                  <Button type="button" variant="outline" onClick={() => setDraft(structuredClone(layout))}>
                    <PlusIcon /> {tt("新增元件", "Add widgets")}
                  </Button>
                )}
                <Button type="button" variant="outline" onClick={() => setTemplatesOpen(true)}>
                  <LayoutTemplateIcon /> {tt("選擇範本", "Pick a template")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 [grid-auto-flow:dense] [grid-auto-rows:168px] @3xl:grid-cols-12">
              {layout.widgets.map((w, i) => {
                const def = widgetDef(w.type);
                if (!def) return null;
                const title = w.settings.title || tt(def.zh, def.en);
                return (
                  <WidgetFrame
                    key={w.id}
                    widget={w}
                    title={title}
                    chips={chipsFor(w)}
                    editing={editing}
                    index={i}
                    count={layout.widgets.length}
                    subteams={subteamOptions}
                    dragging={dragId === w.id}
                    onRemove={() => update((ws) => ws.filter((x) => x.id !== w.id))}
                    onChange={(next) => update((ws) => ws.map((x) => (x.id === w.id ? next : x)))}
                    onMove={(delta) => move(w.id, delta)}
                    dragProps={{
                      draggable: true,
                      onDragStart: (e) => {
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", w.id);
                        setDragId(w.id);
                      },
                      onDragEnter: () => dropOn(w.id),
                      onDragOver: (e) => e.preventDefault(),
                      onDrop: (e) => e.preventDefault(),
                      onDragEnd: () => setDragId(null),
                    }}
                  >
                    <WidgetBody widget={w} data={data} />
                  </WidgetFrame>
                );
              })}
            </div>
          )}
        </div>

        {editing && (
          <aside className="sticky top-0 hidden h-[calc(100dvh-7.5rem)] w-80 shrink-0 overflow-hidden rounded-[12px] border border-border bg-background lg:block">
            <WidgetLibrary onAdd={addWidget} />
          </aside>
        )}
      </div>

      <Sheet open={editing && libraryOpen} onOpenChange={setLibraryOpen}>
        <SheetContent side="right" showCloseButton={false} className="w-full gap-0 p-0 sm:max-w-sm lg:hidden">
          <SheetTitle className="sr-only">{tt("元件庫", "Components")}</SheetTitle>
          <WidgetLibrary onAdd={addWidget} onClose={() => setLibraryOpen(false)} />
        </SheetContent>
      </Sheet>

      <TemplatesDialog
        open={templatesOpen}
        onOpenChange={setTemplatesOpen}
        current={saved || draft ? layout.template : null}
        subteams={subteams}
        onPick={pickTemplate}
      />
    </div>
  );
}
