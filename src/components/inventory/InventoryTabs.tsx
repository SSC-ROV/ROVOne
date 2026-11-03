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
    <nav aria-label={tt("庫存頁面", "Inventory pages")} className="inline-flex rounded-full border border-border bg-card p-1">
      {tabs.map((tab) => {
        const on = pathname === tab.href;
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={on ? "page" : undefined}
            className={`inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors ${
              on ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="size-4" /> {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
