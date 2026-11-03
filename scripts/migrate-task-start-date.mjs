// Tasks get an optional start date (shown in the Tasks table and the project timeline).
// Run: node --env-file=.env.local scripts/migrate-task-start-date.mjs
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1, ssl: "require" });

await sql.unsafe(`
  ALTER TABLE tasks ADD COLUMN IF NOT EXISTS start_date TEXT;
`);

await sql.end();
console.log("done");
