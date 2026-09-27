"use client";
import { isStaff } from "@/lib/roles";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import type { Me } from "@/lib/types";

/* ── 線性圖標（Instagram iPad 版風格的側欄用） ── */

type IconProps = { className?: string };
const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
};

const IconHome = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V21h14V9.5" />
  </svg>
);
const IconCalendar = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <rect x="3" y="4" width="18" height="17" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </svg>
);
const IconCycles = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M21 12a9 9 0 1 1-2.64-6.36L21 8" />
    <path d="M21 3v5h-5" />
  </svg>
);
const IconCart = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <circle cx="9" cy="20" r="1.5" />
    <circle cx="18" cy="20" r="1.5" />
    <path d="M2 3h3l2.4 11.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 2-1.6L21 7H6" />
  </svg>
);
const IconWrench = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </svg>
);
const IconWaves = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
    <path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
    <path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
  </svg>
);
const IconShield = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);
const IconUser = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
  </svg>
);
const IconLogout = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="m16 17 5-5-5-5" />
    <path d="M21 12H9" />
  </svg>
);

/* 側欄按鈕 */
function RailButton({
  href,
  label,
  active,
  children,
}: {
  href: string;
  label: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      className={`flex h-11 w-11 items-center justify-center rounded-xl transition ${
        active
          ? "bg-surface-2 text-[#2383a5]"
          : "text-ink-subtle hover:bg-surface-2 hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}

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
    { href: "/", label: t("首頁"), icon: <IconHome className="h-[22px] w-[22px]" /> },
    { href: "/calendar", label: t("日曆"), icon: <IconCalendar className="h-[22px] w-[22px]" /> },
    { href: "/cycles", label: t("開發週期"), icon: <IconCycles className="h-[22px] w-[22px]" /> },
    { href: "/parts", label: t("零件採買"), icon: <IconCart className="h-[22px] w-[22px]" /> },
    { href: "/equipment", label: t("租借設備"), icon: <IconWrench className="h-[22px] w-[22px]" /> },
    { href: "/divelogs", label: t("水測日誌"), icon: <IconWaves className="h-[22px] w-[22px]" /> },
    ...(isStaff(user.role)
      ? [{ href: "/admin", label: t("管理"), icon: <IconShield className="h-[22px] w-[22px]" /> }]
      : []),
  ];

  return (
    <>
      {/* ── iPad／大屏觸控：Instagram 式左側圖標欄 ── */}
      <aside className="rail" aria-label={t("主導航")}>
        <div className="flex flex-col items-center gap-1">
          {links.map((l) => (
            <RailButton key={l.href} href={l.href} label={l.label} active={pathname === l.href}>
              {l.icon}
            </RailButton>
          ))}
        </div>
        <div className="mt-auto flex flex-col items-center gap-1">
          <RailButton href="/account" label={t("帳號")} active={pathname === "/account"}>
            <IconUser className="h-[22px] w-[22px]" />
          </RailButton>
          <button
            onClick={toggle}
            title={lang === "zh" ? "Switch to English" : t("切換至中文")}
            aria-label={lang === "zh" ? "Switch to English" : t("切換至中文")}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-ink-subtle transition hover:bg-surface-2 hover:text-ink"
          >
            <span className="w-[22px] text-center text-[11px] font-bold">
              {lang === "zh" ? "EN" : "中"}
            </span>
          </button>
          <button
            onClick={logout}
            disabled={busy}
            title={t("登出")}
            aria-label={t("登出")}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-ink-subtle transition hover:bg-surface-2 hover:text-[#eb5757]"
          >
            <IconLogout className="h-[22px] w-[22px]" />
          </button>
        </div>
      </aside>

      {/* ── 手機／桌面：原本的頂欄 ── */}
      <header className="topbar sticky top-0 z-40 border-b border-hairline bg-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
          <Link href="/" className="shrink-0 font-semibold tracking-tight text-ink">
            {teamName}
          </Link>
          <nav className="flex flex-1 gap-1 overflow-x-auto">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-sm transition ${
                  pathname === l.href
                    ? "bg-surface-2 text-ink"
                    : "text-ink-subtle hover:text-ink"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="flex shrink-0 items-center gap-3 text-sm">
            <span className="hidden text-ink-subtle sm:inline">
              {user.display_name}
            </span>
            <button
              onClick={toggle}
              className="rounded-lg border border-hairline-strong px-2 py-1 text-xs text-ink-muted transition hover:border-hairline-strong hover:text-ink"
              title={lang === "zh" ? "Switch to English" : "切換至中文"}
            >
              {lang === "zh" ? "EN" : "中"}
            </button>
            <button
              onClick={logout}
              disabled={busy}
              className="text-ink-subtle transition hover:text-[#eb5757]"
            >
              {t("登出")}
            </button>
          </div>
        </div>
      </header>
    </>
  );
}
