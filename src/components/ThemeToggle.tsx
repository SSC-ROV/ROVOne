"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

/** 明暗模式切換：跟隨 localStorage（rov_theme），切換即時生效並持久化 */
export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("rov_theme");
      setTheme(saved === "light" ? "light" : "dark");
    } catch {
      setTheme("dark");
    }
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    document.documentElement.classList.toggle("dark", next === "dark");
    document.documentElement.style.colorScheme = next;
    try {
      localStorage.setItem("rov_theme", next);
    } catch {
      /* 忽略 */
    }
    setTheme(next);
  }

  const label = theme === "light" ? t("切換深色模式") : t("切換淺色模式");

  return (
    <Button
      type="button"
      variant="ghost"
      size={compact ? "icon" : "default"}
      onClick={toggle}
      title={label}
      aria-label={label}
      className="text-[#676879]"
    >
      {theme === "light" ? t("深色") : t("淺色")}
    </Button>
  );
}
