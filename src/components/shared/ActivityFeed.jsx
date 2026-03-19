/**
 * ActivityFeed — Shows recent family activity grouped by message context.
 *
 * Queries entityRelations + messageContexts to show:
 * - "Cristian ha creato 3 azioni: portare Viola, comprare latte, ricordare bollo"
 * - "Chiara ha completato: Lavare i piatti"
 * - Individual actions without a message context
 *
 * Uses Tailwind animate-pulse for skeleton and relative time formatting.
 */
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../lib/localDb.js'

const TYPE_EMOJI = {
  calendar: '📅',
  task: '📌',
  expense: '💰',
  shopping: '🛒',
  meal: '🍽️',
  reminder: '🔔',
  note: '📝',
}

function relativeTime(isoString) {
  if (!isoString) return ''
  const diff = Date.now() - new Date(isoString).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'ora'
  if (mins < 60) return `${mins}min fa`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h fa`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'ieri'
  return `${days}g fa`
}

export default function ActivityFeed({ familyId, members, limit = 10 }) {
  const contexts = useLiveQuery(
    async () => {
      if (!familyId) return []
      const all = await db.messageContexts
        .where('family_id')
        .equals(familyId)
        .and(c => !c._deleted && c.status === 'confirmed')
        .toArray()
      // Sort newest-first and limit in JS (Dexie .reverse() doesn't affect .sortBy())
      return all
        .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
        .slice(0, limit)
    },
    [familyId, limit],
    []
  )

  const recentContexts = contexts || []

  if (recentContexts.length === 0) {
    return (
      <div className="text-center text-sm text-gray-400 py-6">
        Nessuna attivita' recente
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {recentContexts.map(ctx => {
        const member = members?.find(m => m.id === ctx.created_by_member_id)
        const memberName = member?.name || 'Qualcuno'
        const memberIcon = member?.icon || '👤'

        return (
          <div
            key={ctx.id}
            className="flex items-start gap-3 px-3 py-2.5 rounded-xl bg-white/60 border border-gray-100"
          >
            <span className="text-lg flex-shrink-0 mt-0.5">{memberIcon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium text-sm text-gray-800">
                  {memberName}
                </span>
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {relativeTime(ctx.created_at)}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5 truncate">
                {ctx.action_count > 1
                  ? `${ctx.action_count} azioni create`
                  : ctx.raw_text?.slice(0, 60) || '1 azione creata'
                }
                {ctx.source_type === 'voice' && ' 🎤'}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
