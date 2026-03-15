/**
 * WizardStep7 — Riepilogo finale prima della creazione.
 * Mostra tutti i dati raccolti in modo chiaro e permette di confermare o tornare indietro.
 */
import { CheckCircle, Users, Shield, Cloud, CloudOff, Lock } from 'lucide-react'

const ACCESS_LABELS = {
  full: 'Completo',
  calendar_tasks: 'Intermedio',
  basic: 'Base',
  view_only: 'Solo lettura',
}

const ACCESS_COLORS = {
  full: '#6C5CE7',
  calendar_tasks: '#00B894',
  basic: '#F9CA24',
  view_only: '#FF6B6B',
}

export default function WizardStep7({ data, onNext, onBack, saving }) {
  const permissions = data.permissions || []

  const adultsCount = data.adults?.length || 0
  const childrenCount = data.hasChildren ? data.children?.length || 0 : 0
  const totalMembers = adultsCount + childrenCount

  const roleEmoji = (role) => {
    if (role === 'parent') return '👨'
    if (role === 'elder') return '👴'
    return '👧'
  }

  const roleLabel = (role) => {
    if (role === 'parent') return 'Genitore'
    if (role === 'elder') return 'Nonno/a'
    return 'Figlio/a'
  }

  return (
    <div className="flex flex-col px-6 py-6">
      {/* Header */}
      <div className="flex flex-col items-center mb-5">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 mb-3">
          <CheckCircle size={24} className="text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 text-center">Tutto pronto!</h2>
        <p className="text-sm text-gray-500 text-center mt-1">
          Controlla il riepilogo e conferma per creare la tua famiglia.
        </p>
      </div>

      <div className="flex flex-col gap-3 max-h-[55vh] overflow-y-auto">
        {/* Family info */}
        <div className="rounded-xl border border-gray-100 bg-white p-3.5 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Users size={16} className="text-violet-500" />
            <h3 className="text-sm font-semibold text-gray-800">
              Famiglia ({totalMembers} {totalMembers === 1 ? 'membro' : 'membri'})
            </h3>
          </div>

          <div className="flex flex-col gap-1.5">
            {permissions.map((m, i) => (
              <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-gray-50">
                <span className="text-lg">{roleEmoji(m.role)}</span>
                <span className="text-sm text-gray-700 flex-1">{m.name}</span>
                <span className="text-xs text-gray-400">{roleLabel(m.role)}</span>
                <span
                  className="text-[11px] font-medium px-2 py-0.5 rounded-full text-white"
                  style={{ backgroundColor: ACCESS_COLORS[m.accessLevel] || '#6C5CE7' }}
                >
                  {ACCESS_LABELS[m.accessLevel] || m.accessLevel}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Security */}
        <div className="rounded-xl border border-gray-100 bg-white p-3.5 shadow-sm">
          <div className="flex items-center gap-2 mb-1.5">
            <Lock size={16} className="text-violet-500" />
            <h3 className="text-sm font-semibold text-gray-800">Sicurezza</h3>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between px-2">
              <span className="text-xs text-gray-500">PIN genitori</span>
              <span className="text-xs font-mono text-gray-700">{'•'.repeat(data.parentPin?.length || 4)}</span>
            </div>
            {data.hasChildren && data.children?.length > 0 && (
              <div className="flex items-center justify-between px-2">
                <span className="text-xs text-gray-500">PIN figli</span>
                <span className="text-xs font-mono text-gray-700">{'•'.repeat(data.childPin?.length || 4)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Sync */}
        <div className="rounded-xl border border-gray-100 bg-white p-3.5 shadow-sm">
          <div className="flex items-center gap-2 mb-1.5">
            {data.enableSync ? (
              <Cloud size={16} className="text-violet-500" />
            ) : (
              <CloudOff size={16} className="text-gray-400" />
            )}
            <h3 className="text-sm font-semibold text-gray-800">Sincronizzazione</h3>
          </div>
          <p className="text-xs text-gray-500 px-2">
            {data.enableSync
              ? 'Cloud attivo — i dati verranno sincronizzati tra dispositivi (crittografia AES-256).'
              : 'Solo locale — i dati restano sul dispositivo. Puoi attivare la sync in qualsiasi momento.'}
          </p>
        </div>

        {/* What happens next */}
        <div className="rounded-xl bg-violet-50 p-3.5">
          <p className="text-xs font-semibold text-violet-700 mb-1.5">Cosa succede dopo?</p>
          <ul className="text-xs text-violet-600 space-y-1 pl-1">
            <li>• La famiglia verrà creata con {totalMembers} {totalMembers === 1 ? 'membro' : 'membri'}</li>
            <li>• Verrai portato alla schermata di login</li>
            <li>• Seleziona il tuo nome e inserisci il PIN per entrare</li>
            {data.enableSync && <li>• La sync cloud verrà attivata automaticamente</li>}
          </ul>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex gap-3 mt-5">
        <button
          type="button"
          onClick={onBack}
          disabled={saving}
          className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-600
            hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          ← Indietro
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={saving}
          className="flex-1 rounded-xl bg-green-600 py-3 text-sm font-semibold text-white
            hover:bg-green-700 active:scale-[0.98] transition-all disabled:opacity-60"
        >
          {saving ? 'Creazione...' : 'Crea famiglia ✓'}
        </button>
      </div>
    </div>
  )
}
