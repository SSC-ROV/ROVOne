"use client";

import { useEffect, useState } from "react";

/** 明暗模式切換：跟隨 localStorage（rov_theme），切換即時生效並持久化 */
export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const cur = document.documentElement.dataset.theme;
    setTheme(cur === "dark" ? "dark" : "light");
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("rov_theme", next);
    } catch {
      /* 忽略 */
    }
    setTheme(next);
  }

  return (
    <button
      onClick={toggle}
      title={theme === "light" ? "切換深色模式" : "Switch to light mode"}
      aria-label={theme === "light" ? "切換深色模式" : "Switch to light mode"}
      className={
        compact
          ? "flex h-11 w-11 items-center justify-center rounded-lg text-ink-subtle transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
          : "rounded-lg border border-hairline px-2 py-1 text-xs text-ink-muted transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
      }
    >
      {theme === "light" ? "🌙" : "☀️"}
    </button>
  );
}
