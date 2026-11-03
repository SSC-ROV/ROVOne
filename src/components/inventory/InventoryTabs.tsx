"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PackagePlusIcon, SearchIcon } from "lucide-react";
import { tt } from "@/lib/i18n-core";
import { useI18n } from "@/lib/i18n";

/** Switches between the two inventory pages: Find and Add & place. */
export default function InventoryTabs() {
  useI18n();
  const pathname = usePathname();
  const tabs = [
    { href: "/inventory", label: tt("找東西", "Find"), icon: SearchIcon },
    { href: "/inventory/manage", label: tt("新增 / 放置", "Add & place"), icon: PackagePlusIcon },
  ];
  return (
    <nav aria-label={tt("庫存頁面", "Inventory pages")} className="flex gap-1 overflow-x-auto border-b border-border">
      {tabs.map((tab) => {
        const on = pathname === tab.href;
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={on ? "page" : undefined}
            className={`relative -mb-px inline-flex h-10 shrink-0 items-center gap-2 border-b-2 px-3 text-sm transition-colors ${
              on ? "border-[var(--underline)] font-semibold text-foreground" : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
            }`}
          >
            <Icon className="size-4 text-muted-foreground" /> {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
