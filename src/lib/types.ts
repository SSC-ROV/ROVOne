export type Role = "leader" | "teacher" | "member";

// ---- 開發週期 ----
export type CycleStatus =
  | "pending_leader"
  | "pending_teacher"
  | "active"
  | "completed"
  | "rejected";

export interface CycleMemberRef {
  id: number;
  display_name: string;
}

export interface Cycle {
  id: number;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  status: CycleStatus;
  proposer_id: number | null;
  proposer_name: string | null;
  decided_by: number | null;
  decided_by_name: string | null;
  decided_note: string;
  completed_at: string | null;
  created_at: string;
  members: CycleMemberRef[];
  task_total: number;
  task_done: number;
}
export type Subteam = "mech" | "elec" | "sw" | "pilot" | "general";
export type TaskStatus = "todo" | "doing" | "done";
export type Priority = "high" | "medium" | "low";
export type EventType = "meeting" | "watertest" | "competition" | "other";

export interface Me {
  id: number;
  username: string;
  display_name: string;
  role: Role;
  subteam: Subteam;
  email?: string | null;
  login_method?: "password" | "google";
  password_changed_at?: string | null;
}

export interface ChecklistItem {
  id: number;
  task_id: number;
  text: string;
  done: number;
  sort_order: number;
}

export interface Task {
  id: number;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  subteam: Subteam;
  due_date: string | null;
  assignee_id: number | null;
  assignee_name: string | null;
  created_by: number | null;
  mission_id: number | null;
  cycle_id: number | null;
  version: number;
  sort_order: number;
  completed_at: string | null;
  items: ChecklistItem[];
}

export interface TeamEvent {
  id: number;
  title: string;
  type: EventType;
  date: string; // YYYY-MM-DD
  time: string | null; // HH:MM
  location: string;
  notes: string;
  created_by: number | null;
}

export interface Member {
  id: number;
  username: string;
  display_name: string;
  role: Role;
  subteam: Subteam;
}

export interface Settings {
  team_name: string;
  competition_date: string | null;
}

// ---- 零件採買 ----
export type PartStatus = "pending" | "approved" | "rejected" | "ordered" | "arrived";

export interface Part {
  id: number;
  name: string;
  spec: string;
  link: string;
  qty: number;
  unit: string;
  est_price: number;
  actual_price: number | null;
  purpose: string;
  subteam: Subteam;
  status: PartStatus;
  requested_by: number | null;
  requested_by_name: string | null;
  decided_at: string | null;
  decided_note: string | null;
  order_vendor: string;
  order_ref: string;
  ordered_by: number | null;
  arrived_at: string | null;
  approve_token: string | null;
  approve_expires_at: string | null;
  created_at: string;
}

// ---- 設備借用 ----
export type EquipmentStatus = "available" | "borrowed" | "maintenance";

export interface Equipment {
  id: number;
  name: string;
  category: string;
  note: string;
  status: EquipmentStatus;
  borrower_id: number | null;
  borrower_name: string | null;
  borrowed_at: string | null;
  due_return: string | null;
}

// ---- 水測日誌 ----
export interface DiveLog {
  id: number;
  date: string;
  title: string;
  participants: string;
  tested: string;
  issues: string;
  fixes: string;
  next_steps: string;
  created_by: number | null;
  created_by_name: string | null;
}

// ---- 比賽任務對照 ----
export interface MissionTask {
  id: number;
  title: string;
  description: string;
  points: number | null;
  sort_order: number;
  task_total: number;
  task_done: number;
}
