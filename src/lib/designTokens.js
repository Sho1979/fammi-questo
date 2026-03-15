/**
 * designTokens.js — Design tokens per uso JS.
 *
 * Specchia le CSS custom properties definite in index.css.
 * Usare questi valori quando si lavora con inline styles in JSX
 * invece di hardcodare colori hex o rgba.
 *
 * Per Tailwind classes: usare le classi utility normalmente.
 * Per style={{ }}: usare `var(--token)` o queste costanti.
 */

// ═══════════════════════════════════════════════════════════════
// PRIMARY PALETTE
// ═══════════════════════════════════════════════════════════════
export const PRIMARY = '#6C5CE7'
export const PRIMARY_DARK = '#5A4BD1'
export const PRIMARY_LIGHT = '#A29BFE'
export const PRIMARY_50 = '#F0EEFF'

// ═══════════════════════════════════════════════════════════════
// ACCENT PALETTE
// ═══════════════════════════════════════════════════════════════
export const ACCENT_EMERALD = '#00B894'
export const ACCENT_ORANGE = '#FDCB6E'
export const ACCENT_CORAL = '#E17055'
export const ACCENT_SKY = '#74B9FF'
export const ACCENT_PINK = '#FD79A8'

// ═══════════════════════════════════════════════════════════════
// NEUTRAL PALETTE
// ═══════════════════════════════════════════════════════════════
export const BG_MAIN = '#F8F7FC'
export const BG_CARD = '#FFFFFF'
export const TEXT_PRIMARY = '#2D3436'
export const TEXT_SECONDARY = '#636E72'
export const TEXT_MUTED = '#B2BEC3'
export const BORDER_LIGHT = '#E8E6F0'
export const BORDER_SUBTLE = '#F0EEF5'

// ═══════════════════════════════════════════════════════════════
// SEMANTIC COLORS (per inline styles)
// ═══════════════════════════════════════════════════════════════
export const COLOR_SUCCESS = '#22C55E'
export const COLOR_WARNING = '#F59E0B'
export const COLOR_ERROR = '#EF4444'
export const COLOR_INFO = '#0EA5E9'

// ═══════════════════════════════════════════════════════════════
// TAB/NAV COLORS (usati in BottomNav)
// ═══════════════════════════════════════════════════════════════
export const NAV_HOME = '#6C5CE7'
export const NAV_CALENDAR = '#0984E3'
export const NAV_TASKS = '#00B894'
export const NAV_DISPENSA = '#E17055'
export const NAV_EXPENSES = '#FDCB6E'

// ═══════════════════════════════════════════════════════════════
// PRIORITY COLORS (usati in TaskCard)
// ═══════════════════════════════════════════════════════════════
export const PRIORITY_HIGH = '#EF4444'
export const PRIORITY_MEDIUM = '#F59E0B'
export const PRIORITY_LOW = '#94A3B8'

// ═══════════════════════════════════════════════════════════════
// BRAIN ACTION TYPE COLORS
// ═══════════════════════════════════════════════════════════════
export const ACTION_TASK = '#6C5CE7'
export const ACTION_CALENDAR = '#0EA5E9'
export const ACTION_EXPENSE = '#F59E0B'
export const ACTION_MEAL = '#22C55E'
export const ACTION_SHOPPING = '#EC4899'
export const ACTION_NOTE = '#94A3B8'
export const ACTION_REMINDER = '#8B5CF6'
export const ACTION_ABSENCE = '#EF4444'

// ═══════════════════════════════════════════════════════════════
// ACCESS LEVEL COLORS
// ═══════════════════════════════════════════════════════════════
export const ACCESS_FULL = '#6C5CE7'
export const ACCESS_INTERMEDIATE = '#00B894'
export const ACCESS_BASIC = '#F9CA24'
export const ACCESS_VIEW_ONLY = '#FF6B6B'

// ═══════════════════════════════════════════════════════════════
// GRADIENTS (per inline background)
// ═══════════════════════════════════════════════════════════════
export const GRADIENT_PRIMARY = 'linear-gradient(135deg, #6C5CE7 0%, #A29BFE 100%)'
export const GRADIENT_HEADER = 'linear-gradient(135deg, #6C5CE7 0%, #7C6CF7 50%, #8B7CF8 100%)'
export const GRADIENT_WARM = 'linear-gradient(135deg, #FDCB6E 0%, #E17055 100%)'
export const GRADIENT_FRESH = 'linear-gradient(135deg, #00B894 0%, #55EFC4 100%)'
export const GRADIENT_SKY = 'linear-gradient(135deg, #74B9FF 0%, #A29BFE 100%)'
export const GRADIENT_SUNSET = 'linear-gradient(135deg, #FD79A8 0%, #FDCB6E 100%)'

// ═══════════════════════════════════════════════════════════════
// SHADOWS
// ═══════════════════════════════════════════════════════════════
export const SHADOW_SM = '0 1px 3px rgba(108, 92, 231, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)'
export const SHADOW_MD = '0 4px 12px rgba(108, 92, 231, 0.08), 0 2px 4px rgba(0, 0, 0, 0.04)'
export const SHADOW_LG = '0 8px 24px rgba(108, 92, 231, 0.12), 0 4px 8px rgba(0, 0, 0, 0.04)'
export const SHADOW_GLOW = '0 4px 20px rgba(108, 92, 231, 0.25)'

// ═══════════════════════════════════════════════════════════════
// SPACING (pixel values for inline styles)
// ═══════════════════════════════════════════════════════════════
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
}

// ═══════════════════════════════════════════════════════════════
// RADII (matching CSS --radius-*)
// ═══════════════════════════════════════════════════════════════
export const RADIUS = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
}

// ═══════════════════════════════════════════════════════════════
// HELPER: genera rgba da hex + alpha
// ═══════════════════════════════════════════════════════════════
/**
 * Converte hex in rgba con alpha specificato.
 * Evita di hardcodare rgba(...) inline.
 * @param {string} hex — es. '#6C5CE7'
 * @param {number} alpha — es. 0.12
 * @returns {string} — es. 'rgba(108, 92, 231, 0.12)'
 */
export function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
