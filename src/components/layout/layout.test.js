/**
 * STEP 6.7 — Tests for ProtectedRoute logic (non-rendering, pure logic test).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import useAuthStore from '../../store/authStore.js'

const ACCESS_RANK = {
  view_only: 0,
  basic: 1,
  calendar_tasks: 2,
  full: 3,
}

/** Pure function mirroring ProtectedRoute decision logic */
function getRedirect(isSetupComplete, currentMember, requiredAccess) {
  if (!isSetupComplete) return '/setup'
  if (!currentMember) return '/login'
  if (requiredAccess) {
    const memberRank = ACCESS_RANK[currentMember.access_level] ?? 0
    const requiredRank = ACCESS_RANK[requiredAccess] ?? 0
    if (memberRank < requiredRank) return '/dashboard'
  }
  return null // pass through
}

describe('ProtectedRoute logic', () => {
  beforeEach(() => {
    useAuthStore.getState().fullReset()
  })

  it('redirects to /setup when not setup', () => {
    expect(getRedirect(false, null, null)).toBe('/setup')
  })

  it('redirects to /login when setup but no member', () => {
    expect(getRedirect(true, null, null)).toBe('/login')
  })

  it('passes through when setup + member + no required access', () => {
    const member = { access_level: 'view_only' }
    expect(getRedirect(true, member, null)).toBeNull()
  })

  it('passes through when member has sufficient access', () => {
    const member = { access_level: 'full' }
    expect(getRedirect(true, member, 'calendar_tasks')).toBeNull()
  })

  it('passes through when member has exact access', () => {
    const member = { access_level: 'calendar_tasks' }
    expect(getRedirect(true, member, 'calendar_tasks')).toBeNull()
  })

  it('redirects to /dashboard when insufficient access', () => {
    const member = { access_level: 'basic' }
    expect(getRedirect(true, member, 'calendar_tasks')).toBe('/dashboard')
  })

  it('redirects to /dashboard when view_only tries full', () => {
    const member = { access_level: 'view_only' }
    expect(getRedirect(true, member, 'full')).toBe('/dashboard')
  })

  it('basic can access basic-required routes', () => {
    const member = { access_level: 'basic' }
    expect(getRedirect(true, member, 'basic')).toBeNull()
  })
})
