/**
 * STEP 15.2 — NotifList: notification center modal/page.
 * Props: notifications[], onMarkRead(id), onMarkAllRead()
 */
import { Bell, Check, CheckCheck } from 'lucide-react'

const TYPE_ICONS = {
  task_assigned: '📋',
  task_approved: '✅',
  task_rejected: '❌',
  event_reminder: '📅',
  reward_earned: '⭐',
  general: '🔔',
}

export default function NotifList({ notifications, onMarkRead, onMarkAllRead }) {
  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <h3 className="text-base font-semibold text-gray-900">Notifiche</h3>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={onMarkAllRead}
            className="flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-700"
          >
            <CheckCheck size={14} /> Segna tutte lette
          </button>
        )}
      </div>

      {/* List */}
      {notifications.length > 0 ? (
        <div className="flex flex-col max-h-[60vh] overflow-y-auto">
          {notifications.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => !n.read && onMarkRead(n.id)}
              className={`flex items-start gap-3 px-4 py-3 text-left border-b border-gray-50 transition-colors
                ${n.read ? 'bg-white' : 'bg-violet-50'}`}
            >
              <span className="text-lg mt-0.5">{TYPE_ICONS[n.type] || '🔔'}</span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${n.read ? 'text-gray-600' : 'font-semibold text-gray-900'}`}>
                  {n.title}
                </p>
                {n.message && (
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{n.message}</p>
                )}
                <p className="text-xs text-gray-300 mt-1">
                  {n.created_at ? new Date(n.created_at).toLocaleString('it-IT', {
                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                  }) : ''}
                </p>
              </div>
              {!n.read && (
                <span className="w-2 h-2 rounded-full bg-violet-500 mt-2 flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      ) : (
        <div className="text-center py-10">
          <Bell size={28} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-400">Nessuna notifica</p>
        </div>
      )}
    </div>
  )
}
