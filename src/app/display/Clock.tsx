"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

/** 看板大時鐘：Orbitron 數碼字體＋青色輝光＋冒號呼吸；香港時區，每秒跳動 */
export default function Clock() {
  const { lang } = useI18n();
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const h = now
    ? now.toLocaleTimeString("en-GB", { hour: "2-digit", timeZone: "Asia/Hong_Kong" })
    : "--";
  const m = now
    ? now.toLocaleTimeString("en-GB", { minute: "2-digit", timeZone: "Asia/Hong_Kong" })
    : "--";
  const date = now
    ? lang === "en"
      ? now.toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          weekday: "short",
          timeZone: "Asia/Hong_Kong",
        })
      : now.toLocaleDateString("zh-TW", {
          month: "long",
          day: "numeric",
          weekday: "short",
          timeZone: "Asia/Hong_Kong",
        })
    : "";

  return (
    <div className="text-right leading-none">
      <div className="tech glow text-8xl font-bold text-[#7defff] tabular-nums">
        {h}
        <span className="clock-colon">:</span>
        {m}
      </div>
      <div className="mt-2 text-2xl font-semibold text-[#9fdcec]">{date}</div>
    </div>
  );
}
