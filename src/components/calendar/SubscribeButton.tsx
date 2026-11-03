"use client";

import { useState } from "react";
import { CalendarSyncIcon, CheckIcon, CopyIcon, ExternalLinkIcon } from "lucide-react";
import { api } from "@/lib/api-client";
import { tt } from "@/lib/i18n-core";
import { groupColor } from "@/lib/ui";
import { useSubteams } from "@/lib/subteams";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * "Subscribe" button for the Calendar page. Step 1: pick a feed (the full team calendar or one subteam).
 * Step 2: add it to Apple / Outlook (webcal link), Google Calendar, or copy the link.
 * Subscribed calendars refresh on their own, so new events and due dates show up automatically.
 */
export function SubscribeButton() {
  const { subteams } = useSubteams();
  const [token, setToken] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [pick, setPick] = useState<string>("all");
  const [copied, setCopied] = useState(false);

  function onOpenChange(open: boolean) {
    if (!open) {
      setCopied(false);
      return;
    }
    if (token) return;
    api<{ token: string }>("/api/ical/links")
      .then((res) => setToken(res.token))
      .catch(() => setFailed(true));
  }

  const feeds = [
    { key: "all", label: tt("完整 ROV 行事曆", "Full ROV calendar"), hint: tt("所有組別的活動與任務", "Every subteam's events and tasks"), color: "" },
    ...subteams
      .map((item, i) => ({ ...item, color: groupColor(i) }))
      .filter((item) => item.key !== "general")
      .map((item) => ({
        key: item.key,
        label: item.label,
        hint: tt("該組活動與任務，含全隊活動", "Its events and tasks, plus team-wide ones"),
        color: item.color,
      })),
  ];

  const httpUrl = token
    ? `${location.origin}/api/ical?token=${token}${pick === "all" ? "" : `&subteam=${encodeURIComponent(pick)}`}`
    : "";
  const webcalUrl = httpUrl.replace(/^https?:\/\//, "webcal://");
  const googleUrl = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcalUrl)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(httpUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt(tt("複製這個連結", "Copy this link"), httpUrl);
    }
  }

  return (
    <Popover onOpenChange={onOpenChange}>
      <PopoverTrigger render={<Button variant="outline" size="sm" />}>
        <CalendarSyncIcon /> {tt("訂閱", "Subscribe")}
      </PopoverTrigger>
      <PopoverContent className="w-80 max-w-[calc(100vw-2rem)] gap-0 overflow-hidden p-0" align="end" sideOffset={6}>
        <div className="border-b border-border px-3 py-2.5">
          <p className="text-sm font-semibold">{tt("訂閱行事曆", "Subscribe to a calendar")}</p>
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
            {tt("加到手機或電腦的日曆 App，活動和截止日會自動更新。", "Add it to your phone or computer's calendar app. Events and due dates stay up to date automatically.")}
          </p>
        </div>
        <div role="radiogroup" aria-label={tt("選擇行事曆", "Choose a calendar")} className="flex max-h-64 flex-col gap-0.5 overflow-y-auto p-1">
          {feeds.map((feed, index) => {
            const checked = pick === feed.key;
            return (
              <div key={feed.key} className="contents">
              {index === 1 && (
                <div className="px-2 pt-1.5 pb-0.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{tt("依組別", "By subteam")}</div>
              )}
              <button
                type="button"
                role="radio"
                aria-checked={checked}
                onClick={() => setPick(feed.key)}
                className={`flex w-full shrink-0 items-start gap-2.5 rounded-[6px] px-2 py-1.5 text-left transition-colors hover:bg-muted ${checked ? "bg-muted" : ""}`}
              >
                <span
                  className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border ${checked ? "border-[var(--c-blue)]" : "border-input"}`}
                  aria-hidden
                >
                  {checked && <span className="size-2 rounded-full bg-[var(--c-blue)]" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-sm font-medium leading-snug">
                    {feed.color ? (
                      <span className="size-2.5 shrink-0 rounded-full" style={{ background: feed.color }} aria-hidden />
                    ) : (
                      <span className="flex shrink-0 -space-x-1" aria-hidden>
                        {[0, 1, 2].map((i) => (
                          <span key={i} className="size-2.5 rounded-full ring-1 ring-popover" style={{ background: groupColor(i) }} />
                        ))}
                      </span>
                    )}
                    <span className="min-w-0 break-words">{feed.label}</span>
                  </span>
                  <span className="block text-xs leading-snug text-muted-foreground">{feed.hint}</span>
                </span>
              </button>
              </div>
            );
          })}
        </div>
        <div className="flex flex-col gap-1.5 border-t border-border p-2">
          {failed ? (
            <p className="px-1 py-2 text-center text-xs text-destructive">{tt("無法取得訂閱連結", "Couldn't load the subscription link")}</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-1.5">
                <Button size="sm" disabled={!token} render={token ? <a href={webcalUrl} /> : undefined} nativeButton={!token}>
                  {tt("Apple / Outlook", "Apple / Outlook")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!token}
                  render={token ? <a href={googleUrl} target="_blank" rel="noreferrer" /> : undefined}
                  nativeButton={!token}
                >
                  Google <ExternalLinkIcon />
                </Button>
              </div>
              <Button size="sm" variant="ghost" disabled={!token} onClick={copy} className="text-muted-foreground">
                {copied ? <CheckIcon /> : <CopyIcon />} {copied ? tt("已複製連結", "Link copied") : tt("複製連結（其他 App）", "Copy link (other apps)")}
              </Button>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
