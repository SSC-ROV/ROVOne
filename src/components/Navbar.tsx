"use client";
import { isStaff } from "@/lib/roles";


import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { Me } from "@/lib/types";

export default function Navbar({
  user,
  teamName,
}: {
  user: Me;
  teamName: string;
}) {
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const links = [
    { href: "/", label: "首頁" },
    { href: "/board", label: "看板" },
    { href: "/calendar", label: "日曆" },
    { href: "/cycles", label: "開發週期" },
    { href: "/missions", label: "比賽任務" },
    { href: "/parts", label: "零件採買" },
    { href: "/equipment", label: "設備" },
    { href: "/divelogs", label: "水測日誌" },
    ...(isStaff(user.role) ? [{ href: "/admin", label: "管理" }] : []),
    { href: "/account", label: "帳號" },
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
            onClick={logout}
            disabled={busy}
            className="text-slate-400 transition hover:text-rose-300"
          >
            登出
          </button>
        </div>
      </div>
    </header>
  );
}
