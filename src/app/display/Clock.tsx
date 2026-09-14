"use client";

import { useEffect, useState } from "react";

/** 大時鐘：香港時區，每秒跳動；掛載前顯示 --:-- 避免水合不匹配 */
export default function Clock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const time = now
    ? now.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Hong_Kong",
      })
    : "--:--";
  const date = now
    ? now.toLocaleDateString("zh-TW", {
        month: "long",
        day: "numeric",
        weekday: "short",
        timeZone: "Asia/Hong_Kong",
      })
    : "";

  return (
    <div className="text-right leading-none">
      <div className="font-mono text-6xl font-black tracking-tight text-white tabular-nums">
        {time}
      </div>
      <div className="mt-1 text-lg text-slate-400">{date}</div>
    </div>
  );
}
