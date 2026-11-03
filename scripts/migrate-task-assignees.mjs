// Tasks can have several assignees. `assignee_id` stays as the first one so older code keeps working.
// Run: node --env-file=.env.local scripts/migrate-task-assignees.mjs
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1, ssl: "require" });

await sql.unsafe(`
  ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assignee_ids INTEGER[] NOT NULL DEFAULT '{}';
  UPDATE tasks SET assignee_ids = ARRAY[assignee_id]
    WHERE assignee_id IS NOT NULL AND cardinality(assignee_ids) = 0;
  CREATE INDEX IF NOT EXISTS idx_tasks_assignee_ids ON tasks USING GIN (assignee_ids);
`);

await sql.end();
console.log("done");
