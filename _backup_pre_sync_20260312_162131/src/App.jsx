/**
 * STEP 6.5 — App: BrowserRouter with all routes.
 * Root redirect: !setup → /setup, !member → /login, else /dashboard.
 *
 * PERFORMANCE: tutte le pagine sono lazy-loaded tranne SetupPage e LoginPage
 * (necessarie subito al primo avvio). Questo riduce il bundle iniziale
 * e carica ogni pagina on-demand quando l'utente naviga.
 */
import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import useAuthStore from './store/authStore.js'
import { initNativeNotifications } from './lib/nativeNotifications.js'

import AppShell from './components/layout/AppShell.jsx'
import ProtectedRoute from './components/layout/ProtectedRoute.jsx'

// ─── Eager: servono subito al primo avvio ─────────────────────
import SetupPage from './pages/SetupPage.jsx'
import LoginPage from './pages/LoginPage.jsx'

// ─── Lazy: caricate on-demand alla navigazione ────────────────
const DashboardPage = lazy(() => import('./pages/DashboardPage.jsx'))
const SpesePage = lazy(() => import('./pages/SpesePage.jsx'))
const SettingsPage = lazy(() => import('./pages/SettingsPage.jsx'))
const CalendarPage = lazy(() => import('./pages/CalendarPage.jsx'))
const TasksPage = lazy(() => import('./pages/TasksPage.jsx'))
const RewardsPage = lazy(() => import('./pages/RewardsPage.jsx'))
const MealsPage = lazy(() => import('./pages/MealsPage.jsx'))
const DispensaPage = lazy(() => import('./pages/DispensaPage.jsx'))
const BrainDebugPage = lazy(() => import('./pages/BrainDebugPage.jsx'))

// ─── Route orfane: redirect a pagine unificate con sub-tab ────
// StatsPage e BudgetPage → già embed in SpesePage (sub-tab stats/budget)
// ShoppingPage e InventoryPage → già embed in DispensaPage (sub-tab)

// ─── Fallback durante il lazy load ────────────────────────────
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-gray-300 border-t-violet-500 rounded-full animate-spin" />
    </div>
  )
}

function RootRedirect() {
  const isSetupComplete = useAuthStore((s) => s.isSetupComplete)
  const currentMember = useAuthStore((s) => s.currentMember)

  if (!isSetupComplete) return <Navigate to="/setup" replace />
  if (!currentMember) return <Navigate to="/login" replace />
  return <Navigate to="/dashboard" replace />
}

export default function App() {
  // Init native notifications (noop su web, attivo su Android/iOS)
  useEffect(() => { initNativeNotifications() }, [])

  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public routes */}
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/login" element={<LoginPage />} />

          {/* Protected routes inside AppShell */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/brain-debug" element={<BrainDebugPage />} />
            </Route>
          </Route>

          {/* Protected routes requiring 'full' or 'calendar_tasks' access */}
          <Route element={<ProtectedRoute requiredAccess="calendar_tasks" />}>
            <Route element={<AppShell />}>
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/tasks" element={<TasksPage />} />
              <Route path="/rewards" element={<RewardsPage />} />
              <Route path="/expenses" element={<SpesePage />} />
              <Route path="/stats" element={<Navigate to="/expenses" replace />} />
              <Route path="/budget" element={<Navigate to="/expenses" replace />} />
              <Route path="/dispensa" element={<DispensaPage />} />
              <Route path="/shopping" element={<Navigate to="/dispensa" replace />} />
              <Route path="/meals" element={<MealsPage />} />
              <Route path="/inventory" element={<Navigate to="/dispensa" replace />} />
            </Route>
          </Route>

          {/* Root + fallback */}
          <Route path="/" element={<RootRedirect />} />
          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
