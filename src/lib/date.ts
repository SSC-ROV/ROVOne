import { tt } from "./i18n-core";

export function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayStr(): string {
  return localDateStr(new Date());
}

export function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDaysStr(base: string, n: number): string {
  const [y, m, d] = base.split("-").map(Number);
  return localDateStr(new Date(y, m - 1, d + n));
}

/** a-b 天數（b 較晚為正） */
export function daysBetween(a: string, b: string): number {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86400000);
}

export function fmtMD(s: string): string {
  return s.slice(5).replace("-", "/");
}

export function weekdayCn(s: string): string {
  const d = parseDate(s).getDay();
  const zh = "週" + "日一二三四五六"[d];
  const en = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d];
  return tt(zh, en);
}
