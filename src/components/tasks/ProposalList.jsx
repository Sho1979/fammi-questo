/**
 * ProposalList — Redesigned: pending task proposals with visual flair.
 */
import { Check, X, Star, Sparkles } from 'lucide-react'
import { TASK_CATEGORIES } from '../../lib/constants.js'

export default function ProposalList({ proposals, members, onApprove, onReject }) {
  if (!proposals.length) return null

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3" style={{ background: 'linear-gradient(135deg, #FEF3C7, #FBBF2420)' }}>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={15} className="text-amber-500" />
          <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">
            Proposte in attesa
          </span>
          <span className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}>
            {proposals.length}
          </span>
        </div>
        <div className="flex flex-col gap-2">
          {proposals.map((task) => {
            const cat = TASK_CATEGORIES.find((c) => c.id === task.category)
            const creator = members.find((m) => m.id === task.created_by)
            return (
              <div key={task.id}
                className="flex items-center gap-3 rounded-xl p-3 transition-all"
                style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(251,191,36,0.2)' }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">{cat?.icon || '📌'}</span>
                    <h4 className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                      {task.title}
                    </h4>
                    {task.points > 0 && (
                      <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-100 px-1.5 py-0.5
                        text-[10px] text-amber-700 font-bold">
                        <Star size={9} fill="currentColor" /> {task.points}
                      </span>
                    )}
                  </div>
                  {creator && (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {creator.icon || '👤'} {creator.name} dice: "L'ho fatto!"
                    </p>
                  )}
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => onApprove(task.id)}
                    className="rounded-xl p-2.5 text-white transition-all active:scale-90"
                    style={{ background: 'linear-gradient(135deg, #22C55E, #16A34A)', boxShadow: '0 2px 8px rgba(34,197,94,0.3)' }}
                    aria-label="Approva"
                  >
                    <Check size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onReject(task.id)}
                    className="rounded-xl p-2.5 bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-500 transition-all active:scale-90"
                    aria-label="Rifiuta"
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
