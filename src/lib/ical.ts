import db, { getOrCreateIcalToken } from "./db";

function esc(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function stampDate(date: string): string {
  return date.replace(/-/g, "");
}

function stampDateTime(date: string, time: string): string {
  return `${stampDate(date)}T${time.replace(":", "")}00`;
}

/** 產生 iCal（.ics）訂閱內容：活動含時間，任務截止為整天事件 */
export function buildIcs(): { body: string; token: string } {
  const token = getOrCreateIcalToken();
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ROV Team Hub//CN",
    "CALSCALE:GREGORIAN",
    "X-WR-CALNAME:ROV 隊任務日曆",
  ];

  const events = db
    .prepare("SELECT * FROM events ORDER BY date")
    .all() as unknown as {
    id: number;
    title: string;
    type: string;
    date: string;
    time: string | null;
    location: string;
    notes: string;
  }[];
  for (const e of events) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:event-${e.id}@rov-team-hub`);
    if (e.time) {
      lines.push(`DTSTART:${stampDateTime(e.date, e.time)}`);
      lines.push(`DTEND:${stampDateTime(e.date, addHour(e.time))}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${stampDate(e.date)}`);
    }
    lines.push(`SUMMARY:${esc(`[${e.type}] ${e.title}`)}`);
    if (e.location) lines.push(`LOCATION:${esc(e.location)}`);
    if (e.notes) lines.push(`DESCRIPTION:${esc(e.notes)}`);
    lines.push("END:VEVENT");
  }

  const tasks = db
    .prepare("SELECT id, title, due_date FROM tasks WHERE due_date IS NOT NULL")
    .all() as unknown as { id: number; title: string; due_date: string }[];
  for (const t of tasks) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:task-${t.id}@rov-team-hub`);
    lines.push(`DTSTART;VALUE=DATE:${stampDate(t.due_date)}`);
    lines.push(`SUMMARY:${esc(`⚑ 截止：${t.title}`)}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return { body: lines.join("\r\n"), token };
}

function addHour(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const next = (h + 1) % 24;
  return `${String(next).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
