import { sql } from "./pg";
import { getOrCreateIcalToken, getSettings, getSubteams } from "./db";

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

function nextDateStamp(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + 1));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}${mm}${dd}`;
}

function addHour(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const next = (h + 1) % 24;
  return `${String(next).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * 產生 iCal（.ics）訂閱內容：活動含時間，任務截止為整天事件。
 * With `subteam`, only that subteam's events and tasks plus team-wide ones ("general" / no subteam).
 */
export async function buildIcs(subteam?: string | null): Promise<{ body: string; token: string }> {
  const token = await getOrCreateIcalToken();
  const settings = await getSettings();
  const team = subteam ? (await getSubteams()).find((item) => item.key === subteam) : undefined;
  const name = team ? `${settings.team_name} · ${team.en || team.zh}` : settings.team_name;
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ROV Team Hub//CN",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${esc(name)}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];

  const events = team
    ? await sql`
        SELECT id, title, type, date, time, location, notes
        FROM events WHERE subteam IS NULL OR subteam IN (${team.key}, 'general') ORDER BY date`
    : await sql`
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

  const tasks = team
    ? await sql`
        SELECT id, title, due_date, status
        FROM tasks
        WHERE due_date IS NOT NULL AND subteam IN (${team.key}, 'general')
        ORDER BY due_date, id`
    : await sql`
        SELECT id, title, due_date, status
        FROM tasks
        WHERE due_date IS NOT NULL
        ORDER BY due_date, id`;
  for (const task of tasks) {
    const due = String(task.due_date);
    const prefix = task.status === "done" ? "✓ " : "";
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:task-${task.id}@rov-team-hub`);
    lines.push(`DTSTART;VALUE=DATE:${stampDate(due)}`);
    lines.push(`DTEND;VALUE=DATE:${nextDateStamp(due)}`);
    lines.push(`SUMMARY:${esc(`${prefix}${task.title}`)}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return { body: lines.join("\r\n"), token };
}
