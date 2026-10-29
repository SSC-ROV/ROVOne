"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n";
import type { Cycle, Equipment, Part, Task } from "@/lib/types";

type Hit = { key: string; label: string; hint: string; run: () => void };

export default function CommandPalette() {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  function openPalette() {
    setQ("");
    setActive(0);
    setOpen(true);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openPalette();
        return;
      }
      if (e.key === "/" && !isTyping(e.target)) {
        e.preventDefault();
        openPalette();
      }
    }
    function onOpen() {
      openPalette();
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("rov-palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("rov-palette", onOpen);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    let cancelled = false;
    Promise.all([
      api<{ tasks: Task[] }>("/api/tasks"),
      api<{ parts: Part[] }>("/api/parts"),
      api<{ equipment: Equipment[] }>("/api/equipment"),
      api<{ cycles: Cycle[] }>("/api/cycles"),
    ])
      .then(([taskRes, partRes, equipRes, cycleRes]) => {
        if (cancelled) return;
        setTasks(taskRes.tasks);
        setParts(partRes.parts);
        setEquipment(equipRes.equipment);
        setCycles(cycleRes.cycles);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [open]);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  function openTask(task: Task) {
    sessionStorage.setItem("rov-open-task", String(task.id));
    setOpen(false);
    router.push(`/work?task=${task.id}`);
    window.dispatchEvent(new Event("rov-open-task"));
  }

  const hits = (() => {
    const needle = q.trim().toLowerCase();
    const pages: Hit[] = [
      { key: "home", label: t("首頁"), hint: t("頁面"), run: () => go("/") },
      { key: "work", label: t("工作"), hint: t("頁面"), run: () => go("/work") },
      { key: "cal", label: t("日曆"), hint: t("頁面"), run: () => go("/calendar") },
      { key: "cycles", label: t("開發週期"), hint: t("頁面"), run: () => go("/cycles") },
      { key: "parts", label: t("零件採買"), hint: t("頁面"), run: () => go("/parts") },
      { key: "equip", label: t("租借設備"), hint: t("頁面"), run: () => go("/equipment") },
      { key: "logs", label: t("水測日誌"), hint: t("頁面"), run: () => go("/divelogs") },
      { key: "account", label: t("帳號"), hint: t("頁面"), run: () => go("/account") },
    ];
    const taskHits: Hit[] = tasks.map((task) => ({
      key: `t${task.id}`,
      label: task.title,
      hint: t("任務"),
      run: () => openTask(task),
    }));
    const partHits: Hit[] = parts.map((part) => ({
      key: `p${part.id}`,
      label: part.name,
      hint: t("零件採買"),
      run: () => go("/parts"),
    }));
    const equipHits: Hit[] = equipment.map((item) => ({
      key: `e${item.id}`,
      label: item.name,
      hint: t("租借設備"),
      run: () => go("/equipment"),
    }));
    const cycleHits: Hit[] = cycles.map((cycle) => ({
      key: `c${cycle.id}`,
      label: cycle.title,
      hint: t("開發週期"),
      run: () => go("/cycles"),
    }));
    const all = [...pages, ...taskHits, ...cycleHits, ...partHits, ...equipHits];
    if (!needle) return all.slice(0, 12);
    return all.filter((hit) => hit.label.toLowerCase().includes(needle)).slice(0, 12);
  })();

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center bg-black/50 p-4 pt-[12vh]"
      onClick={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-label={t("搜尋或跳轉")}
        className="w-full max-w-lg overflow-hidden rounded-xl border border-hairline bg-surface-1 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          className="w-full border-b border-hairline bg-transparent px-4 py-3 text-sm text-ink outline-none placeholder:text-ink-tertiary"
          placeholder={t("搜尋任務、零件、設備、週期")}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => Math.min(i + 1, Math.max(hits.length - 1, 0)));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            }
            if (e.key === "Enter" && hits[active]) hits[active].run();
          }}
        />
        <ul className="max-h-80 overflow-y-auto py-1">
          {hits.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-ink-tertiary">{t("沒有符合的結果")}</li>
          )}
          {hits.map((hit, i) => (
            <li key={hit.key}>
              <button
                type="button"
                className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm ${
                  i === active ? "bg-surface-2 text-ink" : "text-ink-muted"
                }`}
                onMouseEnter={() => setActive(i)}
                onClick={hit.run}
              >
                <span className="w-16 shrink-0 text-xs text-ink-tertiary">{hit.hint}</span>
                <span className="truncate">{hit.label}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="border-t border-hairline px-4 py-2 text-xs text-ink-tertiary">
          {t("Esc 關閉")} · ⌘K
        </p>
      </div>
    </div>
  );
}

function isTyping(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}
