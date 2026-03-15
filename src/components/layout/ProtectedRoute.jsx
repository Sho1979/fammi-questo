/**
 * STEP 6.4 — ProtectedRoute.
 * - If !isSetupComplete → redirect /setup
 * - If !currentMember → redirect /login
 * - If requiredAccess and member's access_level not sufficient → redirect /dashboard
 * - Otherwise: render children (Outlet)
 */
import { Navigate, Outlet } from 'react-router-dom'
import useAuthStore from '../../store/authStore.js'

const ACCESS_RANK = {
  view_only: 0,
  basic: 1,
  calendar_tasks: 2,
  full: 3,
}

export default function ProtectedRoute({ requiredAccess }) {
  const isSetupComplete = useAuthStore((s) => s.isSetupComplete)
  const currentMember = useAuthStore((s) => s.currentMember)

  if (!isSetupComplete) {
    return <Navigate to="/setup" replace />
  }

  if (!currentMember) {
    return <Navigate to="/login" replace />
  }

  // Check access level if required
  if (requiredAccess) {
    const memberRank = ACCESS_RANK[currentMember.access_level] ?? 0
    const requiredRank = ACCESS_RANK[requiredAccess] ?? 0
    if (memberRank < requiredRank) {
      return <Navigate to="/dashboard" replace />
    }
  }

  return <Outlet />
}
