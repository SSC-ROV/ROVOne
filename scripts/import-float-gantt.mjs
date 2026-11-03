// Import the Float team Gantt chart (scripts/data/float-gantt.csv) into the task board.
// Dry run (prints what would be created):  node --env-file=.env.local scripts/import-float-gantt.mjs
// Write to the database:                   node --env-file=.env.local scripts/import-float-gantt.mjs --apply
// Safe to re-run: tasks that already exist in the project (same title) are skipped.
import { readFileSync } from "node:fs";
import postgres from "postgres";

const APPLY = process.argv.includes("--apply");
const PROJECT = { title: "Float v1", start: "2026-10-26", end: "2027-02-20" };
const CSV = new URL("./data/float-gantt.csv", import.meta.url);

function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const MONTHS = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
// "Mon 26 Oct" -> "2026-10-26"; the chart runs Oct 2026 to Apr 2027.
function toDate(s) {
  const m = /(\d{1,2}) ([A-Z][a-z]{2})/.exec(s ?? "");
  if (!m) return null;
  const month = MONTHS[m[2]];
  const year = month >= 9 ? 2026 : 2027;
  return `${year}-${String(month).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

const STATUS = { "Not started": "todo", "In progress": "doing", Done: "done" };
const DEFAULT_SUBTEAMS = { "Whole team": "general", Mechanical: "mech", Electrical: "elec", Software: "sw" };

const rows = parseCsv(readFileSync(CSV, "utf8"));
const header = rows.findIndex((r) => r[0] === "Department" && r[2] === "Task");
const notesCol = rows[header].indexOf("Notes");
const items = rows
  .slice(header + 1)
  .filter((r) => r[0] && r[2])
  .map((r) => {
    const [dept, component, task, lead, members, status, start, due] = r;
    const notes = (r[notesCol] ?? "").trim();
    const desc = [
      `Component: ${component}`,
      toDate(start) && `Start: ${toDate(start)}`,
      members?.trim() && `Members: ${members.trim()}`,
      notes && `Notes: ${notes}`,
    ].filter(Boolean).join("\n");
    return {
      dept,
      title: component && component !== task ? `${component}: ${task}` : task,
      description: desc,
      status: STATUS[status] ?? "todo",
      lead: lead.trim(),
      due: toDate(due),
    };
  });

console.log(`Parsed ${items.length} tasks from the CSV.`);

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1, ssl: "require" });
try {
  // Subteam keys: match the configured subteams by English label, fall back to defaults.
  const [setting] = await sql`SELECT value FROM settings WHERE key = 'subteams'`;
  const configured = setting ? JSON.parse(setting.value) : [];
  const subteamKey = (dept) => {
    const want = dept === "Electrical" ? ["Electrical", "Electronics"] : dept === "Whole team" ? ["Whole team", "Team"] : [dept];
    return configured.find((s) => want.includes(s.en))?.key ?? DEFAULT_SUBTEAMS[dept] ?? "general";
  };

  const users = await sql`SELECT id, username, display_name FROM users`;
  const findUser = (name) => {
    const n = name.toLowerCase();
    return users.find((u) => u.display_name?.toLowerCase() === n || u.username?.toLowerCase() === n)
      ?? users.find((u) => u.display_name?.toLowerCase().split(/\s+/).includes(n));
  };
  const leads = [...new Set(items.map((i) => i.lead).filter(Boolean))];
  for (const lead of leads) {
    const u = findUser(lead);
    console.log(u ? `Lead "${lead}" -> user #${u.id} (${u.display_name})` : `Lead "${lead}" -> no matching user, tasks left unassigned`);
  }

  let [project] = await sql`SELECT id FROM cycles WHERE title = ${PROJECT.title} ORDER BY id LIMIT 1`;
  if (!project && APPLY) {
    [project] = await sql`
      INSERT INTO cycles (title, description, start_date, end_date, status)
      VALUES (${PROJECT.title}, 'Imported from the Float team Gantt chart.', ${PROJECT.start}, ${PROJECT.end}, 'active')
      RETURNING id`;
    console.log(`Created project #${project.id} "${PROJECT.title}".`);
  } else {
    console.log(project ? `Using existing project #${project.id}.` : `Would create project "${PROJECT.title}".`);
  }

  const existing = new Set(project ? (await sql`SELECT title FROM tasks WHERE cycle_id = ${project.id}`).map((t) => t.title) : []);
  let created = 0, skipped = 0, order = 0;
  for (const it of items) {
    order += 1;
    if (existing.has(it.title)) { skipped++; continue; }
    const assignee = it.lead ? findUser(it.lead)?.id ?? null : null;
    const subteam = subteamKey(it.dept);
    if (!APPLY) {
      console.log(`  + [${subteam}] ${it.title} (${it.status}, due ${it.due ?? "—"})`);
      created++;
      continue;
    }
    await sql`
      INSERT INTO tasks (title, description, status, priority, subteam, due_date, assignee_id, cycle_id, sort_order, completed_at)
      VALUES (${it.title}, ${it.description}, ${it.status}, 'medium', ${subteam}, ${it.due}, ${assignee}, ${project.id}, ${order},
              ${it.status === "done" ? (it.due ?? new Date().toISOString().slice(0, 10)) : null})`;
    created++;
  }
  console.log(`${APPLY ? "Created" : "Would create"} ${created} tasks, skipped ${skipped} already present.`);
  if (!APPLY) console.log("Dry run only. Re-run with --apply to write.");
} finally {
  await sql.end();
}
