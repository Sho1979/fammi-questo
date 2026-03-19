/**
 * Constants: expense categories, role icons, member colors, access by age, nav tabs, task categories.
 * See 4_DATA_MODEL.md and 1_MASTER_ARCHITECTURE.md §4.3.
 */

/** 16 expense categories — id, label (Italian), icon, color */
export const DEFAULT_CATEGORIES = [
  { id: 'alimentari', label: 'Alimentari', icon: '🛒', color: '#4CAF50' },
  { id: 'trasporto', label: 'Trasporto', icon: '🚗', color: '#2196F3' },
  { id: 'bollette', label: 'Bollette', icon: '💡', color: '#FF9800' },
  { id: 'affitto', label: 'Affitto', icon: '🏠', color: '#795548' },
  { id: 'salute', label: 'Salute', icon: '💊', color: '#E91E63' },
  { id: 'scuola', label: 'Scuola', icon: '📚', color: '#9C27B0' },
  { id: 'abbigliamento', label: 'Abbigliamento', icon: '👕', color: '#00BCD4' },
  { id: 'svago', label: 'Svago', icon: '🎬', color: '#673AB7' },
  { id: 'telefono', label: 'Telefono', icon: '📱', color: '#3F51B5' },
  { id: 'assicurazione', label: 'Assicurazione', icon: '🛡️', color: '#607D8B' },
  { id: 'animali', label: 'Animali', icon: '🐾', color: '#795548' },
  { id: 'casa', label: 'Casa', icon: '🔧', color: '#8BC34A' },
  { id: 'regali', label: 'Regali', icon: '🎁', color: '#F44336' },
  { id: 'viaggi', label: 'Viaggi', icon: '✈️', color: '#009688' },
  { id: 'sport', label: 'Sport', icon: '⚽', color: '#4CAF50' },
  { id: 'altro', label: 'Altro', icon: '📌', color: '#9E9E9E' },
]

/** Role → emoji icon (for member avatar) */
export const ROLE_ICONS = {
  parent: '👨',
  elder: '👴',
  child: '👧',
  other: '👤',
}

/** Hex colors for member badges (cycle by index — supports up to 16 members) */
export const MEMBER_COLORS = [
  '#4A90D9',
  '#E91E63',
  '#8BC34A',
  '#FF9800',
  '#9C27B0',
  '#00BCD4',
  '#F44336',
  '#3F51B5',
  '#009688',
  '#795548',
  '#607D8B',
  '#CDDC39',
  '#FF5722',
  '#673AB7',
  '#03A9F4',
  '#FFC107',
]

/**
 * Access level by child age (used when role === 'child'). Parent/elder use 'full' from role.
 * @param {number} age
 * @returns {'full'|'calendar_tasks'|'basic'|'view_only'}
 */
export function ACCESS_BY_AGE(age) {
  if (age >= 18) return 'full'
  if (age >= 13) return 'calendar_tasks'
  if (age >= 6) return 'basic'
  return 'view_only'
}

/** Tab config: path, label (Italian), icon (Lucide name) */
const TAB_HOME = { path: '/', label: 'Home', icon: 'Home' }
const TAB_CALENDAR = { path: '/calendar', label: 'Calendario', icon: 'CalendarDays' }
const TAB_TASKS = { path: '/tasks', label: 'Task', icon: 'ListChecks' }
const TAB_EXPENSES = { path: '/expenses', label: 'Spese', icon: 'Wallet' }
const TAB_DISPENSA = { path: '/dispensa', label: 'Dispensa', icon: 'Package' }
const TAB_STATS = { path: '/stats', label: 'Statistiche', icon: 'BarChart3' }
const TAB_BUDGET = { path: '/budget', label: 'Budget', icon: 'PiggyBank' }
const TAB_SETTINGS = { path: '/settings', label: 'Impostazioni', icon: 'Settings' }

/**
 * Map access_level → visible nav tabs (for BottomNav).
 * 5 tabs: Home, Calendar, Tasks, Dispensa, Spese.
 * Settings accessible from Header gear icon.
 */
export const NAV_TABS = {
  full: [TAB_HOME, TAB_CALENDAR, TAB_TASKS, TAB_DISPENSA, TAB_EXPENSES],
  calendar_tasks: [TAB_HOME, TAB_CALENDAR, TAB_TASKS, TAB_DISPENSA, TAB_EXPENSES],
  basic: [TAB_HOME, TAB_TASKS, TAB_DISPENSA, TAB_SETTINGS],
  view_only: [TAB_HOME, TAB_SETTINGS],
}

/** Task categories for R2 — id, label (Italian), icon */
export const TASK_CATEGORIES = [
  { id: 'pulizia', label: 'Pulizia', icon: '🧹' },
  { id: 'personale', label: 'Personale', icon: '👤' },
  { id: 'studio', label: 'Studio', icon: '📚' },
  { id: 'altro', label: 'Altro', icon: '📌' },
]

/** Event categories for R2 calendar — id, label (Italian), icon, color */
export const EVENT_CATEGORIES = [
  { id: 'sport', label: 'Sport', icon: '⚽', color: '#4CAF50' },
  { id: 'scuola', label: 'Scuola', icon: '📚', color: '#9C27B0' },
  { id: 'medico', label: 'Medico', icon: '🏥', color: '#E91E63' },
  { id: 'lavoro', label: 'Lavoro', icon: '💼', color: '#2196F3' },
  { id: 'famiglia', label: 'Famiglia', icon: '👨‍👩‍👧', color: '#FF9800' },
  { id: 'compleanno', label: 'Compleanno', icon: '🎂', color: '#F44336' },
  { id: 'hobby', label: 'Hobby', icon: '🎨', color: '#00BCD4' },
  { id: 'viaggio', label: 'Viaggio', icon: '✈️', color: '#009688' },
  { id: 'assenza', label: 'Non disponibile', icon: '🚫', color: '#EF4444' },
  { id: 'altro', label: 'Altro', icon: '📌', color: '#9E9E9E' },
]

/** Recurrence types for calendar events */
export const RECURRENCE_TYPES = [
  { id: 'none', label: 'Mai (evento singolo)' },
  { id: 'daily', label: 'Ogni giorno' },
  { id: 'weekly', label: 'Ogni settimana' },
  { id: 'monthly', label: 'Ogni mese' },
]

/** Logistics roles for event assignments */
export const LOGISTICS_ROLES = [
  { id: 'porta', label: 'Porta', icon: '🚗' },
  { id: 'riprende', label: 'Riprende', icon: '🔄' },
]

/** Weekday short labels (Mon-Sun, Italian) for calendar grid */
export const WEEKDAYS_SHORT = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']

// ─── Roles (enum-like constants) ──────────────────────────────
/** Canonical role values — Italian variants are normalized to English */
export const ROLES = {
  PARENT: 'parent',
  ELDER: 'elder',
  CHILD: 'child',
}

/** All Italian aliases that map to canonical roles */
export const ROLE_ALIASES = {
  genitore: ROLES.PARENT,
  anziano: ROLES.ELDER,
  figlio: ROLES.CHILD,
  ragazzo: ROLES.CHILD,
}

/**
 * Normalize role names to English canonical form.
 * The codebase historically mixed Italian and English role names.
 * This function ensures consistency.
 */
const ROLE_NORMALIZE_MAP = {
  'genitore': 'parent',
  'papà': 'parent', 'papa': 'parent', 'mamma': 'parent',
  'figlio': 'child', 'figlia': 'child',
  'nonno': 'elder', 'nonna': 'elder',
}

export function normalizeRole(role) {
  if (!role) return 'child'
  const lower = role.toLowerCase().trim()
  return ROLE_NORMALIZE_MAP[lower] || lower
}

/** Check if a role is a parent/elder (full access) */
export function isParentRole(role) {
  const normalized = normalizeRole(role)
  return normalized === 'parent' || normalized === 'elder'
}

/** Check if a role is a child */
export function isChildRole(role) {
  return normalizeRole(role) === 'child'
}

// ─── AI / Voice constants ─────────────────────────────────────
export const AI_MODEL = 'claude-haiku-4-5-20251001'
export const AI_API_URL = 'https://api.anthropic.com/v1/messages'
export const AI_MAX_DAILY_CALLS = 20

// ─── Shared units for shopping/inventory ──────────────────────
export const UNITS = ['pz', 'kg', 'g', 'L', 'mL']

// ─── Meal suggestion recipes (inventory-based) ────────────────
export const MEAL_RECIPES = [
  { name: 'Pasta al pomodoro', needs: ['pasta', 'pomodor'], cat: 'primo' },
  { name: 'Pasta al pesto', needs: ['pasta', 'pesto'], cat: 'primo' },
  { name: 'Pasta al ragù', needs: ['pasta', 'ragù', 'carne'], cat: 'primo' },
  { name: 'Risotto', needs: ['riso'], cat: 'primo' },
  { name: 'Insalata mista', needs: ['insalata', 'lattuga'], cat: 'contorno' },
  { name: 'Pollo arrosto', needs: ['pollo'], cat: 'secondo' },
  { name: 'Cotoletta', needs: ['cotoletta', 'fettina', 'pangrattato'], cat: 'secondo' },
  { name: 'Frittata', needs: ['uov'], cat: 'secondo' },
  { name: 'Pesce al forno', needs: ['pesce'], cat: 'secondo' },
  { name: 'Verdure grigliate', needs: ['zucchin', 'melanzane', 'peperoni'], cat: 'contorno' },
  { name: 'Pizza surgelata', needs: ['pizza'], cat: 'piatto unico' },
  { name: 'Hamburger', needs: ['hamburger'], cat: 'secondo' },
  { name: 'Minestrone', needs: ['minestrone', 'verdur'], cat: 'primo' },
  { name: 'Piadina', needs: ['piadina'], cat: 'piatto unico' },
  { name: 'Toast / Panino', needs: ['pane', 'prosciutto', 'formaggio'], cat: 'piatto unico' },
]
