import { addDaysStr } from "@/lib/date";
import type { TeamEvent } from "@/lib/types";

const compactDate = (date: string) => date.replaceAll("-", "");

/** One hour later, "HH:MM" → "HH:MM" (capped at 23:59 so it stays on the same day). */
function plusHour(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h >= 23 ? "23:59" : `${String(h + 1).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Link that opens Google Calendar's "add event" page prefilled with this event.
 * Timed events last an hour in the viewer's own time zone; untimed ones are all-day.
 */
export function googleCalendarUrl(event: Pick<TeamEvent, "title" | "date" | "time" | "location" | "notes">) {
  const day = compactDate(event.date);
  const dates = event.time
    ? `${day}T${event.time.replace(":", "")}00/${day}T${plusHour(event.time).replace(":", "")}00`
    : `${day}/${compactDate(addDaysStr(event.date, 1))}`;
  const params = new URLSearchParams({ action: "TEMPLATE", text: event.title, dates });
  if (event.location) params.set("location", event.location);
  if (event.notes) params.set("details", event.notes);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
