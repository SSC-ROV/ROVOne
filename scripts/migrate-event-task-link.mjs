// Link calendar events to tasks (an event can point to one task; a task can have many events).
// Run: node --env-file=.env.local scripts/migrate-event-task-link.mjs
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1, ssl: "require" });

await sql.unsafe(`
  ALTER TABLE events ADD COLUMN IF NOT EXISTS task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL;
  CREATE INDEX IF NOT EXISTS idx_events_task_id ON events(task_id);
`);

await sql.end();
console.log("done");
