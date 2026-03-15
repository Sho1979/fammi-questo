/**
 * STEP 13.2 — RewardsPage: Weekly leaderboard + €20 prize.
 * Modeled after api.php rewards_leaderboard:
 * - Weekly prize: €20 to whoever completes the most tasks
 * - Parimerito: if tie, split equally
 * - Only children (figlio/child) compete
 * - Tracks: assignedWeek, completedWeek, completedAll
 */
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/localDb.js'
import useAuthStore from '../store/authStore.js'
import { useWeeklyLeaderboard, useCompletedTasksStats } from '../hooks/useTasks.js'
import { awardBonus, deductPoints } from '../hooks/useRewards.js'
import { validateBonusPoints } from '../lib/validate.js'
import { Modal, Toast } from '../components/shared/index.js'
import { Trophy, Star, Plus, Minus, Info, Award } from 'lucide-react'

const MEDAL = ['🥇', '🥈', '🥉']
const MEDAL_COLORS = ['text-amber-500', 'text-gray-400', 'text-orange-400']

export default function RewardsPage() {
  const { familyId, currentMember } = useAuthStore()
  const isParent = currentMember?.role === 'parent' || currentMember?.role === 'elder' ||
    currentMember?.role === 'genitore'

  const weekData = useWeeklyLeaderboard(familyId)
  const { leaderboard, weekLabel, weeklyPrize, isParimerito, weeklyPrizeEach, topScore } = weekData

  const members = useLiveQuery(
    () => familyId
      ? db.members.where('family_id').equals(familyId).and((m) => !m._deleted).toArray()
      : [],
    [familyId],
    []
  )

  const [showBonus, setShowBonus] = useState(false)
  const [bonusMemberId, setBonusMemberId] = useState('')
  const [bonusPoints, setBonusPoints] = useState('')
  const [bonusReason, setBonusReason] = useState('')
  const [isDeduct, setIsDeduct] = useState(false)
  const [showInfo, setShowInfo] = useState(false)
  const [toast, setToast] = useState(null)
  const [bonusError, setBonusError] = useState('')

  const handleAward = async () => {
    const validationError = validateBonusPoints({ memberId: bonusMemberId, points: bonusPoints })
    if (validationError) {
      setBonusError(validationError)
      return
    }
    setBonusError('')
    const pts = parseInt(bonusPoints, 10)
    if (isDeduct) {
      await deductPoints(bonusMemberId, pts, bonusReason)
      setToast({ message: `${pts} punti detratti` })
    } else {
      await awardBonus(bonusMemberId, pts, bonusReason)
      setToast({ message: `${pts} punti assegnati!` })
    }
    setShowBonus(false)
    setBonusPoints('')
    setBonusReason('')
    setBonusError('')
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy size={22} className="text-amber-500" />
          <h2 className="text-lg font-bold text-gray-900">Classifica</h2>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowInfo(true)}
            className="rounded-full p-2 text-gray-400 hover:bg-gray-100 transition-colors"
            aria-label="Info"
          >
            <Info size={18} />
          </button>
          {isParent && (
            <button
              type="button"
              onClick={() => { setShowBonus(true); setIsDeduct(false); setBonusError('') }}
              className="flex items-center gap-1 rounded-xl bg-amber-500 px-3 py-2 text-xs font-semibold text-white
                shadow-md hover:bg-amber-600 transition-all"
            >
              <Star size={14} /> Bonus
            </button>
          )}
        </div>
      </div>

      {/* Weekly Prize Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-amber-100 uppercase tracking-wide">Premio settimanale</p>
            <p className="text-3xl font-extrabold text-white mt-1">{weeklyPrize}€</p>
          </div>
          <Award size={40} className="text-amber-200 opacity-60" />
        </div>
        <p className="text-xs text-amber-100 mt-2">
          {weekLabel}
          {isParimerito && topScore > 0 && ` — Parimerito! ${weeklyPrizeEach}€ ciascuno`}
        </p>
      </div>

      {/* Leaderboard */}
      <div className="rounded-2xl bg-white p-4 shadow-sm border border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Questa settimana
        </h3>
        {leaderboard.length > 0 ? (
          <div className="flex flex-col gap-3">
            {leaderboard.map((entry, i) => {
              const member = members.find((m) => m.id === entry.member_id)
              if (!member) return null

              const isWinning = entry.completedWeek > 0 && entry.completedWeek === topScore
              const progressPct = topScore > 0
                ? Math.round((entry.completedWeek / topScore) * 100)
                : 0

              return (
                <div
                  key={entry.member_id}
                  className={`rounded-xl p-3 transition-all
                    ${isWinning ? 'bg-amber-50 border-2 border-amber-300' : 'bg-gray-50 border border-gray-100'}`}
                >
                  <div className="flex items-center gap-3">
                    {/* Rank */}
                    <span className="text-xl w-8 text-center">
                      {i < 3 ? MEDAL[i] : `${i + 1}°`}
                    </span>

                    {/* Avatar + name */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">
                        {member.avatar || member.icon || '👤'} {entry.name}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                        <span>{entry.completedWeek} / {entry.assignedWeek} questa sett.</span>
                        <span className="text-gray-300">|</span>
                        <span>{entry.completedAll} totali</span>
                      </div>
                    </div>

                    {/* Prize indicator for winner */}
                    {isWinning && (
                      <div className="flex flex-col items-center">
                        <span className="text-lg font-bold text-amber-600">
                          {isParimerito ? weeklyPrizeEach : weeklyPrize}€
                        </span>
                        <span className="text-[10px] text-amber-500 font-medium">PREMIO</span>
                      </div>
                    )}
                  </div>

                  {/* Progress bar */}
                  {topScore > 0 && (
                    <div className="mt-2 h-2 rounded-full bg-gray-200 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500
                          ${isWinning ? 'bg-amber-400' : 'bg-violet-300'}`}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <Trophy size={32} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-400">Completa i task per vincere il premio!</p>
          </div>
        )}
      </div>

      {/* How it works (info modal) */}
      <Modal isOpen={showInfo} onClose={() => setShowInfo(false)} title="Come funziona">
        <div className="p-4 flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <span className="text-lg">🏆</span>
            <div>
              <p className="text-sm font-semibold text-gray-900">Premio settimanale: {weeklyPrize}€</p>
              <p className="text-xs text-gray-500">Chi completa più task nella settimana vince il premio.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-lg">🤝</span>
            <div>
              <p className="text-sm font-semibold text-gray-900">Parimerito</p>
              <p className="text-xs text-gray-500">In caso di pareggio il premio si divide equamente.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-lg">💡</span>
            <div>
              <p className="text-sm font-semibold text-gray-900">Proposte</p>
              <p className="text-xs text-gray-500">
                I ragazzi possono proporre task che hanno GIÀ FATTO. Un genitore deve confermare.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-lg">📊</span>
            <div>
              <p className="text-sm font-semibold text-gray-900">Conteggio</p>
              <p className="text-xs text-gray-500">
                Conta chi ha COMPLETATO il task (doneBy), non solo chi era assegnato.
                I task assegnati a &quot;Tutti&quot; li prende chi li fa per primo.
              </p>
            </div>
          </div>
        </div>
      </Modal>

      {/* Bonus/Penalty modal (parent only) */}
      <Modal
        isOpen={showBonus}
        onClose={() => setShowBonus(false)}
        title={isDeduct ? 'Togli punti' : 'Assegna bonus'}
      >
        <div className="flex flex-col gap-4 p-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIsDeduct(false)}
              className={`flex-1 rounded-xl py-2 text-sm font-semibold text-center transition-all
                ${!isDeduct ? 'bg-green-500 text-white shadow-md' : 'bg-gray-100 text-gray-500'}`}
            >
              <Plus size={14} className="inline mr-1" /> Bonus
            </button>
            <button
              type="button"
              onClick={() => setIsDeduct(true)}
              className={`flex-1 rounded-xl py-2 text-sm font-semibold text-center transition-all
                ${isDeduct ? 'bg-red-500 text-white shadow-md' : 'bg-gray-100 text-gray-500'}`}
            >
              <Minus size={14} className="inline mr-1" /> Penalità
            </button>
          </div>

          <select
            value={bonusMemberId}
            onChange={(e) => setBonusMemberId(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm
              focus:border-violet-400 focus:outline-none"
          >
            <option value="">Seleziona membro...</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.avatar || m.icon || '👤'} {m.name}</option>
            ))}
          </select>

          <input
            type="text"
            inputMode="numeric"
            value={bonusPoints}
            onChange={(e) => setBonusPoints(e.target.value)}
            placeholder="Punti"
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm
              focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
          />

          <input
            type="text"
            value={bonusReason}
            onChange={(e) => setBonusReason(e.target.value)}
            placeholder="Motivo (opzionale)"
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm
              focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
          />

          {bonusError && <p className="text-sm font-medium text-red-500">{bonusError}</p>}

          <button
            type="button"
            onClick={handleAward}
            disabled={!bonusMemberId || !bonusPoints}
            className={`w-full rounded-xl py-2.5 text-sm font-semibold text-white shadow-md transition-all
              disabled:opacity-50
              ${isDeduct ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}
          >
            {isDeduct ? 'Togli punti' : 'Assegna bonus'}
          </button>
        </div>
      </Modal>

      {toast && <Toast message={toast.message} onClose={() => setToast(null)} />}
    </div>
  )
}
