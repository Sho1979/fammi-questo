/**
 * Auth store — Zustand with localStorage persistence.
 * Manages: familyId, currentMember, isSetupComplete.
 * See 1_MASTER_ARCHITECTURE.md §4 for roles and access levels.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useAuthStore = create(
  persist(
    (set, get) => ({
      // --- State ---
      familyId: null,
      currentMember: null, // { id, name, role, access_level, icon, color }
      isSetupComplete: false,
      ownerName: null, // set during setup for auto-select on login
      sessionPin: null, // in-memory only (excluded from persist) — for encrypted sync key derivation

      // --- Actions ---

      /** Set the active family after setup or login */
      setFamily: (familyId) => set({ familyId }),

      /** Set the currently logged-in member */
      setMember: (member) => set({ currentMember: member }),

      /** Store the PIN in session memory for encrypted sync (never persisted to disk) */
      setSessionPin: (pin) => set({ sessionPin: pin }),

      /** Mark first-time setup as done */
      completeSetup: () => set({ isSetupComplete: true }),

      /** Store the owner's name for auto-select on first login */
      setOwnerName: (name) => set({ ownerName: name }),

      /** Logout current member (back to member-select screen) */
      logout: () => set({ currentMember: null, sessionPin: null }),

      /** Full reset: wipe all auth state (used by "Reset app") */
      fullReset: () =>
        set({
          familyId: null,
          currentMember: null,
          isSetupComplete: false,
          ownerName: null,
          sessionPin: null,
        }),

      // --- Getters (derived from currentMember) ---

      /** Can this member add/edit/delete expenses? (full or calendar_tasks) */
      canManageExpenses: () => {
        const member = get().currentMember
        if (!member) return false
        return member.access_level === 'full' || member.access_level === 'calendar_tasks'
      },

      /** Can this member manage tasks? (full or calendar_tasks) */
      canManageTasks: () => {
        const member = get().currentMember
        if (!member) return false
        return member.access_level === 'full' || member.access_level === 'calendar_tasks'
      },

      /** Is the current member a parent or elder (full access)?
       *  Handles both English and Italian role names. */
      isParent: () => {
        const member = get().currentMember
        if (!member) return false
        return member.role === 'parent' || member.role === 'elder' || member.role === 'genitore'
      },

      /** Is the current member a child? */
      isChild: () => {
        const member = get().currentMember
        if (!member) return false
        return member.role === 'child' || member.role === 'figlio'
      },
    }),
    {
      name: 'fm-auth', // localStorage key
      // Exclude sessionPin from persistence — it must stay in memory only
      partialize: (state) => ({
        familyId: state.familyId,
        currentMember: state.currentMember,
        isSetupComplete: state.isSetupComplete,
        ownerName: state.ownerName,
      }),
    }
  )
)

export default useAuthStore
