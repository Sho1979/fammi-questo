/**
 * BottomNav — Colorful tabs with unique accent per section.
 * Each tab has its own color identity + notification badges.
 *
 * Badge logic:
 * - "Action items" (incomplete events, pending tasks) → always visible until resolved
 * - "New items" (expenses, shopping) → visible only if created after user's last visit
 * - lastVisitedAt per tab saved in localStorage for persistence
 */
import { useState, useEffect, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Home, CalendarDays, ListChecks, Wallet, Package } from 'lucide-react'
import useAuthStore from '../../store/authStore.js'
import { NAV_TABS } from '../../lib/constants.js'
import { useBadgeCounts } from '../../hooks/useBadgeCounts.js'
import useKeyboard from '../../hooks/useKeyboard.js'
import { hapticLight } from '../../lib/haptics.js'
import { isIOS } from '../../lib/platform.js'

const ICON_MAP = { Home, CalendarDays, ListChecks, Wallet, Package }

const LAST_VISITED_KEY = 'tab_last_visited'

/** Read lastVisited timestamps from localStorage */
function readLastVisited() {
  try { return JSON.parse(localStorage.getItem(LAST_VISITED_KEY) || '{}') }
  catch { return {} }
}

// Colore unico per ogni sezione
const TAB_COLORS = {
  '/':          { color: '#6C5CE7', bg: 'rgba(108,92,231,0.12)',  gradient: 'linear-gradient(135deg, #6C5CE7, #A29BFE)' },
  '/calendar':  { color: '#0984E3', bg: 'rgba(9,132,227,0.12)',   gradient: 'linear-gradient(135deg, #0984E3, #74B9FF)' },
  '/tasks':     { color: '#00B894', bg: 'rgba(0,184,148,0.12)',   gradient: 'linear-gradient(135deg, #00B894, #55EFC4)' },
  '/dispensa':  { color: '#E17055', bg: 'rgba(225,112,85,0.12)',  gradient: 'linear-gradient(135deg, #E17055, #FDCB6E)' },
  '/expenses':  { color: '#FDCB6E', bg: 'rgba(253,203,110,0.15)', gradient: 'linear-gradient(135deg, #F39C12, #FDCB6E)' },
}

export default function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const { currentMember, familyId } = useAuthStore()
  const { isOpen: keyboardOpen } = useKeyboard()

  const accessLevel = currentMember?.access_level || 'view_only'
  const tabs = NAV_TABS[accessLevel] || NAV_TABS.view_only

  // ── Last-visited tracking ──
  const [lastVisited, setLastVisited] = useState(readLastVisited)

  // Determine which tab path is currently active
  const activePath = tabs.find((t) =>
    t.path === '/'
      ? location.pathname === '/' || location.pathname === '/dashboard'
      : location.pathname.startsWith(t.path)
  )?.path || null

  // When user visits a tab, save the timestamp
  useEffect(() => {
    if (!activePath) return
    const now = new Date().toISOString()
    setLastVisited((prev) => {
      const updated = { ...prev, [activePath]: now }
      localStorage.setItem(LAST_VISITED_KEY, JSON.stringify(updated))
      return updated
    })
  }, [activePath])

  // ── Badge data (single consolidated query) ──
  const expenseLastVisited = lastVisited['/expenses'] || null
  const badges = useBadgeCounts(familyId, expenseLastVisited)

  // Build badge counts per tab path
  const getBadge = useCallback((path) => {
    switch (path) {
      case '/tasks':    return badges.tasks
      case '/calendar': return badges.calendar
      case '/dispensa': return badges.dispensa
      case '/expenses': return badges.expenses
      default:          return 0
    }
  }, [badges])

  // Nascondi la bottom nav quando la tastiera è aperta (specialmente su iOS)
  if (keyboardOpen) return null

  return (
    <nav
      data-tour="nav-bar"
      className="fixed bottom-0 left-0 right-0 z-40"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderTop: '1px solid rgba(0,0,0,0.06)',
        boxShadow: '0 -2px 20px rgba(0,0,0,0.05)',
      }}
    >
      <div className="flex items-center justify-around py-1">
        {tabs.map((tab) => {
          const Icon = ICON_MAP[tab.icon]
          const isActive =
            tab.path === '/'
              ? location.pathname === '/' || location.pathname === '/dashboard'
              : location.pathname.startsWith(tab.path)

          const colors = TAB_COLORS[tab.path] || TAB_COLORS['/']
          const badge = getBadge(tab.path)

          return (
            <button
              key={tab.path}
              type="button"
              onClick={() => { hapticLight(); navigate(tab.path === '/' ? '/dashboard' : tab.path) }}
              className="relative flex flex-col items-center gap-0.5 px-3 py-1.5 transition-all duration-300"
              style={{ minWidth: '60px' }}
              aria-label={tab.label}
              aria-current={isActive ? 'page' : undefined}
            >
              {/* Active indicator bar - colored */}
              {isActive && (
                <div
                  className="absolute -top-[1px] left-1/2 -translate-x-1/2 h-[3px] rounded-b-full"
                  style={{
                    width: '28px',
                    background: colors.gradient,
                  }}
                />
              )}

              {/* Icon container */}
              <div
                className="relative flex items-center justify-center rounded-2xl transition-all duration-300"
                style={{
                  padding: isActive ? '8px 16px' : '6px',
                  background: isActive ? colors.bg : 'transparent',
                  transform: isActive ? 'translateY(-2px)' : 'none',
                }}
              >
                {Icon && (
                  <Icon
                    size={isActive ? 22 : 20}
                    strokeWidth={isActive ? 2.2 : 1.5}
                    style={{
                      color: isActive ? colors.color : '#B2BEC3',
                      transition: 'all 0.3s ease',
                    }}
                  />
                )}

                {/* Notification badge */}
                {badge > 0 && !isActive && (
                  <div
                    className="absolute -top-1 -right-1 flex items-center justify-center rounded-full text-white text-[9px] font-bold"
                    style={{
                      minWidth: '16px',
                      height: '16px',
                      padding: '0 4px',
                      background: colors.gradient,
                      boxShadow: `0 2px 6px ${colors.color}50`,
                      animation: 'badge-pulse 2s ease-in-out infinite',
                    }}
                  >
                    {badge > 99 ? '99+' : badge}
                  </div>
                )}

                {/* Subtle dot when active tab has notifications */}
                {badge > 0 && isActive && (
                  <div
                    className="absolute -top-0.5 -right-0.5 rounded-full"
                    style={{
                      width: '6px',
                      height: '6px',
                      background: colors.color,
                      boxShadow: `0 0 6px ${colors.color}60`,
                    }}
                  />
                )}
              </div>

              <span
                className="text-[10px] transition-all duration-300"
                style={{
                  color: isActive ? colors.color : '#B2BEC3',
                  fontWeight: isActive ? 700 : 400,
                  transform: isActive ? 'translateY(-1px)' : 'none',
                }}
              >
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>

      {/* Badge pulse animation */}
      <style>{`
        @keyframes badge-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
      `}</style>
    </nav>
  )
}
