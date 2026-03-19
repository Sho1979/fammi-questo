/**
 * DashboardPage — Home pulita e ordinata per importanza:
 * 1. Saluto + data
 * 2. Cervellone (Brain input)
 * 3. Eventi di oggi
 * 4. Task di oggi
 * 5. Riepilogo spese mese (divise per genitore)
 * 6. Note spese (solo se presenti)
 * 7. Proposte pranzo/cena (ultime, basate su dispensa)
 *
 * Niente budget bar, niente quick access buttons.
 */
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/localDb.js'
import useAuthStore from '../store/authStore.js'
import { useTodayExpenses, useMonthExpensesByPerson } from '../hooks/useExpenses.js'
import { useTodayEvents } from '../hooks/useCalendar.js'
import { useTodayTasks } from '../hooks/useTasks.js'
import { useTodayMeals, MEAL_SLOTS } from '../hooks/useMeals.js'
import { useInventory } from '../hooks/useInventory.js'
import { formatCurrency } from '../lib/format.js'
import { DEFAULT_CATEGORIES, EVENT_CATEGORIES, MEAL_RECIPES } from '../lib/constants.js'
import { formatTime } from '../lib/dates.js'
import {
  CalendarDays, CheckSquare, Wallet,
  Utensils, ArrowRight, Sparkles, AlertTriangle, Bell, Clock
} from 'lucide-react'
import BrainInput from '../components/brain/BrainInput.jsx'
import ActivityFeed from '../components/shared/ActivityFeed.jsx'
import { useBrainContext } from '../components/layout/AppShell.jsx'
import { Skeleton } from '../components/shared/index.js'

// ─── Meal suggestion logic based on inventory ────────────────────

function suggestMeals(inventoryItems) {
  if (!inventoryItems || inventoryItems.length === 0) return []

  const names = inventoryItems.map((i) => i.name.toLowerCase())

  const matches = MEAL_RECIPES.map((recipe) => {
    const found = recipe.needs.filter((need) =>
      names.some((n) => n.includes(need))
    )
    return { ...recipe, matchCount: found.length, matchRatio: found.length / recipe.needs.length }
  })
    .filter((r) => r.matchCount > 0)
    .sort((a, b) => b.matchRatio - a.matchRatio || b.matchCount - a.matchCount)

  // Return top suggestions: one primo + one secondo if available
  const primo = matches.find((m) => m.cat === 'primo')
  const secondo = matches.find((m) => m.cat === 'secondo' || m.cat === 'piatto unico')
  const results = []
  if (primo) results.push(primo)
  if (secondo) results.push(secondo)
  if (results.length === 0 && matches.length > 0) results.push(matches[0])
  return results
}

// ─── Component ───────────────────────────────────────────────────

export default function DashboardPage() {
  const navigate = useNavigate()
  const { currentMember, familyId } = useAuthStore()
  const brain = useBrainContext()
  const todayExpenses = useTodayExpenses(familyId)
  const todayEvents = useTodayEvents(familyId)
  const todayTasks = useTodayTasks(familyId)
  const todayMeals = useTodayMeals(familyId)
  const monthByPerson = useMonthExpensesByPerson(familyId)
  const inventoryItems = useInventory(familyId)
  const members = useLiveQuery(
    () => familyId
      ? db.members.where('family_id').equals(familyId).and((m) => !m._deleted).toArray()
      : [],
    [familyId],
    []
  )

  const today = new Date().toLocaleDateString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  // ── Alerts: eventi incompleti + promemoria non confermati ──
  const alerts = useLiveQuery(
    async () => {
      if (!familyId) return { incompleteEvents: [], pendingReminders: [] }
      const todayISO = new Date().toISOString().slice(0, 10)
      const tomorrowISO = new Date(Date.now() + 86400000).toISOString().slice(0, 10)

      // Eventi incompleti (oggi/domani con warning)
      const allEvents = await db.events
        .where('family_id').equals(familyId)
        .and(e => !e._deleted && (e.date === todayISO || e.date === tomorrowISO))
        .toArray()
      const incompleteEvents = allEvents.filter(e => e.incomplete || e.needsPickup)

      // Promemoria non confermati (task con needsConfirm e non done)
      const allTasks = await db.tasks
        .where('family_id').equals(familyId)
        .and(t => !t._deleted && t.needsConfirm && t.status !== 'done')
        .toArray()

      // Task con scadenza (bollette, promemoria giornalieri) - non completati
      const upcomingDeadlines = await db.tasks
        .where('family_id').equals(familyId)
        .and(t => !t._deleted && t.status !== 'done' && t.due_date && t.due_date >= todayISO && !t.needsConfirm)
        .toArray()

      return { incompleteEvents, pendingReminders: allTasks, upcomingDeadlines }
    },
    [familyId],
    { incompleteEvents: [], pendingReminders: [], upcomingDeadlines: [] }
  )

  // Spese con note
  const expenseNotes = todayExpenses.filter((e) => e.note && e.note.trim().length > 0)

  // Pranzo e cena di oggi (from meal plans)
  const pranzoSlot = MEAL_SLOTS.find((s) => s.id === 'pranzo')
  const cenaSlot = MEAL_SLOTS.find((s) => s.id === 'cena')
  const pranzo = todayMeals.filter((m) => m.slot === 'pranzo')
  const cena = todayMeals.filter((m) => m.slot === 'cena')
  const hasMealPlans = pranzo.length > 0 || cena.length > 0

  // AI meal suggestions based on inventory (only if no meal plans)
  const mealSuggestions = useMemo(() => {
    if (hasMealPlans) return []
    return suggestMeals(inventoryItems)
  }, [inventoryItems, hasMealPlans])

  // Task non completati
  const pendingTasks = todayTasks.filter((t) => t.status !== 'done')
  const doneTasks = todayTasks.filter((t) => t.status === 'done')

  // Riepilogo spese genitori (solo parent/genitore — NO elder/nonni)
  const parentExpenses = useMemo(() => {
    const parents = members.filter((m) =>
      (m.role === 'parent' || m.role === 'genitore') &&
      m.role !== 'elder' && m.role !== 'nonno' && m.role !== 'nonna'
    )
    return parents.map((p) => {
      const data = monthByPerson.find((e) => e.person_id === p.id)
      return { name: p.name, total: data?.total || 0 }
    })
  }, [members, monthByPerson])

  // Totale mese solo dei genitori
  const parentIds = new Set(
    members
      .filter((m) => (m.role === 'parent' || m.role === 'genitore') && m.role !== 'elder')
      .map((m) => m.id)
  )
  const totalMonth = monthByPerson
    .filter((e) => parentIds.has(e.person_id))
    .reduce((s, e) => s + e.total, 0)

  // Skeleton: se familyId esiste ma members non ancora caricati → loading
  const isLoading = familyId && members.length === 0

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3.5 px-4 py-4 pb-24" style={{ background: 'var(--bg-main)' }}>
        <Skeleton.Banner />
        <Skeleton.Card />
        <Skeleton.List count={3} />
      </div>
    )
  }

  return (
    <div className="stagger-children flex flex-col gap-3.5 px-4 py-4 pb-24"
      style={{ background: 'var(--bg-main)' }}>

      {/* ═══ 1. Greeting card ═══ */}
      <div className="relative overflow-hidden rounded-2xl px-5 py-5"
        style={{ background: 'var(--gradient-primary)', boxShadow: 'var(--shadow-glow)' }}>
        <div className="absolute -top-6 -right-6 h-28 w-28 rounded-full bg-white/[0.06]" />
        <div className="absolute bottom-2 right-16 h-16 w-16 rounded-full bg-white/[0.04]" />
        <div className="absolute -bottom-3 -left-3 h-20 w-20 rounded-full bg-white/[0.04]" />
        <div className="relative">
          <h2 className="text-xl font-bold text-white">
            Ciao {currentMember?.name}! <span className="inline-block animate-bounce">👋</span>
          </h2>
          <p className="mt-1.5 text-sm text-white/70 capitalize">{today}</p>
        </div>
      </div>

      {/* ═══ 2. Brain Input — il cervellone ═══ */}
      {brain && (
        <div className="card p-4">
          <BrainInput
            phase={brain.phase}
            parseText={brain.parseText}
            startVoice={brain.startVoice}
            aiCallsRemaining={brain.aiCallsRemaining}
            speechAvailable={brain.speechAvailable}
            nlpReady={brain.nlpReady}
          />
        </div>
      )}

      {/* ═══ 2b. Alert: eventi incompleti + promemoria ═══ */}
      {(alerts.incompleteEvents.length > 0 || alerts.pendingReminders.length > 0 || alerts.upcomingDeadlines.length > 0) && (
        <div className="rounded-2xl overflow-hidden"
          style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.12)' }}>
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-2.5"
            style={{ background: 'rgba(239,68,68,0.06)' }}>
            <AlertTriangle size={15} className="text-red-500" />
            <span className="text-xs font-bold text-red-600">Da completare</span>
            <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">
              {alerts.incompleteEvents.length + alerts.pendingReminders.length + alerts.upcomingDeadlines.length}
            </span>
          </div>

          <div className="flex flex-col gap-1 px-4 py-2">
            {/* Eventi incompleti — click naviga al giorno specifico */}
            {alerts.incompleteEvents.map((ev) => (
              <div key={ev.id}
                className="flex items-center gap-2 py-1.5 px-1 rounded-lg cursor-pointer active:bg-red-50 transition-colors"
                onClick={() => navigate(`/calendar?date=${ev.date}`)}>
                <CalendarDays size={13} className="text-red-400 flex-shrink-0" />
                <span className="text-xs text-gray-700 truncate flex-1">{ev.title}</span>
                <span className="text-[10px] text-red-500 font-medium flex-shrink-0">
                  {ev.incomplete || (ev.needsPickup ? 'Chi riprende?' : '')}
                </span>
                <ArrowRight size={11} className="text-red-300 flex-shrink-0" />
              </div>
            ))}

            {/* Promemoria non confermati */}
            {alerts.pendingReminders.map((task) => (
              <div key={task.id}
                className="flex items-center gap-2 py-1.5 px-1 rounded-lg cursor-pointer active:bg-violet-50 transition-colors"
                onClick={() => navigate('/tasks')}>
                <Bell size={13} className="text-violet-400 flex-shrink-0" />
                <span className="text-xs text-gray-700 truncate flex-1">{task.title}</span>
                <span className="text-[10px] text-violet-500 font-medium flex-shrink-0">
                  Da confermare
                </span>
                <ArrowRight size={11} className="text-violet-300 flex-shrink-0" />
              </div>
            ))}
            {/* Scadenze in arrivo (bollette, promemoria giornalieri) */}
            {alerts.upcomingDeadlines.map((task) => {
              const today = new Date().toISOString().slice(0, 10)
              const diffDays = Math.ceil((new Date(task.due_date) - new Date(today)) / 86400000)
              const urgency = diffDays === 0 ? 'OGGI' : diffDays === 1 ? 'Domani' : diffDays + ' giorni'
              const urgColor = diffDays === 0 ? '#EF4444' : diffDays <= 2 ? '#F59E0B' : '#A855F7'
              return (
                <div key={task.id}
                  className="flex items-center gap-2 py-1.5 px-1 rounded-lg cursor-pointer active:bg-purple-50 transition-colors"
                  onClick={() => navigate('/tasks')}>
                  <Clock size={13} style={{ color: urgColor }} className="flex-shrink-0" />
                  <span className="text-xs text-gray-700 truncate flex-1">{task.title}</span>
                  <span className="text-[10px] font-bold flex-shrink-0 px-1.5 py-0.5 rounded-full"
                    style={{ background: urgColor + '15', color: urgColor }}>
                    {urgency}
                  </span>
                  <ArrowRight size={11} style={{ color: urgColor + '80' }} className="flex-shrink-0" />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ═══ 3. Eventi oggi ═══ */}
      <div className="card p-4 cursor-pointer card-interactive" role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') e.currentTarget.click() }} onClick={() => navigate('/calendar')}>
        <div className="flex items-center gap-2.5 mb-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl"
            style={{ background: 'rgba(9,132,227,0.12)' }}>
            <CalendarDays size={16} style={{ color: '#0984E3' }} />
          </div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Eventi oggi
            {todayEvents.length > 0 && (
              <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(9,132,227,0.1)', color: '#0984E3' }}>
                {todayEvents.length}
              </span>
            )}
          </h3>
          <ArrowRight size={14} className="ml-auto text-gray-300" />
        </div>
        {todayEvents.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            {todayEvents.slice(0, 4).map((ev) => {
              const cat = EVENT_CATEGORIES.find((c) => c.id === ev.category)
              const owner = ev.person_id === 'tutti'
                ? { name: 'Tutti' }
                : members.find((m) => m.id === ev.person_id)
              return (
                <div key={ev.id} className="flex items-center justify-between text-sm">
                  <span className="truncate" style={{ color: 'var(--text-secondary)' }}>
                    {cat?.icon || '📌'} {ev.title}
                    {owner ? ` — ${owner.name}` : ''}
                  </span>
                  <span className="text-[10px] flex-shrink-0 ml-2 rounded-md px-2 py-0.5 font-semibold"
                    style={{ background: 'rgba(9,132,227,0.08)', color: '#0984E3' }}>
                    {ev.time_start ? formatTime(ev.time_start) : 'Tutto il giorno'}
                  </span>
                </div>
              )
            })}
            {todayEvents.length > 4 && (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                +{todayEvents.length - 4} altri eventi
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm animate-[fadeIn_0.3s_ease-out]" style={{ color: 'var(--text-muted)' }}>
            <CalendarDays size={14} className="inline mr-1 opacity-40" />
            Nessun evento oggi — goditi la calma ✨
          </p>
        )}
      </div>

      {/* ═══ 4. Task oggi ═══ */}
      <div className="card p-4 cursor-pointer card-interactive" role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') e.currentTarget.click() }} onClick={() => navigate('/tasks')}>
        <div className="flex items-center gap-2.5 mb-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl"
            style={{ background: 'rgba(0,184,148,0.12)' }}>
            <CheckSquare size={16} style={{ color: '#00B894' }} />
          </div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Task oggi
            {pendingTasks.length > 0 && (
              <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(0,184,148,0.1)', color: '#00B894' }}>
                {pendingTasks.length} da fare
              </span>
            )}
          </h3>
          <ArrowRight size={14} className="ml-auto text-gray-300" />
        </div>
        {todayTasks.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            {pendingTasks.slice(0, 3).map((t) => {
              const assignee = members.find((m) => m.id === t.assigned_to)
              return (
                <div key={t.id} className="flex items-center gap-2 text-sm">
                  <div className="flex h-5 w-5 items-center justify-center rounded-md border"
                    style={{ borderColor: 'var(--border-subtle)' }} />
                  <span className="truncate" style={{ color: 'var(--text-secondary)' }}>
                    {t.title}
                    {assignee ? ` — ${assignee.name}` : ''}
                  </span>
                </div>
              )
            })}
            {doneTasks.length > 0 && (
              <p className="text-xs mt-0.5" style={{ color: '#00B894' }}>
                ✓ {doneTasks.length} completat{doneTasks.length === 1 ? 'o' : 'i'}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm animate-[fadeIn_0.3s_ease-out]" style={{ color: 'var(--text-muted)' }}>
            <CheckSquare size={14} className="inline mr-1 opacity-40" />
            Nessun task per oggi — tutto fatto! 🎉
          </p>
        )}
      </div>

      {/* ═══ 5. Riepilogo spese mese — divise per genitore ═══ */}
      <div className="card p-4 cursor-pointer card-interactive" role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') e.currentTarget.click() }} onClick={() => navigate('/expenses')}>
        <div className="flex items-center gap-2.5 mb-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl"
            style={{ background: 'rgba(253,203,110,0.15)' }}>
            <Wallet size={16} style={{ color: '#F39C12' }} />
          </div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Spese mese
          </h3>
          <span className="ml-auto text-sm font-bold" style={{ color: '#F39C12' }}>
            {formatCurrency(totalMonth)}
          </span>
        </div>

        {parentExpenses.length > 0 ? (
          <div className="flex flex-col gap-2">
            {parentExpenses.map((p) => (
              <div key={p.name} className="flex items-center justify-between">
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {p.name}
                </span>
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {formatCurrency(p.total)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm animate-[fadeIn_0.3s_ease-out]" style={{ color: 'var(--text-muted)' }}>
            <Wallet size={14} className="inline mr-1 opacity-40" />
            Nessuna spesa registrata questo mese
          </p>
        )}
      </div>

      {/* ═══ 6. Note spese (solo se ci sono note) ═══ */}
      {expenseNotes.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Note spese di oggi
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            {expenseNotes.map((e) => {
              const cat = DEFAULT_CATEGORIES.find((c) => c.id === e.category)
              return (
                <div key={e.id} className="flex items-center justify-between text-sm">
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {cat?.icon || '📌'} {e.note}
                  </span>
                  <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                    {formatCurrency(e.amount)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ═══ 7. Proposte pranzo/cena (ultime, basate su dispensa) ═══ */}
      <div
        className="overflow-hidden rounded-2xl cursor-pointer"
        onClick={() => navigate('/meals')}
        style={{
          background: 'linear-gradient(135deg, rgba(253,203,110,0.12) 0%, rgba(225,112,85,0.08) 100%)',
          border: '1px solid rgba(253,203,110,0.2)',
        }}
      >
        <div className="px-4 py-3">
          <div className="flex items-center gap-2 mb-2.5">
            <Utensils size={15} style={{ color: '#E17055' }} />
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#E17055' }}>
              {hasMealPlans ? 'Menu di oggi' : 'Proposte pasti'}
            </span>
            {!hasMealPlans && mealSuggestions.length > 0 && (
              <Sparkles size={12} style={{ color: '#FDCB6E' }} />
            )}
            <ArrowRight size={13} className="ml-auto" style={{ color: '#E1705580' }} />
          </div>

          {hasMealPlans ? (
            /* Show planned meals */
            <div className="flex gap-3">
              <div className="flex-1 rounded-xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.6)' }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-sm">{pranzoSlot?.icon}</span>
                  <span className="text-[10px] font-bold uppercase" style={{ color: '#B2BEC3' }}>Pranzo</span>
                </div>
                {pranzo.length > 0 ? (
                  pranzo.map((m) => (
                    <p key={m.id} className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {m.name}
                    </p>
                  ))
                ) : (
                  <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>Non deciso</p>
                )}
              </div>
              <div className="flex-1 rounded-xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.6)' }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-sm">{cenaSlot?.icon}</span>
                  <span className="text-[10px] font-bold uppercase" style={{ color: '#B2BEC3' }}>Cena</span>
                </div>
                {cena.length > 0 ? (
                  cena.map((m) => (
                    <p key={m.id} className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {m.name}
                    </p>
                  ))
                ) : (
                  <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>Non deciso</p>
                )}
              </div>
            </div>
          ) : mealSuggestions.length > 0 ? (
            /* Show AI suggestions from inventory */
            <div className="flex flex-col gap-1.5">
              <p className="text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>
                In base a cosa hai in dispensa:
              </p>
              {mealSuggestions.map((s, i) => (
                <div key={i} className="flex items-center gap-2 rounded-xl px-3 py-2"
                  style={{ background: 'rgba(255,255,255,0.6)' }}>
                  <span className="text-sm">
                    {s.cat === 'primo' ? '🍝' : s.cat === 'secondo' ? '🥩' : '🍕'}
                  </span>
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {s.name}
                  </span>
                  <span className="text-[10px] ml-auto px-1.5 py-0.5 rounded-full"
                    style={{ background: 'rgba(253,203,110,0.3)', color: '#E17055' }}>
                    {s.cat}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-2">
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Nessun pasto pianificato per oggi
              </p>
              <button
                type="button"
                onClick={() => navigate('/meals')}
                className="text-xs font-semibold px-4 py-2 rounded-xl transition-all active:scale-[0.97]"
                style={{ background: 'rgba(253,203,110,0.2)', color: '#E17055' }}
              >
                Pianifica i pasti
              </button>
            </div>
          )}
        </div>
      </div>
      {/* ═══ 8. Activity Feed — ultime azioni famiglia ═══ */}
      <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card)' }}>
        <div className="flex items-center gap-2 mb-3">
          <Clock size={16} style={{ color: 'var(--text-muted)' }} />
          <h2 className="text-sm font-bold" style={{ color: 'var(--text-secondary)' }}>Attivita' recente</h2>
        </div>
        <ActivityFeed familyId={familyId} members={members} limit={5} />
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
