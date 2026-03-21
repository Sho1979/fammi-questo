/**
 * Dexie.js database — single source of truth (local-first).
 * Schema: all tables for R1, R2, R3. See 1_MASTER_ARCHITECTURE.md §3.4 and 4_DATA_MODEL.md.
 *
 * ─── DATA MODEL AUDIT (v8) ─────────────────────────────────────
 * Tabelle sincronizzate (TABLE_MAP in sync.js):
 *   family, members, expenses, budgets, events, tasks, taskTemplates,
 *   meals, mealPlans, shoppingItems, inventory, rewards, recurrences, notifications
 *
 * Tabelle solo locali (no sync):
 *   patterns, nlpDocuments, nlpLogs, conversationDrafts, conflictLog, syncLog, settings
 *
 * Tabelle INUTILIZZATE (candidate per rimozione futura):
 *   priceHistory — mai referenziata da hook o componenti
 *   brainNotes   — mai referenziata, probabilmente sostituita da patterns
 *
 * Naming conventions:
 *   Campi persona: person_id (owner), assigned_to (task), added_by (item creator),
 *                  created_by (plan creator), member_id (rewards/notifications), updated_by (last modifier)
 *   Campi data:    YYYY-MM-DD string → date, due_date, expiry_date, birth_date, end_date, week_start
 *                  ISO timestamp     → created_at, updated_at, completed_at, expires_at, resolved_at
 *   Campi sync:    _version (incrementale), _device_id (UUID dispositivo), _deleted (tombstone)
 * ────────────────────────────────────────────────────────────────
 */
import Dexie from 'dexie'

export const db = new Dexie('FamilyManagerDB')

// v1 — original schema
db.version(1).stores({
  family: 'id',
  members: 'id, family_id, role',
  expenses: 'id, family_id, date, category, person_id',
  budgets: 'id, family_id, &[category+month]',
  events: 'id, family_id, date, person_id',
  tasks: 'id, family_id, date, assigned_to, status',
  taskTemplates: 'id, family_id',
  meals: 'id, family_id',
  mealPlans: 'id, family_id, date',
  shoppingItems: 'id, family_id, bought',
  inventory: 'id, family_id, expires_at',
  notifications: 'id, family_id, read',
  recurrences: 'id, family_id, type',
  priceHistory: 'id, family_id, product_name',
  rewards: 'id, family_id, member_id, week_start',
  brainNotes: 'id, family_id',
  patterns: 'id, family_id, type',
  syncLog: '++id, table_name, record_id, synced',
  settings: 'key',
})

// v2 — fix index names: tasks.due_date, inventory.expiry_date, shoppingItems.checked
db.version(2).stores({
  family: 'id',
  members: 'id, family_id, role',
  expenses: 'id, family_id, date, category, person_id',
  budgets: 'id, family_id, &[category+month]',
  events: 'id, family_id, date, person_id',
  tasks: 'id, family_id, due_date, assigned_to, status',
  taskTemplates: 'id, family_id',
  meals: 'id, family_id',
  mealPlans: 'id, family_id, date',
  shoppingItems: 'id, family_id, checked',
  inventory: 'id, family_id, expiry_date',
  notifications: 'id, family_id, read',
  recurrences: 'id, family_id, type',
  priceHistory: 'id, family_id, product_name',
  rewards: 'id, family_id, member_id, week_start',
  brainNotes: 'id, family_id',
  patterns: 'id, family_id, type',
  syncLog: '++id, table_name, record_id, synced',
  settings: 'key',
})

// v3 — add member_id index to notifications for personal notifications
db.version(3).stores({
  family: 'id',
  members: 'id, family_id, role',
  expenses: 'id, family_id, date, category, person_id',
  budgets: 'id, family_id, &[category+month]',
  events: 'id, family_id, date, person_id',
  tasks: 'id, family_id, due_date, assigned_to, status',
  taskTemplates: 'id, family_id',
  meals: 'id, family_id',
  mealPlans: 'id, family_id, date',
  shoppingItems: 'id, family_id, checked',
  inventory: 'id, family_id, expiry_date',
  notifications: 'id, family_id, member_id, read',
  recurrences: 'id, family_id, type',
  priceHistory: 'id, family_id, product_name',
  rewards: 'id, family_id, member_id, week_start',
  brainNotes: 'id, family_id',
  patterns: 'id, family_id, type',
  syncLog: '++id, table_name, record_id, synced',
  settings: 'key',
})

// v4 — Brain learning: patterns gets keyword+actionType+score indexes for fast lookup
db.version(4).stores({
  family: 'id',
  members: 'id, family_id, role',
  expenses: 'id, family_id, date, category, person_id',
  budgets: 'id, family_id, &[category+month]',
  events: 'id, family_id, date, person_id',
  tasks: 'id, family_id, due_date, assigned_to, status',
  taskTemplates: 'id, family_id',
  meals: 'id, family_id',
  mealPlans: 'id, family_id, date',
  shoppingItems: 'id, family_id, checked',
  inventory: 'id, family_id, expiry_date',
  notifications: 'id, family_id, member_id, read',
  recurrences: 'id, family_id, type',
  priceHistory: 'id, family_id, product_name',
  rewards: 'id, family_id, member_id, week_start',
  brainNotes: 'id, family_id',
  patterns: 'id, family_id, keyword, actionType, score',
  syncLog: '++id, table_name, record_id, synced',
  settings: 'key',
})

// v5 — NLP.js: aggiunge nlpDocuments per training utente, settings con id index
db.version(5).stores({
  family: 'id',
  members: 'id, family_id, role',
  expenses: 'id, family_id, date, category, person_id',
  budgets: 'id, family_id, &[category+month]',
  events: 'id, family_id, date, person_id',
  tasks: 'id, family_id, due_date, assigned_to, status',
  taskTemplates: 'id, family_id',
  meals: 'id, family_id',
  mealPlans: 'id, family_id, date',
  shoppingItems: 'id, family_id, checked',
  inventory: 'id, family_id, expiry_date',
  notifications: 'id, family_id, member_id, read',
  recurrences: 'id, family_id, type',
  priceHistory: 'id, family_id, product_name',
  rewards: 'id, family_id, member_id, week_start',
  brainNotes: 'id, family_id',
  patterns: 'id, family_id, keyword, actionType, score',
  nlpDocuments: 'id, family_id, intent',
  syncLog: '++id, table_name, record_id, synced',
  settings: 'id, family_id, key',
})

// v6 — Brain debug: aggiunge nlpLogs per tracciamento parse NLP
db.version(6).stores({
  family: 'id',
  members: 'id, family_id, role',
  expenses: 'id, family_id, date, category, person_id',
  budgets: 'id, family_id, &[category+month]',
  events: 'id, family_id, date, person_id',
  tasks: 'id, family_id, due_date, assigned_to, status',
  taskTemplates: 'id, family_id',
  meals: 'id, family_id',
  mealPlans: 'id, family_id, date',
  shoppingItems: 'id, family_id, checked',
  inventory: 'id, family_id, expiry_date',
  notifications: 'id, family_id, member_id, read',
  recurrences: 'id, family_id, type',
  priceHistory: 'id, family_id, product_name',
  rewards: 'id, family_id, member_id, week_start',
  brainNotes: 'id, family_id',
  patterns: 'id, family_id, keyword, actionType, score',
  nlpDocuments: 'id, family_id, intent',
  nlpLogs: 'id, family_id, created_at, result_intent, confidence, used_ai',
  syncLog: '++id, table_name, record_id, synced',
  settings: 'id, family_id, key',
})

// v7 — Conversation memory: aggiunge conversationDrafts per merge frammenti
db.version(7).stores({
  family: 'id',
  members: 'id, family_id, role',
  expenses: 'id, family_id, date, category, person_id',
  budgets: 'id, family_id, &[category+month]',
  events: 'id, family_id, date, person_id',
  tasks: 'id, family_id, due_date, assigned_to, status',
  taskTemplates: 'id, family_id',
  meals: 'id, family_id',
  mealPlans: 'id, family_id, date',
  shoppingItems: 'id, family_id, checked',
  inventory: 'id, family_id, expiry_date',
  notifications: 'id, family_id, member_id, read',
  recurrences: 'id, family_id, type',
  priceHistory: 'id, family_id, product_name',
  rewards: 'id, family_id, member_id, week_start',
  brainNotes: 'id, family_id',
  patterns: 'id, family_id, keyword, actionType, score',
  nlpDocuments: 'id, family_id, intent',
  nlpLogs: 'id, family_id, created_at, result_intent, confidence, used_ai',
  conversationDrafts: 'id, [family_id+created_by+status], family_id, created_by, status, intent, created_at, updated_at, expires_at',
  syncLog: '++id, table_name, record_id, synced',
  settings: 'id, family_id, key',
})

// v8 — Sync conflicts: aggiunge conflictLog per tracciamento conflitti sync
db.version(8).stores({
  family: 'id',
  members: 'id, family_id, role',
  expenses: 'id, family_id, date, category, person_id',
  budgets: 'id, family_id, &[category+month]',
  events: 'id, family_id, date, person_id',
  tasks: 'id, family_id, due_date, assigned_to, status',
  taskTemplates: 'id, family_id',
  meals: 'id, family_id',
  mealPlans: 'id, family_id, date',
  shoppingItems: 'id, family_id, checked',
  inventory: 'id, family_id, expiry_date',
  notifications: 'id, family_id, member_id, read',
  recurrences: 'id, family_id, type',
  priceHistory: 'id, family_id, product_name',
  rewards: 'id, family_id, member_id, week_start',
  brainNotes: 'id, family_id',
  patterns: 'id, family_id, keyword, actionType, score',
  nlpDocuments: 'id, family_id, intent',
  nlpLogs: 'id, family_id, created_at, result_intent, confidence, used_ai',
  conversationDrafts: 'id, [family_id+created_by+status], family_id, created_by, status, intent, created_at, updated_at, expires_at',
  conflictLog: '++id, family_id, table_name, record_id, resolved_at',
  syncLog: '++id, table_name, record_id, synced',
  settings: 'id, family_id, key',
})

// v9 — Relational layer: messageContexts + entityRelations
// Inspired by entity-relationship extraction patterns.
// messageContexts: groups all actions born from the same user input.
// entityRelations: explicit links between entities (same_message, involves, assigned_to, etc.)
db.version(9).stores({
  family: 'id',
  members: 'id, family_id, role',
  expenses: 'id, family_id, date, category, person_id',
  budgets: 'id, family_id, &[category+month]',
  events: 'id, family_id, date, person_id',
  tasks: 'id, family_id, due_date, assigned_to, status',
  taskTemplates: 'id, family_id',
  meals: 'id, family_id',
  mealPlans: 'id, family_id, date',
  shoppingItems: 'id, family_id, checked',
  inventory: 'id, family_id, expiry_date',
  notifications: 'id, family_id, member_id, read, message_context_id',
  recurrences: 'id, family_id, type',
  priceHistory: 'id, family_id, product_name',
  rewards: 'id, family_id, member_id, week_start',
  brainNotes: 'id, family_id',
  patterns: 'id, family_id, keyword, actionType, score',
  nlpDocuments: 'id, family_id, intent',
  nlpLogs: 'id, family_id, created_at, result_intent, confidence, used_ai',
  conversationDrafts: 'id, [family_id+created_by+status], family_id, created_by, status, intent, created_at, updated_at, expires_at',
  conflictLog: '++id, family_id, table_name, record_id, resolved_at',
  syncLog: '++id, table_name, record_id, synced',
  settings: 'id, family_id, key',
  // ─── Relational layer ───
  messageContexts: 'id, family_id, created_by_member_id, created_at, status',
  entityRelations: 'id, family_id, [from_entity_type+from_entity_id], [to_entity_type+to_entity_id], relation_type',
})

// v10 — Compound indexes for efficient date-range queries
db.version(10).stores({
  expenses: 'id, family_id, [family_id+date], date, category, person_id',
  events: 'id, family_id, [family_id+date], date, person_id',
  tasks: 'id, family_id, [family_id+due_date], due_date, assigned_to, status',
})
