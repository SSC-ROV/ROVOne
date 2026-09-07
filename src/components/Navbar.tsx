"use client";
import { isStaff } from "@/lib/roles";


import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import type { Me } from "@/lib/types";

export default function Navbar({
  user,
  teamName,
}: {
  user: Me;
  teamName: string;
}) {
  const pathname = usePathname();
  const { t, lang, toggle } = useI18n();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const links = [
    { href: "/", label: t("首頁") },
    { href: "/board", label: t("看板") },
    { href: "/calendar", label: t("日曆") },
    { href: "/cycles", label: t("開發週期") },
    { href: "/missions", label: t("比賽任務") },
    { href: "/parts", label: t("零件採買") },
    { href: "/equipment", label: t("設備") },
    { href: "/divelogs", label: t("水測日誌") },
    ...(isStaff(user.role) ? [{ href: "/admin", label: t("管理") }] : []),
    { href: "/account", label: t("帳號") },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-bold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 text-[10px] font-black text-slate-950">
            ROV
          </span>
          <span className="hidden max-w-40 truncate sm:inline">{teamName}</span>
        </Link>
        <nav className="flex flex-1 gap-1 overflow-x-auto">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-sm transition ${
                pathname === l.href
                  ? "bg-slate-800 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-3 text-sm">
          <span className="hidden text-slate-400 sm:inline">
            {user.display_name}
          </span>
          <button
            onClick={toggle}
            className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300 transition hover:border-slate-500 hover:text-white"
            title={lang === "zh" ? "Switch to English" : "切換至中文"}
          >
            {lang === "zh" ? "EN" : "中"}
          </button>
          <button
            onClick={logout}
            disabled={busy}
            className="text-slate-400 transition hover:text-rose-300"
          >
            {t("登出")}
          </button>
        </div>
      </div>
    </header>
  );
}
