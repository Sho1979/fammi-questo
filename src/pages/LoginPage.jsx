/**
 * STEP 5.3 — LoginPage: MemberSelect → PinLogin flow.
 * Reads members from Dexie, handles login via useAuth.
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/localDb.js'
import useAuthStore from '../store/authStore.js'
import { login } from '../hooks/useAuth.js'
import { isSyncEnabled } from '../lib/supabase.js'
import { joinFamilyByCode } from '../lib/sync.js'
import { LoadingSpinner } from '../components/shared/index.js'
import MemberSelect from '../components/auth/MemberSelect.jsx'
import PinLogin from '../components/auth/PinLogin.jsx'
import { UserPlus } from 'lucide-react'

export default function LoginPage() {
  const navigate = useNavigate()
  const familyId = useAuthStore((s) => s.familyId)
  const setFamily = useAuthStore((s) => s.setFamily)
  const ownerName = useAuthStore((s) => s.ownerName)
  const [selectedMemberId, setSelectedMemberId] = useState(null)
  const [showJoin, setShowJoin] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState('')

  // Live query: all non-deleted members for this family
  const members = useLiveQuery(
    () =>
      familyId
        ? db.members
            .where('family_id')
            .equals(familyId)
            .filter((m) => !m._deleted)
            .toArray()
        : [],
    [familyId],
    []
  )

  // Auto-select owner after fresh setup
  useEffect(() => {
    if (ownerName && members.length > 0 && !selectedMemberId) {
      const owner = members.find(
        (m) => m.name.toLowerCase() === ownerName.toLowerCase()
      )
      if (owner) setSelectedMemberId(owner.id)
    }
  }, [ownerName, members, selectedMemberId])

  const selectedMember = members.find((m) => m.id === selectedMemberId)

  const handleLogin = async (pin) => {
    const success = await login(selectedMemberId, pin)
    if (success) {
      navigate('/dashboard', { replace: true })
      return true
    }
    return false
  }

  if (!familyId) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner size={32} />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {showJoin ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
          <UserPlus size={40} className="text-violet-500" />
          <h2 className="text-xl font-bold text-gray-900">Unisciti a una famiglia</h2>
          <p className="text-sm text-gray-500 text-center">
            Inserisci il codice invito che hai ricevuto
          </p>
          <input
            type="text"
            value={joinCode}
            onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setJoinError('') }}
            placeholder="Es: ABC123"
            maxLength={6}
            className="w-48 rounded-xl border border-gray-200 px-4 py-3 text-center text-xl font-mono
              font-bold tracking-widest focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
            autoFocus
          />
          {joinError && <p className="text-xs text-red-500">{joinError}</p>}
          <div className="flex gap-3 w-full max-w-xs">
            <button type="button" onClick={() => setShowJoin(false)}
              className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-600">
              Indietro
            </button>
            <button
              type="button"
              disabled={joinCode.length < 6 || joining}
              onClick={async () => {
                setJoining(true)
                setJoinError('')
                try {
                  const fam = await joinFamilyByCode(joinCode)
                  setFamily(fam.id)
                  setShowJoin(false) // torna a member select con la nuova famiglia
                } catch (err) {
                  setJoinError(err.message || 'Codice non valido')
                }
                setJoining(false)
              }}
              className="flex-1 rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white
                disabled:opacity-50 transition-all"
            >
              {joining ? 'Carico...' : 'Unisciti'}
            </button>
          </div>
        </div>
      ) : selectedMember ? (
        <PinLogin
          member={selectedMember}
          onLogin={handleLogin}
          onBack={() => setSelectedMemberId(null)}
        />
      ) : (
        <>
          <MemberSelect
            members={members}
            onSelect={(id) => setSelectedMemberId(id)}
          />
          {isSyncEnabled() && (
            <div className="flex justify-center pb-8">
              <button
                type="button"
                onClick={() => setShowJoin(true)}
                className="flex items-center gap-2 text-sm text-violet-600 font-medium hover:underline"
              >
                <UserPlus size={16} /> Unisciti con codice invito
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
