/**
 * AppShell — Header + scrollable main + BottomNav + Brain system.
 *
 * Il Brain è gestito qui perché:
 * 1. useBrain() vive a livello AppShell (accessibile da ogni pagina)
 * 2. VoiceButton floating è sempre visibile
 * 3. BrainSheet modale appare sopra qualsiasi pagina
 * 4. BrainInput è passato come context alle pagine che lo vogliono
 */
import { createContext, useContext, useEffect, lazy, Suspense } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Header from './Header.jsx'
import BottomNav from './BottomNav.jsx'
import VoiceButton from '../voice/VoiceButton.jsx'
import NotifBanner from '../notifications/NotifBanner.jsx'
import ErrorBoundary from '../shared/ErrorBoundary.jsx'
import useBrain from '../../hooks/useBrain.js'
import useKeyboard from '../../hooks/useKeyboard.js'
import { trackEvent } from '../../lib/telemetry.js'
import { isIOS } from '../../lib/platform.js'

// Lazy: BrainSheet (375 righe + BrainPreview 279 righe) caricato solo quando serve
const BrainSheet = lazy(() => import('../brain/BrainSheet.jsx'))

// Context per passare useBrain alle pagine figlie (es. Dashboard)
export const BrainContext = createContext(null)
export const useBrainContext = () => useContext(BrainContext)

// Route → telemetry event name
const PAGE_EVENT_MAP = {
  '/dashboard': 'page_dashboard',
  '/calendar': 'page_calendar',
  '/tasks': 'page_tasks',
  '/expenses': 'page_expenses',
  '/dispensa': 'page_dispensa',
  '/meals': 'page_meals',
  '/rewards': 'page_rewards',
  '/settings': 'page_settings',
}

export default function AppShell() {
  const brain = useBrain()
  const location = useLocation()
  const { isOpen: keyboardOpen } = useKeyboard()

  // Traccia page view per telemetria locale
  useEffect(() => {
    const event = PAGE_EVENT_MAP[location.pathname]
    if (event) trackEvent(event)
  }, [location.pathname])

  return (
    <ErrorBoundary>
    <BrainContext.Provider value={brain}>
      <div className={`flex flex-col bg-gray-50 ${isIOS ? 'h-screen overflow-hidden' : 'min-h-screen'}`}>
        <Header />
        <NotifBanner />
        <main className={`flex-1 overflow-y-auto scroll-container ${isIOS ? 'pb-24' : 'pb-20'}`}
          style={{
            // iOS: momentum scrolling + contenimento overscroll
            WebkitOverflowScrolling: 'touch',
            overscrollBehaviorY: 'contain',
          }}
        >
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>

        {/* Floating voice button */}
        <VoiceButton
          phase={brain.phase}
          onPress={brain.startVoice}
          speechAvailable={brain.speechAvailable}
        />

        {/* Brain bottom sheet — lazy loaded, renderizzato solo quando attivo */}
        {brain.phase !== 'idle' && (
          <Suspense fallback={
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
              <div className="w-10 h-10 rounded-full border-3 border-violet-200 border-t-violet-600 animate-spin" />
            </div>
          }>
            <BrainSheet
              phase={brain.phase}
              transcript={brain.transcript}
              result={brain.result}
              executionLog={brain.executionLog}
              error={brain.error}
              members={brain.members}
              confirmActions={brain.confirmActions}
              cancel={brain.cancel}
              aiCallsRemaining={brain.aiCallsRemaining}
            />
          </Suspense>
        )}

        <BottomNav />
      </div>
    </BrainContext.Provider>
    </ErrorBoundary>
  )
}
