"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** 定時向伺服器重新取得看板資料（不整頁刷新，畫面不閃）；回到前景也立即刷新 */
export default function AutoRefresh({ seconds = 60 }: { seconds?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), seconds * 1000);
    const onVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router, seconds]);

  return null;
}

/** 全屏按鈕（Raspberry Pi 上也可直接用 Chromium --kiosk 參數） */
export function FullscreenButton() {
  return (
    <button
      onClick={() => {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen();
      }}
      title="全屏"
      aria-label="全屏"
      className="h-10 w-10 rounded-lg border border-hairline-strong text-lg text-ink-subtle transition hover:border-hairline-strong hover:text-ink"
    >
      ⛶
    </button>
  );
}
