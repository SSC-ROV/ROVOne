"use client";

import { isStaff } from "@/lib/roles";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  CalendarIcon,
  HomeIcon,
  LayoutListIcon,
  LogOutIcon,
  MenuIcon,
  RefreshCwIcon,
  SearchIcon,
  ShieldIcon,
  ShoppingCartIcon,
  UserIcon,
  WavesIcon,
  WrenchIcon,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import ThemeToggle from "./ThemeToggle";
import type { Me } from "@/lib/types";
import { initials, personColor } from "@/components/board/PersonCell";

export default function Navbar({
  user,
  teamName,
  children,
}: {
  user: Me;
  teamName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { t, lang, toggle } = useI18n();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  async function logout() {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const links = [
    { href: "/", label: t("首頁"), icon: HomeIcon },
    { href: "/work", label: t("工作"), icon: LayoutListIcon },
    { href: "/calendar", label: t("日曆"), icon: CalendarIcon },
    { href: "/cycles", label: t("開發週期"), icon: RefreshCwIcon },
    { href: "/parts", label: t("零件採買"), icon: ShoppingCartIcon },
    { href: "/equipment", label: t("租借設備"), icon: WrenchIcon },
    { href: "/divelogs", label: t("水測日誌"), icon: WavesIcon },
    ...(isStaff(user.role) ? [{ href: "/admin", label: t("管理"), icon: ShieldIcon }] : []),
  ];

  const mark = teamName.trim().slice(0, 1).toUpperCase() || "R";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
    <div className="flex min-h-svh w-full bg-[#f6f7fb] text-foreground dark:bg-[#090a0c]">
      <aside className="hidden w-[240px] shrink-0 flex-col bg-white dark:bg-[#121418] md:flex">
        <div className="flex items-center gap-2 px-4 pt-4 pb-3">
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-[6px] text-sm font-medium text-white"
            style={{ background: "#fe158a" }}
          >
            {mark}
          </span>
          <span className="truncate text-[15px] font-medium">{teamName}</span>
        </div>
        <p className="px-4 pb-2 text-xs font-semibold text-muted-foreground">{t("頁面")}</p>
        <nav aria-label={t("頁面")} className="flex flex-1 flex-col gap-0.5 px-2 pb-2">
          {links.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex h-9 items-center gap-2 rounded-[4px] px-2 text-sm transition-colors duration-150 ${
                  active ? "bg-[#cce5ff] text-[#0073ea] dark:bg-[#0073ea]/20" : "text-foreground hover:bg-[#f6f7fb] dark:hover:bg-[#1c1f24]"
                }`}
              >
                <item.icon className="size-4 shrink-0" strokeWidth={1.75} />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto flex flex-col gap-0.5 border-t border-border px-2 py-2">
          <Link
            href="/account"
            className={`flex h-9 items-center gap-2 rounded-[4px] px-2 text-sm ${
              pathname === "/account" ? "bg-[#cce5ff] text-[#0073ea]" : "hover:bg-[#f6f7fb] dark:hover:bg-[#1c1f24]"
            }`}
          >
            <span
              className="flex size-6 items-center justify-center rounded-full text-[11px] font-medium text-white"
              style={{ background: personColor(user.display_name) }}
            >
              {initials(user.display_name)}
            </span>
            <span className="truncate">{user.display_name}</span>
          </Link>
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={logout}
            className="h-9 w-full justify-start gap-2 px-2 text-[#676879]"
          >
            <LogOutIcon className="size-4" />
            {t("登出")}
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col bg-white dark:bg-[#121418]">
        <header className="flex h-12 shrink-0 items-center gap-2 bg-[#f6f7fb] px-3 dark:bg-[#090a0c]">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-foreground md:hidden"
            onClick={() => setOpen(true)}
            aria-label={t("頁面")}
          >
            <MenuIcon className="size-5" />
          </Button>
          <span className="truncate text-sm font-medium md:hidden">{teamName}</span>
          <Button
            type="button"
            variant="ghost"
            onClick={() => window.dispatchEvent(new Event("rov-palette"))}
            className="mx-auto hidden h-8 w-full max-w-[400px] justify-center gap-2 rounded-full bg-[rgba(103,104,121,0.1)] px-3 text-sm font-normal text-[#676879] hover:bg-[rgba(103,104,121,0.16)] md:flex"
          >
            <SearchIcon className="size-4" />
            {t("搜尋")}
          </Button>
          <div className="ml-auto flex items-center gap-1 md:ml-0">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="rounded-full bg-[rgba(103,104,121,0.1)] md:hidden"
              onClick={() => window.dispatchEvent(new Event("rov-palette"))}
              aria-label={t("搜尋")}
            >
              <SearchIcon className="size-4" />
            </Button>
            <ThemeToggle />
            <Button
              type="button"
              variant="ghost"
              onClick={toggle}
              className="text-[#676879]"
            >
              {lang === "zh" ? "EN" : "中"}
            </Button>
            <Link
              href="/account"
              className="flex size-8 items-center justify-center rounded-full text-xs font-medium text-white"
              style={{ background: personColor(user.display_name) }}
              title={user.display_name}
            >
              {initials(user.display_name)}
            </Link>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-auto bg-white px-4 py-4 md:px-6 dark:bg-[#121418]">{children}</div>
      </div>

      <SheetContent side="left" className="w-[280px] gap-1 bg-white p-3 md:hidden dark:bg-[#121418]">
        <SheetHeader className="p-0 pr-8">
          <SheetTitle className="truncate">{teamName}</SheetTitle>
        </SheetHeader>
        {links.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={`flex h-10 items-center gap-2 rounded-[4px] px-2 text-sm ${
              pathname === item.href ? "bg-[#cce5ff] text-[#0073ea]" : ""
            }`}
          >
            <item.icon className="size-4" />
            {item.label}
          </Link>
        ))}
        <Link href="/account" onClick={() => setOpen(false)} className="mt-2 flex h-10 items-center gap-2 px-2 text-sm">
          <UserIcon className="size-4" />
          {user.display_name}
        </Link>
        <Button type="button" variant="ghost" disabled={busy} onClick={logout} className="h-10 justify-start gap-2 px-2">
          <LogOutIcon className="size-4" />
          {t("登出")}
        </Button>
      </SheetContent>
    </div>
    </Sheet>
  );
}
