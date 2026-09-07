import { sql } from "./pg";
import { getOrCreateIcalToken } from "./db";

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

function addHour(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const next = (h + 1) % 24;
  return `${String(next).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** 產生 iCal（.ics）訂閱內容：活動含時間，任務截止為整天事件 */
export async function buildIcs(): Promise<{ body: string; token: string }> {
  const token = await getOrCreateIcalToken();
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ROV Team Hub//CN",
    "CALSCALE:GREGORIAN",
    "X-WR-CALNAME:ROV 隊任務日曆",
  ];

  const events = await sql`
    SELECT id, title, type, date, time, location, notes
    FROM events ORDER BY date`;
  for (const e of events) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:event-${e.id}@rov-team-hub`);
    if (e.time) {
      lines.push(`DTSTART:${stampDateTime(String(e.date), String(e.time))}`);
      lines.push(`DTEND:${stampDateTime(String(e.date), addHour(String(e.time)))}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${stampDate(String(e.date))}`);
    }
    lines.push(`SUMMARY:${esc(`[${e.type}] ${e.title}`)}`);
    if (e.location) lines.push(`LOCATION:${esc(String(e.location))}`);
    if (e.notes) lines.push(`DESCRIPTION:${esc(String(e.notes))}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return { body: lines.join("\r\n"), token };
}
