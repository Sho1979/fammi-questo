/**
 * STEP 10.2 — SettingsPage: family info, data stats, logout, reset.
 */
import { useState, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/localDb.js'
import useAuthStore from '../store/authStore.js'
import { exportBackup, importBackup, downloadBlob } from '../lib/backup.js'
import { isSyncEnabled } from '../lib/supabase.js'
import { fullSync, registerFamilyOnCloud, joinFamilyByCode } from '../lib/sync.js'
import { PersonBadge, ConfirmDialog, Modal, Toast } from '../components/shared/index.js'
import { Users, Database, LogOut, Trash2, Download, Upload, Shield, Cloud, CloudOff, UserPlus, Copy, RefreshCw, Eye, Wifi, WifiOff, HardDrive, QrCode } from 'lucide-react'
import useOnline from '../hooks/useOnline.js'
import JoinFamily from '../components/sync/JoinFamily.jsx'

export default function SettingsPage() {
  const { familyId, currentMember, logout, fullReset } = useAuthStore()
  const { isOnline } = useOnline()
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [showResetFinal, setShowResetFinal] = useState(false)
  const [backupPin, setBackupPin] = useState('')
  const [showExport, setShowExport] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [toast, setToast] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState(null)
  const [inviteCode, setInviteCode] = useState('')
  const [showJoin, setShowJoin] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [showShareFamily, setShowShareFamily] = useState(false)
  const [showJoinFamily, setShowJoinFamily] = useState(false)
  const fileRef = useRef(null)

  // Family info
  const family = useLiveQuery(
    () => familyId ? db.family.where('id').equals(familyId).first() : null,
    [familyId]
  )
  const members = useLiveQuery(
    () => familyId
      ? db.members.where('family_id').equals(familyId).and((m) => !m._deleted).toArray()
      : [],
    [familyId],
    []
  )

  // Data stats (extended for privacy screen)
  const stats = useLiveQuery(
    async () => {
      if (!familyId) return {}
      const [memCount, expCount, budCount, evtCount, taskCount, tmplCount, notifCount, mealCount, shopCount, invCount, syncCount] = await Promise.all([
        db.members.where('family_id').equals(familyId).and((r) => !r._deleted).count(),
        db.expenses.where('family_id').equals(familyId).and((r) => !r._deleted).count(),
        db.budgets.where('family_id').equals(familyId).and((r) => !r._deleted).count(),
        db.events.where('family_id').equals(familyId).and((r) => !r._deleted).count(),
        db.tasks.where('family_id').equals(familyId).and((r) => !r._deleted).count(),
        db.taskTemplates.where('family_id').equals(familyId).and((r) => !r._deleted).count(),
        db.notifications.where('family_id').equals(familyId).and((r) => !r._deleted).count(),
        db.meals.where('family_id').equals(familyId).and((r) => !r._deleted).count(),
        db.shoppingItems.where('family_id').equals(familyId).and((r) => !r._deleted).count(),
        db.inventory.where('family_id').equals(familyId).and((r) => !r._deleted).count(),
        db.syncLog.count(),
      ])
      const totalRecords = memCount + expCount + budCount + evtCount + taskCount + tmplCount + notifCount + mealCount + shopCount + invCount
      // Rough estimate: ~500 bytes per record
      const estimatedKB = Math.round(totalRecords * 0.5)
      return {
        members: memCount, expenses: expCount, budgets: budCount,
        events: evtCount, tasks: taskCount, templates: tmplCount,
        notifications: notifCount, meals: mealCount, shopping: shopCount,
        inventory: invCount, syncPending: syncCount, totalRecords, estimatedKB,
      }
    },
    [familyId],
    {}
  )

  const handleResetStep1 = () => {
    setShowResetConfirm(true)
  }

  const handleResetStep2 = () => {
    setShowResetConfirm(false)
    setShowResetFinal(true)
  }

  const handleResetFinal = async () => {
    setShowResetFinal(false)
    // Clear all tables
    await Promise.all([
      db.family.clear(),
      db.members.clear(),
      db.expenses.clear(),
      db.budgets.clear(),
      db.events.clear(),
      db.tasks.clear(),
      db.taskTemplates.clear(),
      db.notifications.clear(),
      db.syncLog.clear(),
    ])
    fullReset()
  }

  return (
    <div className="flex flex-col gap-3.5 px-4 py-4 pb-24" style={{ background: 'var(--bg-main)' }}>
      <h2 className="text-xl font-bold text-gray-900">Impostazioni</h2>

      {/* Family section */}
      <div className="rounded-2xl bg-white p-4 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 mb-3">
          <Users size={18} className="text-violet-500" />
          <h3 className="text-sm font-semibold text-gray-800">Famiglia</h3>
        </div>
        <p className="text-sm text-gray-700 mb-3">{family?.name || 'La mia famiglia'}</p>
        <div className="flex flex-wrap gap-3">
          {members.map((m) => (
            <PersonBadge
              key={m.id}
              member={m}
              size="sm"
            />
          ))}
        </div>
      </div>

      {/* Privacy & Data section */}
      <div className="rounded-2xl bg-white p-4 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 mb-3">
          <Eye size={18} className="text-violet-500" />
          <h3 className="text-sm font-semibold text-gray-800">Privacy e dati</h3>
        </div>

        {/* Where data is stored */}
        <div className="rounded-xl p-3 mb-3" style={{ background: 'var(--primary-50)' }}>
          <div className="flex items-center gap-2 mb-1.5">
            <HardDrive size={14} style={{ color: 'var(--primary)' }} />
            <span className="text-xs font-semibold" style={{ color: 'var(--primary)' }}>Dove sono i tuoi dati</span>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Tutti i dati sono salvati <strong>localmente sul dispositivo</strong> (IndexedDB).
            {isSyncEnabled() ? ' La sync cloud è attiva: i dati vengono crittografati AES-256 prima dell\'invio.' : ' Nessun dato viene inviato al cloud.'}
          </p>
        </div>

        {/* Connection status */}
        <div className="flex items-center gap-2 mb-3 px-1">
          {isOnline ? (
            <>
              <Wifi size={14} className="text-green-500" />
              <span className="text-xs font-medium text-green-600">Online</span>
            </>
          ) : (
            <>
              <WifiOff size={14} className="text-orange-500" />
              <span className="text-xs font-medium text-orange-600">Offline — i dati restano sul dispositivo</span>
            </>
          )}
          {isSyncEnabled() && (
            <span className="ml-auto text-[11px] font-medium px-2 py-0.5 rounded-full bg-violet-50 text-violet-600">
              Sync {stats.syncPending > 0 ? `(${stats.syncPending} in coda)` : '✓'}
            </span>
          )}
        </div>

        {/* Record counts */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Membri', count: stats.members, icon: '👥' },
            { label: 'Spese', count: stats.expenses, icon: '💰' },
            { label: 'Budget', count: stats.budgets, icon: '📊' },
            { label: 'Eventi', count: stats.events, icon: '📅' },
            { label: 'Task', count: stats.tasks, icon: '📋' },
            { label: 'Template', count: stats.templates, icon: '🔄' },
            { label: 'Notifiche', count: stats.notifications, icon: '🔔' },
            { label: 'Pasti', count: stats.meals, icon: '🍽️' },
            { label: 'Lista spesa', count: stats.shopping, icon: '🛒' },
            { label: 'Inventario', count: stats.inventory, icon: '📦' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-gray-50">
              <span className="text-sm">{item.icon}</span>
              <span className="text-xs text-gray-500 flex-1">{item.label}</span>
              <span className="text-xs font-bold text-gray-700">{item.count ?? '—'}</span>
            </div>
          ))}
        </div>

        {/* Space estimate */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
          <span className="text-xs text-gray-400">Totale record</span>
          <span className="text-xs font-bold text-gray-600">{stats.totalRecords ?? '—'}</span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-gray-400">Spazio stimato</span>
          <span className="text-xs font-bold text-gray-600">
            {stats.estimatedKB != null
              ? stats.estimatedKB > 1024
                ? `~${(stats.estimatedKB / 1024).toFixed(1)} MB`
                : `~${stats.estimatedKB} KB`
              : '—'}
          </span>
        </div>
      </div>

      {/* Backup section */}
      <div className="rounded-2xl bg-white p-4 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 mb-3">
          <Shield size={18} className="text-violet-500" />
          <h3 className="text-sm font-semibold text-gray-800">Backup crittografato</h3>
        </div>
        <p className="text-xs text-gray-400 mb-3">
          Esporta o importa i dati con crittografia AES-256. Protetto dal tuo PIN.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { setShowExport(true); setBackupPin('') }}
            disabled={exporting}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-violet-600 px-3 py-2.5
              text-xs font-semibold text-white shadow-md hover:bg-violet-700 disabled:opacity-50 transition-all"
          >
            <Download size={14} /> Esporta
          </button>
          <button
            type="button"
            onClick={() => { setShowImport(true); setBackupPin('') }}
            disabled={importing}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-violet-200 px-3 py-2.5
              text-xs font-semibold text-violet-600 hover:bg-violet-50 disabled:opacity-50 transition-all"
          >
            <Upload size={14} /> Importa
          </button>
        </div>
        <input ref={fileRef} type="file" accept=".fmbackup" className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            if (!file || !backupPin) return
            setImporting(true)
            try {
              const result = await importBackup(file, backupPin)
              setToast({ message: `Importati ${result.records} record da ${result.tables} tabelle` })
              setShowImport(false)
              // Reload to reflect imported data
              setTimeout(() => window.location.reload(), 1500)
            } catch (err) {
              setToast({ message: err.message || 'Errore importazione' })
            }
            setImporting(false)
            e.target.value = ''
          }}
        />
      </div>

      {/* Cloud Sync section */}
      <div className="rounded-2xl bg-white p-4 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 mb-3">
          {isSyncEnabled() ? (
            <Cloud size={18} className="text-violet-500" />
          ) : (
            <CloudOff size={18} className="text-gray-400" />
          )}
          <h3 className="text-sm font-semibold text-gray-800">Sincronizzazione Cloud</h3>
        </div>

        {isSyncEnabled() ? (
          <>
            <p className="text-xs text-gray-400 mb-3">
              Sincronizza i dati con Supabase per condividerli tra dispositivi.
            </p>

            {/* Sync button */}
            <button
              type="button"
              onClick={async () => {
                setSyncing(true)
                setSyncProgress(null)
                try {
                  await fullSync(familyId, (p) => setSyncProgress(p))
                  setToast({ message: 'Sincronizzazione completata!' })
                } catch (err) {
                  setToast({ message: `Errore sync: ${err.message}` })
                }
                setSyncing(false)
                setSyncProgress(null)
              }}
              disabled={syncing}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5
                text-xs font-semibold text-white shadow-md hover:bg-violet-700 disabled:opacity-50 transition-all mb-3"
            >
              <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
              {syncing
                ? `Sync ${syncProgress?.phase === 'push' ? '⬆️' : '⬇️'} ${syncProgress?.table || ''}...`
                : 'Sincronizza ora'
              }
            </button>

            {/* Join / Share family */}
            <div className="border-t border-gray-100 pt-3 mt-1">
              <p className="text-xs font-semibold text-gray-600 mb-2">
                <UserPlus size={14} className="inline mr-1" />
                Collega dispositivi
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowShareFamily(true)}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-violet-200 px-3 py-2.5
                    text-xs font-semibold text-violet-600 hover:bg-violet-50 transition-all"
                >
                  <QrCode size={14} /> Invita
                </button>
                <button
                  type="button"
                  onClick={() => setShowJoinFamily(true)}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-violet-200 px-3 py-2.5
                    text-xs font-semibold text-violet-600 hover:bg-violet-50 transition-all"
                >
                  <UserPlus size={14} /> Unisciti
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Invita per condividere il codice, oppure unisciti con un codice ricevuto.
              </p>
            </div>
          </>
        ) : (
          <p className="text-xs text-gray-400">
            Sync non disponibile. Configura le variabili Supabase nel file .env
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3 mt-2">
        <button
          type="button"
          onClick={logout}
          className="flex items-center justify-center gap-2 w-full rounded-xl border border-gray-200
            px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <LogOut size={16} />
          Cambia utente
        </button>

        <button
          type="button"
          onClick={handleResetStep1}
          className="flex items-center justify-center gap-2 w-full rounded-xl border border-red-200
            px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
        >
          <Trash2 size={16} />
          Reset app
        </button>
      </div>

      {/* Current user info */}
      {currentMember && (
        <div className="mt-4 text-center">
          <p className="text-xs text-gray-400">
            Connesso come {currentMember.name} ({currentMember.role})
          </p>
        </div>
      )}

      {/* Share family modal */}
      <Modal
        isOpen={showShareFamily}
        onClose={() => setShowShareFamily(false)}
        title="Invita nella famiglia"
      >
        <JoinFamily
          mode="share"
          familyId={familyId}
          inviteCode={inviteCode || family?.invite_code}
          onClose={() => setShowShareFamily(false)}
        />
      </Modal>

      {/* Join family modal */}
      <Modal
        isOpen={showJoinFamily}
        onClose={() => setShowJoinFamily(false)}
        title="Unisciti a una famiglia"
      >
        <JoinFamily
          mode="join"
          onJoined={(familyData) => {
            setShowJoinFamily(false)
            setToast({ message: `Unito alla famiglia ${familyData.name}!` })
            setTimeout(() => window.location.reload(), 1500)
          }}
          onClose={() => setShowJoinFamily(false)}
        />
      </Modal>

      {/* Double confirm for reset */}
      <ConfirmDialog
        isOpen={showResetConfirm}
        onConfirm={handleResetStep2}
        onCancel={() => setShowResetConfirm(false)}
        title="Reset app"
        message="Stai per cancellare tutti i dati dell'app. Sei sicuro?"
        confirmLabel="Continua"
        danger
      />
      <ConfirmDialog
        isOpen={showResetFinal}
        onConfirm={handleResetFinal}
        onCancel={() => setShowResetFinal(false)}
        title="Conferma reset"
        message="ATTENZIONE: Questa azione è irreversibile. Tutti i dati verranno cancellati."
        confirmLabel="Cancella tutto"
        danger
      />

      {/* Export PIN dialog */}
      <ConfirmDialog
        isOpen={showExport}
        onConfirm={async () => {
          if (!backupPin || backupPin.length < 4) return
          setExporting(true)
          try {
            const blob = await exportBackup(backupPin)
            const date = new Date().toISOString().slice(0, 10)
            downloadBlob(blob, `family-backup-${date}.fmbackup`)
            setToast({ message: 'Backup esportato!' })
          } catch (err) {
            setToast({ message: 'Errore esportazione' })
          }
          setExporting(false)
          setShowExport(false)
        }}
        onCancel={() => setShowExport(false)}
        title="Esporta backup"
        message={
          <div className="flex flex-col gap-2">
            <p className="text-sm text-gray-600">Inserisci un PIN per proteggere il backup:</p>
            <input
              type="password"
              inputMode="numeric"
              value={backupPin}
              onChange={(e) => setBackupPin(e.target.value)}
              placeholder="PIN (min 4 cifre)"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm
                focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
            />
          </div>
        }
        confirmLabel={exporting ? 'Esporto...' : 'Esporta'}
      />

      {/* Import PIN dialog */}
      <ConfirmDialog
        isOpen={showImport}
        onConfirm={() => {
          if (!backupPin || backupPin.length < 4) return
          fileRef.current?.click()
        }}
        onCancel={() => setShowImport(false)}
        title="Importa backup"
        message={
          <div className="flex flex-col gap-2">
            <p className="text-sm text-gray-600">Inserisci il PIN usato per il backup:</p>
            <input
              type="password"
              inputMode="numeric"
              value={backupPin}
              onChange={(e) => setBackupPin(e.target.value)}
              placeholder="PIN del backup"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm
                focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
            />
            <p className="text-xs text-red-500">Attenzione: i dati attuali verranno sostituiti.</p>
          </div>
        }
        confirmLabel="Seleziona file"
        danger
      />

      {toast && <Toast message={toast.message} onClose={() => setToast(null)} />}
    </div>
  )
}
