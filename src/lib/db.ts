import Database from "better-sqlite3";
import { randomBytes } from "crypto";
import fs from "fs";
import path from "path";
import { hashPassword } from "./password";
import { localDateStr } from "./date";
import type { ChecklistItem, Settings, Task, TeamEvent } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, "rov.db"));
db.pragma("journal_mode = WAL");
db.pragma("busy_timeout = 5000");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  subteam TEXT NOT NULL DEFAULT 'general',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS mission_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  points INTEGER,
  sort_order REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'todo',
  priority TEXT NOT NULL DEFAULT 'medium',
  subteam TEXT NOT NULL DEFAULT 'general',
  due_date TEXT,
  assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  mission_id INTEGER REFERENCES mission_tasks(id) ON DELETE SET NULL,
  sort_order REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);
CREATE TABLE IF NOT EXISTS checklist_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  sort_order REAL NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'other',
  date TEXT NOT NULL,
  time TEXT,
  location TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS parts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  spec TEXT NOT NULL DEFAULT '',
  link TEXT NOT NULL DEFAULT '',
  qty INTEGER NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT '個',
  est_price REAL NOT NULL DEFAULT 0,
  actual_price REAL,
  purpose TEXT NOT NULL DEFAULT '',
  subteam TEXT NOT NULL DEFAULT 'general',
  status TEXT NOT NULL DEFAULT 'pending',
  requested_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  decided_at TEXT,
  decided_note TEXT,
  order_vendor TEXT NOT NULL DEFAULT '',
  order_ref TEXT NOT NULL DEFAULT '',
  ordered_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  arrived_at TEXT,
  approve_token TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS equipment (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '其他',
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'available',
  borrower_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  borrowed_at TEXT,
  due_return TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS dive_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  title TEXT NOT NULL,
  participants TEXT NOT NULL DEFAULT '',
  tested TEXT NOT NULL DEFAULT '',
  issues TEXT NOT NULL DEFAULT '',
  fixes TEXT NOT NULL DEFAULT '',
  next_steps TEXT NOT NULL DEFAULT '',
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`);

// 舊版資料庫遷移：tasks 補 mission_id 欄位
try {
  db.exec("ALTER TABLE tasks ADD COLUMN mission_id INTEGER REFERENCES mission_tasks(id) ON DELETE SET NULL");
} catch {
  /* 欄位已存在 */
}

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return localDateStr(d);
}

function nextMonday(): string {
  const d = new Date();
  d.setDate(d.getDate() + (((1 - d.getDay()) % 7) + 7) % 7 || 7);
  if (d <= new Date()) d.setDate(d.getDate() + 7);
  return localDateStr(d);
}

// ---- 首次啟動播種：隊長帳號、示範任務與活動 ----
// 用 IMMEDIATE 交易避免多個 Next.js worker 同時判斷「資料庫是空的」而重複播種
const seed = db.transaction(() => {
  const userCount = (
    db.prepare("SELECT COUNT(*) AS c FROM users").get() as { c: number }
  ).c;
  if (userCount > 0) return;

  const insUser = db.prepare(
    "INSERT INTO users (username, display_name, password_hash, role, subteam) VALUES (?, ?, ?, ?, ?)"
  );
  const leaderId = insUser.run(
    "leader",
    "隊長",
    hashPassword("rov2026"),
    "leader",
    "general"
  ).lastInsertRowid as number;
  const memberId = insUser.run(
    "member",
    "隊員（示範）",
    hashPassword("rov2026"),
    "member",
    "sw"
  ).lastInsertRowid as number;

  const compDate = daysFromNow(250);
  setSetting("team_name", "深海 ROV 隊");
  setSetting("competition_date", compDate);
  setSetting("ical_token", randomBytes(16).toString("hex"));

  const insTask = db.prepare(
    `INSERT INTO tasks (title, description, status, priority, subteam, due_date, assignee_id, created_by, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insItem = db.prepare(
    "INSERT INTO checklist_items (task_id, text, done, sort_order) VALUES (?, ?, ?, ?)"
  );

  const t1 = insTask.run(
    "完成推進器選型與下單",
    "比較 T200 與其他方案，確認推力需求與預算後下單。",
    "doing",
    "high",
    "elec",
    daysFromNow(3),
    memberId,
    leaderId,
    null
  ).lastInsertRowid as number;
  insItem.run(t1, "確認推力需求計算", 1, 0);
  insItem.run(t1, "列出候選型號與報價", 1, 1);
  insItem.run(t1, "詢價並下單", 0, 2);

  insTask.run(
    "水密艙 v3 修改",
    "上次水測發現滲漏，重新設計 O-ring 溝槽深度。",
    "todo",
    "high",
    "mech",
    daysFromNow(-1),
    leaderId,
    leaderId,
    null
  );

  insTask.run(
    "主控板接線圖繪製",
    "畫出新版電力與訊號接線圖，標註保險絲規格。",
    "todo",
    "medium",
    "elec",
    daysFromNow(6),
    memberId,
    leaderId,
    null
  );

  const t4 = insTask.run(
    "前向攝影機影像辨識",
    "辨識比賽任務道具，輸出座標給自動模式。",
    "todo",
    "medium",
    "sw",
    daysFromNow(12),
    memberId,
    leaderId,
    null
  ).lastInsertRowid as number;
  insItem.run(t4, "收集道具照片建立資料集", 0, 0);
  insItem.run(t4, "訓練模型並在水測驗證", 0, 1);

  insTask.run(
    "技術設計報告大綱",
    "依競賽規定的章節列出報告大綱與分工。",
    "todo",
    "medium",
    "general",
    daysFromNow(16),
    leaderId,
    leaderId,
    null
  );

  insTask.run(
    "機械手臂夾取機構列印",
    "3D 列印夾爪 v2 並裝上測試開合角度。",
    "doing",
    "low",
    "mech",
    daysFromNow(9),
    leaderId,
    leaderId,
    null
  );

  insTask.run(
    "採買備用 O-ring 與密封圈",
    "",
    "done",
    "low",
    "general",
    daysFromNow(-3),
    memberId,
    leaderId,
    new Date().toISOString()
  );

  const insEvent = db.prepare(
    "INSERT INTO events (title, type, date, time, location, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );
  insEvent.run("每週例會", "meeting", nextMonday(), "19:30", "工作坊 B1", "各組進度報告", leaderId);
  insEvent.run("贊助簡報練習", "other", daysFromNow(4), "12:30", "學生活動中心", "", leaderId);
  insEvent.run("水測 #3", "watertest", daysFromNow(9), "13:00", "校內游泳池", "重點驗證水密艙 v3", leaderId);
  insEvent.run("區賽（預定）", "competition", compDate, null, "", "實際日期以主辦公告為準", leaderId);
});

seed.immediate();

// ---- 第二階段播種：新功能頁面的示範資料（對已存在的資料庫也會補上）----
const seedV2 = db.transaction(() => {
  const hasUsers = (
    db.prepare("SELECT COUNT(*) AS c FROM users").get() as { c: number }
  ).c;
  if (hasUsers === 0) return; // 等 seed() 先建好帳號

  const leaderId = (
    db.prepare("SELECT id FROM users WHERE role = 'leader' ORDER BY id LIMIT 1").get() as
      | { id: number }
      | undefined
  )?.id;
  const memberId = (
    db.prepare("SELECT id FROM users WHERE role != 'leader' ORDER BY id LIMIT 1").get() as
      | { id: number }
      | undefined
  )?.id;

  if (
    (db.prepare("SELECT COUNT(*) AS c FROM mission_tasks").get() as { c: number }).c === 0
  ) {
    const insMission = db.prepare(
      "INSERT INTO mission_tasks (title, description, points, sort_order) VALUES (?, ?, ?, ?)"
    );
    insMission.run("穿越閘門", "ROV 從起始區出發，穿過閘門進入任務區。", 20, 0);
    insMission.run("海底取樣", "用機械手臂拾取樣本並放進取樣籃。", 30, 1);
    insMission.run("關閉閥門", "辨識漏氣閥門並旋轉關閉。", 25, 2);
  }

  if ((db.prepare("SELECT COUNT(*) AS c FROM parts").get() as { c: number }).c === 0) {
    const insPart = db.prepare(
      `INSERT INTO parts (name, spec, link, qty, unit, est_price, actual_price, purpose, subteam, status,
        requested_by, decided_at, decided_note, order_vendor, order_ref, ordered_by, arrived_at, approve_token)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    insPart.run(
      "T200 推進器", "Blue Robotics T200 PWM 版", "https://bluerobotics.com/store/t100-t200/",
      4, "顆", 5500, null, "主推進與側推，配合推力需求計算", "elec",
      "pending", leaderId, null, null, "", "", null, null,
      randomBytes(16).toString("hex")
    );
    insPart.run(
      "水下攝影模組", "Raspberry Pi Camera + 防水罩", "",
      1, "組", 1200, null, "前向影像辨識用", "sw",
      "approved", memberId, new Date().toISOString(), "可以買，記得附發票才能核銷。", "", "", null, null, null
    );
    insPart.run(
      "O-ring 補充包", "NBR 50A 各尺寸混裝", "",
      2, "包", 250, 536, "水密艙備品", "mech",
      "ordered", leaderId, new Date().toISOString(), null, "蝦皮", "訂單 20260901-xxx", leaderId, null, null
    );
    insPart.run(
      "Tether 纜線 30m", "4芯屏蔽 + 兩組電源線", "",
      1, "條", 1800, 1750, "替代舊纜線，改善訊號", "elec",
      "arrived", leaderId, new Date().toISOString(), null, "露天", "RT-xxxx", leaderId, new Date().toISOString(), null
    );
  }

  if ((db.prepare("SELECT COUNT(*) AS c FROM equipment").get() as { c: number }).c === 0) {
    const insEq = db.prepare(
      "INSERT INTO equipment (name, category, note, status, borrower_id, borrowed_at, due_return) VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    insEq.run("T200 備用推進器", "推進器", "序號 T200-1128", "available", null, null, null);
    insEq.run("GoPro HERO11", "相機", "含防水殼與浮力桿", "borrowed", memberId ?? null, new Date().toISOString(), daysFromNow(7));
    insEq.run("備用 Tether 15m", "纜線", "接頭有磨損，比賽前要換", "maintenance", null, null, null);
    insEq.run("電烙鐵工具組", "工具", "工作櫃下層", "available", null, null, null);
  }

  if ((db.prepare("SELECT COUNT(*) AS c FROM dive_logs").get() as { c: number }).c === 0) {
    db.prepare(
      "INSERT INTO dive_logs (date, title, participants, tested, issues, fixes, next_steps, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(
      daysFromNow(-9),
      "水測 #2",
      "隊長、隊員（示範）",
      "推進器 PWM 校正、水密艙 v2 沉底 10 分鐘",
      "左後推進器偶爾斷訊；水密艙蓋邊緣滲小水珠",
      "重新壓接 PWM 接頭；蓋邊加一條 O-ring 應急",
      "驗證 v3 水密艙；確認推進器接頭在低溫下是否復發",
      leaderId ?? null
    );
  }

  void leaderId;
  void memberId;
});

seedV2.immediate();

export default db;

// ---- 常用查詢 ----

export function setSetting(key: string, value: string) {
  db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(key, value);
}

export function getSettingValue(key: string): string | null {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

/** iCal 訂閱 token：沒有就現場產生（對舊資料庫也有效） */
export function getOrCreateIcalToken(): string {
  let token = getSettingValue("ical_token");
  if (!token) {
    token = randomBytes(16).toString("hex");
    setSetting("ical_token", token);
  }
  return token;
}

export function getSettings(): Settings {
  const s: Settings = { team_name: "ROV 隊", competition_date: null };
  const name = getSettingValue("team_name");
  const date = getSettingValue("competition_date");
  if (name) s.team_name = name;
  s.competition_date = date || null;
  return s;
}

export function getTaskWithItems(id: number): Task | undefined {
  const task = db
    .prepare(
      `SELECT t.*, u.display_name AS assignee_name
       FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id
       WHERE t.id = ?`
    )
    .get(id) as unknown as Omit<Task, "items"> | undefined;
  if (!task) return undefined;
  const items = db
    .prepare(
      "SELECT * FROM checklist_items WHERE task_id = ? ORDER BY sort_order, id"
    )
    .all(id) as unknown as ChecklistItem[];
  return { ...task, items };
}

export function getEvents(): TeamEvent[] {
  return db
    .prepare("SELECT * FROM events ORDER BY date, time IS NOT NULL, time, id")
    .all() as unknown as TeamEvent[];
}

export function getPartByToken(token: string) {
  return db
    .prepare("SELECT * FROM parts WHERE approve_token = ?")
    .get(token) as unknown as
    | import("./types").Part
    | undefined;
}
