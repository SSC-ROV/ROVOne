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
  PackageSearchIcon,
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
import { Avatar } from "@/components/board/PersonCell";

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
    { href: "/", label: t("總覽"), icon: HomeIcon },
    { href: "/tasks", label: t("任務"), icon: LayoutListIcon },
    { href: "/calendar", label: t("行事曆"), icon: CalendarIcon },
    { href: "/cycles", label: t("專案"), icon: RefreshCwIcon },
    { href: "/parts", label: t("採購申請"), icon: ShoppingCartIcon },
    { href: "/inventory", label: t("庫存"), icon: PackageSearchIcon },
    { href: "/equipment", label: t("設備借用"), icon: WrenchIcon },
    { href: "/divelogs", label: t("水測紀錄"), icon: WavesIcon },
    ...(isStaff(user.role) ? [{ href: "/admin", label: t("團隊設定"), icon: ShieldIcon }] : []),
  ];

  const mark = teamName.trim().slice(0, 1).toUpperCase() || "R";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
    <div className="fixed inset-0 flex overflow-hidden overscroll-none pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] bg-background text-foreground">
      <aside className="hidden w-[240px] shrink-0 flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar md:flex">
        <div className="flex items-center gap-2 px-4 pt-4 pb-3">
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-[6px] text-sm font-medium text-white"
            style={{ background: "var(--primary)" }}
          >
            {mark}
          </span>
          <span className="truncate text-[15px] font-medium">{teamName}</span>
        </div>
        <p className="px-4 pb-2 text-xs font-semibold text-muted-foreground">{t("頁面")}</p>
        <nav aria-label={t("頁面")} className="flex flex-1 flex-col gap-0.5 px-2 pb-2">
          {links.map((item) => {
            const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href + "/"));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex h-9 items-center gap-2 rounded-[4px] px-2 text-sm transition-colors duration-150 ${
                  active ? "bg-primary-soft font-medium text-primary-soft-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
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
              pathname === "/account" ? "bg-primary-soft font-medium text-primary-soft-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Avatar name={user.display_name} />
            <span className="truncate">{user.display_name}</span>
          </Link>
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={logout}
            className="h-9 w-full justify-start gap-2 px-2 text-muted-foreground"
          >
            <LogOutIcon className="size-4" />
            {t("登出")}
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col bg-background">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-background px-3">
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
            className="mx-auto hidden h-8 w-full max-w-[400px] justify-center gap-2 rounded-full border border-border bg-card px-3 text-sm font-normal text-muted-foreground hover:bg-muted md:flex"
          >
            <SearchIcon className="size-4" />
            {t("搜尋")}
          </Button>
          <div className="ml-auto flex items-center gap-1 md:ml-0">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="rounded-full bg-muted md:hidden"
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
              className="text-muted-foreground"
            >
              {lang === "zh" ? "EN" : "中"}
            </Button>
            <Link href="/account" className="flex rounded-full" title={user.display_name}>
              <Avatar name={user.display_name} size={30} />
            </Link>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-auto overscroll-contain bg-background px-4 py-5 md:px-8">{children}</div>
      </div>

      <SheetContent side="left" className="w-[280px] gap-1 bg-sidebar p-3 md:hidden">
        <SheetHeader className="p-0 pr-8">
          <SheetTitle className="truncate">{teamName}</SheetTitle>
        </SheetHeader>
        {links.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={`flex h-10 items-center gap-2 rounded-[4px] px-2 text-sm ${
              pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href + "/")) ? "bg-primary-soft font-medium text-primary-soft-foreground" : "text-muted-foreground"
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
