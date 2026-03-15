-- ============================================================
-- APP FAMILY — Supabase Migration
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Family ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS families (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  pin_hash TEXT,
  invite_code TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  _deleted BOOLEAN DEFAULT false,
  _version INTEGER DEFAULT 1
);

-- ─── Members ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  family_id TEXT REFERENCES families(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'figlio',
  avatar TEXT,
  pin TEXT,
  access_level TEXT DEFAULT 'full',
  birth_date TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  _deleted BOOLEAN DEFAULT false,
  _version INTEGER DEFAULT 1
);

-- ─── Expenses ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  family_id TEXT REFERENCES families(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  category TEXT,
  note TEXT,
  date TEXT,
  person_id TEXT,
  shop TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  _deleted BOOLEAN DEFAULT false,
  _version INTEGER DEFAULT 1,
  _device_id TEXT
);

-- ─── Budgets ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS budgets (
  id TEXT PRIMARY KEY,
  family_id TEXT REFERENCES families(id) ON DELETE CASCADE,
  category TEXT,
  month TEXT,
  amount NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  _deleted BOOLEAN DEFAULT false,
  _version INTEGER DEFAULT 1
);

-- ─── Events ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  family_id TEXT REFERENCES families(id) ON DELETE CASCADE,
  title TEXT,
  date TEXT,
  time_start TEXT,
  time_end TEXT,
  category TEXT,
  person_id TEXT,
  note TEXT,
  logistics JSONB DEFAULT '[]',
  recurrence_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  _deleted BOOLEAN DEFAULT false,
  _version INTEGER DEFAULT 1,
  _device_id TEXT
);

-- ─── Tasks ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  family_id TEXT REFERENCES families(id) ON DELETE CASCADE,
  title TEXT,
  description TEXT,
  category TEXT,
  priority TEXT DEFAULT 'media',
  status TEXT DEFAULT 'todo',
  assigned_to TEXT,
  date TEXT,
  points INTEGER DEFAULT 0,
  proposed_by TEXT,
  approved_by TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  _deleted BOOLEAN DEFAULT false,
  _version INTEGER DEFAULT 1,
  _device_id TEXT
);

-- ─── Task Templates ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS task_templates (
  id TEXT PRIMARY KEY,
  family_id TEXT REFERENCES families(id) ON DELETE CASCADE,
  title TEXT,
  category TEXT,
  assigned_to TEXT,
  points INTEGER DEFAULT 0,
  recurrence TEXT DEFAULT 'daily',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  _deleted BOOLEAN DEFAULT false,
  _version INTEGER DEFAULT 1
);

-- ─── Meals ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meals (
  id TEXT PRIMARY KEY,
  family_id TEXT REFERENCES families(id) ON DELETE CASCADE,
  name TEXT,
  ingredients TEXT,
  category TEXT,
  favorite BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  _deleted BOOLEAN DEFAULT false,
  _version INTEGER DEFAULT 1
);

-- ─── Meal Plans ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meal_plans (
  id TEXT PRIMARY KEY,
  family_id TEXT REFERENCES families(id) ON DELETE CASCADE,
  date TEXT,
  slot TEXT,
  name TEXT,
  note TEXT,
  recipe_url TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  _deleted BOOLEAN DEFAULT false,
  _version INTEGER DEFAULT 1
);

-- ─── Shopping Items ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shopping_items (
  id TEXT PRIMARY KEY,
  family_id TEXT REFERENCES families(id) ON DELETE CASCADE,
  name TEXT,
  quantity NUMERIC DEFAULT 1,
  unit TEXT DEFAULT 'pz',
  category TEXT,
  checked BOOLEAN DEFAULT false,
  added_by TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  _deleted BOOLEAN DEFAULT false,
  _version INTEGER DEFAULT 1
);

-- ─── Inventory ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory (
  id TEXT PRIMARY KEY,
  family_id TEXT REFERENCES families(id) ON DELETE CASCADE,
  name TEXT,
  quantity NUMERIC DEFAULT 1,
  unit TEXT DEFAULT 'pz',
  location TEXT DEFAULT 'dispensa',
  expiry_date TEXT,
  category TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  _deleted BOOLEAN DEFAULT false,
  _version INTEGER DEFAULT 1
);

-- ─── Rewards ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rewards (
  id TEXT PRIMARY KEY,
  family_id TEXT REFERENCES families(id) ON DELETE CASCADE,
  member_id TEXT,
  week_start TEXT,
  points INTEGER DEFAULT 0,
  reason TEXT,
  type TEXT DEFAULT 'task',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  _deleted BOOLEAN DEFAULT false,
  _version INTEGER DEFAULT 1
);

-- ─── Recurrences ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recurrences (
  id TEXT PRIMARY KEY,
  family_id TEXT REFERENCES families(id) ON DELETE CASCADE,
  type TEXT,
  event_title TEXT,
  event_category TEXT,
  event_person_id TEXT,
  day_of_week INTEGER,
  day_of_month INTEGER,
  time_start TEXT,
  time_end TEXT,
  end_date TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  _deleted BOOLEAN DEFAULT false,
  _version INTEGER DEFAULT 1
);

-- ─── Notifications ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  family_id TEXT REFERENCES families(id) ON DELETE CASCADE,
  member_id TEXT,
  type TEXT,
  title TEXT,
  message TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  _deleted BOOLEAN DEFAULT false,
  _version INTEGER DEFAULT 1
);

-- ─── Row Level Security ──────────────────────────────────────
-- Enable RLS on all tables
ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Policy: allow all operations for anon users (app uses family_id for isolation)
-- In production, you'd use Supabase Auth + JWT claims for better security
CREATE POLICY "Allow all for anon" ON families FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON expenses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON budgets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON task_templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON meals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON meal_plans FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON shopping_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON inventory FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON rewards FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON recurrences FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON notifications FOR ALL USING (true) WITH CHECK (true);

-- ─── Index for invite codes ──────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_families_invite_code ON families(invite_code);
CREATE INDEX IF NOT EXISTS idx_members_family_id ON members(family_id);
CREATE INDEX IF NOT EXISTS idx_expenses_family_id ON expenses(family_id);
CREATE INDEX IF NOT EXISTS idx_events_family_id ON events(family_id);
CREATE INDEX IF NOT EXISTS idx_tasks_family_id ON tasks(family_id);
