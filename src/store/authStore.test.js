/**
 * STEP 2.3 — authStore: Zustand state, actions, getters.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import useAuthStore from './authStore.js'

const parentMember = {
  id: 'p1',
  name: 'Papà',
  role: 'parent',
  access_level: 'full',
  icon: '👨',
  color: '#4A90D9',
}

const elderMember = {
  id: 'e1',
  name: 'Nonno',
  role: 'elder',
  access_level: 'full',
  icon: '👴',
  color: '#8BC34A',
}

const teenChild = {
  id: 'c1',
  name: 'Marco',
  role: 'child',
  access_level: 'calendar_tasks',
  icon: '👧',
  color: '#E91E63',
}

const youngChild = {
  id: 'c2',
  name: 'Sofia',
  role: 'child',
  access_level: 'basic',
  icon: '👧',
  color: '#FF9800',
}

const toddler = {
  id: 'c3',
  name: 'Luca',
  role: 'child',
  access_level: 'view_only',
  icon: '👧',
  color: '#9C27B0',
}

describe('authStore', () => {
  beforeEach(() => {
    // Reset store to initial state
    useAuthStore.getState().fullReset()
  })

  // --- Initial state ---

  it('starts with null familyId, null currentMember, isSetupComplete false', () => {
    const state = useAuthStore.getState()
    expect(state.familyId).toBeNull()
    expect(state.currentMember).toBeNull()
    expect(state.isSetupComplete).toBe(false)
  })

  // --- Actions ---

  it('setFamily sets familyId', () => {
    useAuthStore.getState().setFamily('fam-123')
    expect(useAuthStore.getState().familyId).toBe('fam-123')
  })

  it('setMember sets currentMember', () => {
    useAuthStore.getState().setMember(parentMember)
    expect(useAuthStore.getState().currentMember).toEqual(parentMember)
  })

  it('completeSetup sets isSetupComplete to true', () => {
    useAuthStore.getState().completeSetup()
    expect(useAuthStore.getState().isSetupComplete).toBe(true)
  })

  it('logout clears currentMember but keeps familyId and isSetupComplete', () => {
    useAuthStore.getState().setFamily('fam-123')
    useAuthStore.getState().setMember(parentMember)
    useAuthStore.getState().completeSetup()
    useAuthStore.getState().logout()

    const state = useAuthStore.getState()
    expect(state.currentMember).toBeNull()
    expect(state.familyId).toBe('fam-123')
    expect(state.isSetupComplete).toBe(true)
  })

  it('fullReset wipes all auth state', () => {
    useAuthStore.getState().setFamily('fam-123')
    useAuthStore.getState().setMember(parentMember)
    useAuthStore.getState().completeSetup()
    useAuthStore.getState().fullReset()

    const state = useAuthStore.getState()
    expect(state.familyId).toBeNull()
    expect(state.currentMember).toBeNull()
    expect(state.isSetupComplete).toBe(false)
  })

  // --- Getters: canManageExpenses ---

  it('canManageExpenses returns false when no member logged in', () => {
    expect(useAuthStore.getState().canManageExpenses()).toBe(false)
  })

  it('canManageExpenses returns true for parent (full)', () => {
    useAuthStore.getState().setMember(parentMember)
    expect(useAuthStore.getState().canManageExpenses()).toBe(true)
  })

  it('canManageExpenses returns true for elder (full)', () => {
    useAuthStore.getState().setMember(elderMember)
    expect(useAuthStore.getState().canManageExpenses()).toBe(true)
  })

  it('canManageExpenses returns true for teen (calendar_tasks)', () => {
    useAuthStore.getState().setMember(teenChild)
    expect(useAuthStore.getState().canManageExpenses()).toBe(true)
  })

  it('canManageExpenses returns false for young child (basic)', () => {
    useAuthStore.getState().setMember(youngChild)
    expect(useAuthStore.getState().canManageExpenses()).toBe(false)
  })

  it('canManageExpenses returns false for toddler (view_only)', () => {
    useAuthStore.getState().setMember(toddler)
    expect(useAuthStore.getState().canManageExpenses()).toBe(false)
  })

  // --- Getters: canManageTasks ---

  it('canManageTasks returns false when no member', () => {
    expect(useAuthStore.getState().canManageTasks()).toBe(false)
  })

  it('canManageTasks returns true for full access', () => {
    useAuthStore.getState().setMember(parentMember)
    expect(useAuthStore.getState().canManageTasks()).toBe(true)
  })

  it('canManageTasks returns true for calendar_tasks access', () => {
    useAuthStore.getState().setMember(teenChild)
    expect(useAuthStore.getState().canManageTasks()).toBe(true)
  })

  it('canManageTasks returns false for basic access', () => {
    useAuthStore.getState().setMember(youngChild)
    expect(useAuthStore.getState().canManageTasks()).toBe(false)
  })

  // --- Getters: isParent ---

  it('isParent returns false when no member', () => {
    expect(useAuthStore.getState().isParent()).toBe(false)
  })

  it('isParent returns true for parent role', () => {
    useAuthStore.getState().setMember(parentMember)
    expect(useAuthStore.getState().isParent()).toBe(true)
  })

  it('isParent returns true for elder role', () => {
    useAuthStore.getState().setMember(elderMember)
    expect(useAuthStore.getState().isParent()).toBe(true)
  })

  it('isParent returns false for child role', () => {
    useAuthStore.getState().setMember(teenChild)
    expect(useAuthStore.getState().isParent()).toBe(false)
  })
})
