-- ============================================================
-- APP FAMILY — Supabase Migration V2: Data Model Audit Fixes
-- Run AFTER supabase-migration.sql
-- ============================================================

-- ─── FIX 1: tasks.date → tasks.due_date ─────────────────────
-- BUG CRITICO: Dexie e tutti gli hooks usano "due_date" (dal v2 schema),
-- ma Supabase aveva ancora "date". Sync push perdeva il campo,
-- pull sovrascriveva con date=null perdendo due_date.
ALTER TABLE tasks RENAME COLUMN date TO due_date;

-- ─── FIX 2: _device_id mancante su tabelle sincronizzate ────
-- crud.js aggiunge _device_id a OGNI record, ma solo 3 tabelle
-- Supabase lo avevano (expenses, events, tasks).
-- Senza questa colonna, push ignora il campo e pull non lo restituisce.
ALTER TABLE families     ADD COLUMN IF NOT EXISTS _device_id TEXT;
ALTER TABLE members      ADD COLUMN IF NOT EXISTS _device_id TEXT;
ALTER TABLE budgets      ADD COLUMN IF NOT EXISTS _device_id TEXT;
ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS _device_id TEXT;
ALTER TABLE meals        ADD COLUMN IF NOT EXISTS _device_id TEXT;
ALTER TABLE meal_plans   ADD COLUMN IF NOT EXISTS _device_id TEXT;
ALTER TABLE shopping_items ADD COLUMN IF NOT EXISTS _device_id TEXT;
ALTER TABLE inventory    ADD COLUMN IF NOT EXISTS _device_id TEXT;
ALTER TABLE rewards      ADD COLUMN IF NOT EXISTS _device_id TEXT;
ALTER TABLE recurrences  ADD COLUMN IF NOT EXISTS _device_id TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS _device_id TEXT;

-- ─── FIX 3: updated_by mancante ovunque ─────────────────────
-- Aggiunto in crud.js (Point 1 sync) ma nessuna tabella Supabase
-- aveva la colonna. Senza, il campo viene perso durante push/pull.
ALTER TABLE families     ADD COLUMN IF NOT EXISTS updated_by TEXT;
ALTER TABLE members      ADD COLUMN IF NOT EXISTS updated_by TEXT;
ALTER TABLE expenses     ADD COLUMN IF NOT EXISTS updated_by TEXT;
ALTER TABLE budgets      ADD COLUMN IF NOT EXISTS updated_by TEXT;
ALTER TABLE events       ADD COLUMN IF NOT EXISTS updated_by TEXT;
ALTER TABLE tasks        ADD COLUMN IF NOT EXISTS updated_by TEXT;
ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS updated_by TEXT;
ALTER TABLE meals        ADD COLUMN IF NOT EXISTS updated_by TEXT;
ALTER TABLE meal_plans   ADD COLUMN IF NOT EXISTS updated_by TEXT;
ALTER TABLE shopping_items ADD COLUMN IF NOT EXISTS updated_by TEXT;
ALTER TABLE inventory    ADD COLUMN IF NOT EXISTS updated_by TEXT;
ALTER TABLE rewards      ADD COLUMN IF NOT EXISTS updated_by TEXT;
ALTER TABLE recurrences  ADD COLUMN IF NOT EXISTS updated_by TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- ─── FIX 4: conflict_log table (per Point 1 sync) ───────────
-- La tabella conflictLog esiste solo in Dexie (v8).
-- Se in futuro si vuole sync anche i conflitti, serve su Supabase.
CREATE TABLE IF NOT EXISTS conflict_log (
  id BIGSERIAL PRIMARY KEY,
  family_id TEXT REFERENCES families(id) ON DELETE CASCADE,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  local_updated_at TEXT,
  local_updated_by TEXT,
  local_device_id TEXT,
  remote_updated_at TEXT,
  remote_updated_by TEXT,
  remote_device_id TEXT,
  resolved_by TEXT,
  resolved_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conflict_log_family ON conflict_log(family_id);

-- ─── NOTA: tabelle inutilizzate (non rimosse) ───────────────
-- priceHistory: dichiarata in Dexie, presente in ENTITY_TABLES di crud.js,
--   ma MAI usata da nessun hook o componente. Candidata per rimozione futura.
-- brainNotes: stessa situazione — mai usata. Probabilmente sostituita
--   da patterns + nlpDocuments durante l'evoluzione del Brain.
-- Non le rimuoviamo ora per sicurezza (senza inventare e rompere).
