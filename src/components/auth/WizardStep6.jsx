/**
 * WizardStep6 — Sync cloud (opzionale).
 * Presenta la possibilità di attivare la sincronizzazione cloud
 * crittografata tramite Supabase. L'utente può scegliere di configurarla
 * subito o saltarla (local-first, potrà sempre attivarla dopo).
 */
import { useState } from 'react'
import { Cloud, CloudOff, Shield, Smartphone, Lock } from 'lucide-react'
import { isSyncEnabled } from '../../lib/supabase.js'

export default function WizardStep6({ data, onUpdate, onNext, onBack }) {
  const syncAvailable = isSyncEnabled()
  const [enableSync, setEnableSync] = useState(data.enableSync ?? false)

  const handleToggle = (val) => {
    setEnableSync(val)
    onUpdate({ enableSync: val })
  }

  return (
    <div className="flex flex-col px-6 py-6">
      {/* Header */}
      <div className="flex flex-col items-center mb-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-100 mb-3">
          <Cloud size={24} className="text-violet-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 text-center">Sincronizzazione</h2>
        <p className="text-sm text-gray-500 text-center mt-1">
          Condividi i dati tra più dispositivi in modo sicuro.
        </p>
      </div>

      {/* Local-first explanation */}
      <div className="rounded-xl bg-teal-50 p-4 mb-4">
        <div className="flex items-start gap-3">
          <Smartphone size={20} className="text-teal-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-teal-800">I tuoi dati restano sul dispositivo</p>
            <p className="text-xs text-teal-600 mt-1">
              Fammi Questo è local-first: tutti i dati sono salvati sul tuo telefono.
              La sync cloud è opzionale e serve solo per condividere con altri dispositivi della famiglia.
            </p>
          </div>
        </div>
      </div>

      {/* Encryption info */}
      <div className="rounded-xl bg-violet-50 p-4 mb-6">
        <div className="flex items-start gap-3">
          <Lock size={20} className="text-violet-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-violet-800">Crittografia end-to-end</p>
            <p className="text-xs text-violet-600 mt-1">
              Se attivi la sync, i dati sensibili vengono crittografati con AES-256 prima dell'invio.
              Solo chi ha il PIN della famiglia può leggerli.
            </p>
          </div>
        </div>
      </div>

      {/* Toggle */}
      {syncAvailable ? (
        <div className="flex gap-3 mb-4">
          <button
            type="button"
            onClick={() => handleToggle(true)}
            className={`flex-1 flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all
              ${enableSync
                ? 'border-violet-500 bg-violet-50 shadow-md'
                : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
          >
            <Cloud size={28} className={enableSync ? 'text-violet-600' : 'text-gray-400'} />
            <span className={`text-sm font-semibold ${enableSync ? 'text-violet-700' : 'text-gray-600'}`}>
              Attiva sync
            </span>
            <span className="text-[11px] text-gray-400">Condividi tra dispositivi</span>
          </button>

          <button
            type="button"
            onClick={() => handleToggle(false)}
            className={`flex-1 flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all
              ${!enableSync
                ? 'border-violet-500 bg-violet-50 shadow-md'
                : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
          >
            <CloudOff size={28} className={!enableSync ? 'text-violet-600' : 'text-gray-400'} />
            <span className={`text-sm font-semibold ${!enableSync ? 'text-violet-700' : 'text-gray-600'}`}>
              Solo locale
            </span>
            <span className="text-[11px] text-gray-400">Nessun dato nel cloud</span>
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 mb-4">
          <div className="flex items-center gap-3">
            <CloudOff size={20} className="text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-600">Sync non disponibile</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Configura Supabase nel file .env per abilitare la sincronizzazione cloud.
                Puoi farlo in qualsiasi momento.
              </p>
            </div>
          </div>
        </div>
      )}

      {enableSync && syncAvailable && (
        <p className="text-xs text-gray-400 text-center mb-2">
          Dopo il setup potrai invitare altri dispositivi dalla sezione Impostazioni.
        </p>
      )}

      {/* Navigation */}
      <div className="flex gap-3 mt-auto pt-4">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-600
            hover:bg-gray-50 transition-colors"
        >
          ← Indietro
        </button>
        <button
          type="button"
          onClick={onNext}
          className="flex-1 rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white
            hover:bg-violet-700 active:scale-[0.98] transition-all"
        >
          Avanti →
        </button>
      </div>
    </div>
  )
}
