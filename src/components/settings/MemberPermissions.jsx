/**
 * MemberPermissions — Edit access_level per family member.
 * Only rendered for parent/elder users.
 * Changes saved immediately via updateRecord + toast feedback.
 */
import { useState } from 'react'
import { Shield } from 'lucide-react'
import { PersonBadge } from '../shared/index.js'
import { ACCESS_LEVEL_LABELS } from '../../lib/constants.js'
import { updateRecord } from '../../lib/crud.js'
import { toast } from 'sonner'

export default function MemberPermissions({ members, currentMember, familyId }) {
  const [saving, setSaving] = useState(null)

  const handleChangeLevel = async (member, newLevel) => {
    // Guard: parents cannot demote themselves
    if (member.id === currentMember.id && newLevel !== 'full') {
      toast.error('Non puoi ridurre i tuoi permessi')
      return
    }

    setSaving(member.id)
    try {
      await updateRecord('members', member.id, { access_level: newLevel })
      toast.success(`Permessi di ${member.name} aggiornati`)
    } catch {
      toast.error('Errore nel salvataggio')
    }
    setSaving(null)
  }

  if (!members || members.length === 0) return null

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm border border-gray-100">
      <div className="flex items-center gap-2 mb-3">
        <Shield size={18} className="text-violet-500" />
        <h3 className="text-sm font-semibold text-gray-800">Permessi membri</h3>
      </div>
      <p className="text-xs text-gray-400 mb-3">
        Gestisci il livello di accesso di ogni membro della famiglia.
      </p>
      <div className="flex flex-col gap-3">
        {members.map((m) => {
          const isSelf = m.id === currentMember.id
          return (
            <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
              <PersonBadge member={m} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">
                  {m.name} {isSelf && <span className="text-[10px] text-gray-400">(tu)</span>}
                </p>
                <p className="text-[10px] text-gray-400 capitalize">{m.role}</p>
              </div>
              <select
                value={m.access_level || 'view_only'}
                onChange={(e) => handleChangeLevel(m, e.target.value)}
                disabled={saving === m.id}
                aria-label={`Permessi di ${m.name}`}
                className="text-xs rounded-lg border border-gray-200 px-2 py-1.5
                  focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100
                  bg-white disabled:opacity-50"
              >
                {ACCESS_LEVEL_LABELS.map((level) => (
                  <option
                    key={level.id}
                    value={level.id}
                    disabled={isSelf && level.id !== 'full'}
                  >
                    {level.icon} {level.label}
                  </option>
                ))}
              </select>
            </div>
          )
        })}
      </div>
    </div>
  )
}
