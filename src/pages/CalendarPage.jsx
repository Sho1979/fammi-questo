/**
 * STEP 11.6 — CalendarPage: monthly grid + day detail + event CRUD.
 * Vista mensile con click sul giorno per dettaglio. Logistica (chi porta/riprende).
 * R3: Tre viste — Giorno / Settimana / Mese con toggle.
 */
import { useState, useCallback, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/localDb.js'
import useAuthStore from '../store/authStore.js'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  useEventsByMonth,
  addEvent,
  updateEvent,
  deleteEvent,
  undoDeleteEvent,
  createRecurrence,
} from '../hooks/useCalendar.js'
import { addDays, getWeekDays, formatMonthYear, formatWeekday, formatDate, formatDayShort } from '../lib/dates.js'
import MonthGrid from '../components/calendar/MonthGrid.jsx'
import DayDetail from '../components/calendar/DayDetail.jsx'
import DayView from '../components/calendar/DayView.jsx'
import WeekView from '../components/calendar/WeekView.jsx'
import ViewToggle from '../components/calendar/ViewToggle.jsx'
import EventForm from '../components/calendar/EventForm.jsx'
import { Modal, ConfirmDialog } from '../components/shared/index.js'
import { showSuccess, showUndo } from '../lib/toast.js'
import { notifyEvents } from '../hooks/useNotifications.js'
import Skeleton from '../components/shared/Skeleton.jsx'
import { addTask, updateTask, completeTask } from '../hooks/useTasks.js'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export default function CalendarPage() {
  const { familyId, currentMember } = useAuthStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const now = new Date()

  // View mode: 'day' | 'week' | 'month'
  const [viewMode, setViewMode] = useState('month')

  // Month navigation
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth()) // 0-indexed

  // Selected day
  const [selectedDate, setSelectedDate] = useState(todayStr())

  // Handle ?date= query param from deep links (e.g. Dashboard "Da completare")
  useEffect(() => {
    const dateParam = searchParams.get('date')
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      setSelectedDate(dateParam)
      const [y, m] = dateParam.split('-').map(Number)
      setViewYear(y)
      setViewMonth(m - 1)
      // Passa a vista giorno per mostrare l'evento direttamente
      setViewMode('day')
      // Clean up the URL param
      searchParams.delete('date')
      setSearchParams(searchParams, { replace: true })
      // Scroll in cima dopo il render
      requestAnimationFrame(() => {
        const main = document.querySelector('.scroll-container')
        if (main) main.scrollTo({ top: 0, behavior: 'smooth' })
      })
    }
  }, [searchParams, setSearchParams])

  // ─── Live queries ──────────────────────────────────────
  const yyyy_mm = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`
  const events = useEventsByMonth(familyId, yyyy_mm)

  // Tasks con scadenza nel mese corrente (per mostrare sul calendario)
  const monthStart = yyyy_mm + '-01'
  const monthEnd = yyyy_mm + '-31'
  const tasksInMonth = useLiveQuery(
    async () => {
      if (!familyId) return []
      return db.tasks
        .where('family_id')
        .equals(familyId)
        .and((t) => !t._deleted && t.status !== 'done' && t.due_date >= monthStart && t.due_date <= monthEnd)
        .toArray()
    },
    [familyId, yyyy_mm],
    []
  )

  // For week view: filter events/tasks for the current week
  const weekDays = useMemo(() => getWeekDays(selectedDate), [selectedDate])
  const weekEvents = useMemo(() => {
    if (viewMode !== 'week' || weekDays.length === 0) return events
    const first = weekDays[0]
    const last = weekDays[6]
    return events.filter((e) => e.date >= first && e.date <= last)
  }, [events, weekDays, viewMode])

  const weekTasks = useMemo(() => {
    if (viewMode !== 'week' || weekDays.length === 0) return tasksInMonth
    const first = weekDays[0]
    const last = weekDays[6]
    return tasksInMonth.filter((t) => t.due_date >= first && t.due_date <= last)
  }, [tasksInMonth, weekDays, viewMode])

  const members = useLiveQuery(
    () => familyId
      ? db.members.where('family_id').equals(familyId).and((m) => !m._deleted).toArray()
      : [],
    [familyId],
    []
  )

  // Modal state
  const [showForm, setShowForm] = useState(false)
  const [editingEvent, setEditingEvent] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null) // eventId
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(null) // recurrence_id for "delete all"

  // ─── Navigation (adapts to viewMode) ──────────────────
  const handlePrev = () => {
    if (viewMode === 'day') {
      const prev = addDays(selectedDate, -1)
      setSelectedDate(prev)
      const [y, m] = prev.split('-').map(Number)
      if (y !== viewYear || m !== viewMonth + 1) {
        setViewYear(y)
        setViewMonth(m - 1)
      }
    } else if (viewMode === 'week') {
      const prev = addDays(selectedDate, -7)
      setSelectedDate(prev)
      const [y, m] = prev.split('-').map(Number)
      if (y !== viewYear || m !== viewMonth + 1) {
        setViewYear(y)
        setViewMonth(m - 1)
      }
    } else {
      // month
      if (viewMonth === 0) {
        setViewMonth(11)
        setViewYear(viewYear - 1)
      } else {
        setViewMonth(viewMonth - 1)
      }
    }
  }

  const handleNext = () => {
    if (viewMode === 'day') {
      const next = addDays(selectedDate, 1)
      setSelectedDate(next)
      const [y, m] = next.split('-').map(Number)
      if (y !== viewYear || m !== viewMonth + 1) {
        setViewYear(y)
        setViewMonth(m - 1)
      }
    } else if (viewMode === 'week') {
      const next = addDays(selectedDate, 7)
      setSelectedDate(next)
      const [y, m] = next.split('-').map(Number)
      if (y !== viewYear || m !== viewMonth + 1) {
        setViewYear(y)
        setViewMonth(m - 1)
      }
    } else {
      // month
      if (viewMonth === 11) {
        setViewMonth(0)
        setViewYear(viewYear + 1)
      } else {
        setViewMonth(viewMonth + 1)
      }
    }
  }

  const handleToday = () => {
    const today = todayStr()
    setSelectedDate(today)
    const n = new Date()
    setViewYear(n.getFullYear())
    setViewMonth(n.getMonth())
  }

  const handleDayClick = (date) => {
    setSelectedDate(date)
    // If clicking a day from prev/next month, navigate to that month
    const [y, m] = date.split('-').map(Number)
    if (y !== viewYear || m !== viewMonth + 1) {
      setViewYear(y)
      setViewMonth(m - 1)
    }
  }

  // Navigation title adapts to view mode
  const navTitle = useMemo(() => {
    if (viewMode === 'day') {
      return `${formatWeekday(selectedDate)} ${formatDate(selectedDate)}`
    }
    if (viewMode === 'week') {
      const first = weekDays[0]
      const last = weekDays[6]
      if (!first || !last) return ''
      return `${formatDayShort(first)} – ${formatDayShort(last)}`
    }
    return formatMonthYear(viewYear, viewMonth)
  }, [viewMode, selectedDate, weekDays, viewYear, viewMonth])

  // ─── CRUD handlers ────────────────────────────────────
  const handleAdd = () => {
    setEditingEvent(null)
    setShowForm(true)
  }

  const handleEdit = (event) => {
    setEditingEvent(event)
    setShowForm(true)
  }

  const handleSave = useCallback(async (data) => {
    const { _recurrence, ...eventData } = data

    if (editingEvent) {
      // ── Ricalcola warning flags in base ai dati aggiornati ──
      if (eventData.time_start && editingEvent.incomplete) {
        eventData.incomplete = null
      }

      const validLogistics = eventData.logistics || []
      const hasPickup = validLogistics.some(l => l.role === 'riprende' && l.member_id)
      if (hasPickup && editingEvent.needsPickup) {
        eventData.needsPickup = false
      }

      await updateEvent(editingEvent.id, eventData)

      // -- Auto-crea/aggiorna task logistica quando si aggiungono porta/riprende --
      if (validLogistics.length > 0) {
        const currentMemberId = currentMember?.id
        const existingLinkedTasks = await db.tasks
          .where('family_id').equals(familyId)
          .and(t => t.linked_event_id === editingEvent.id && !t._deleted)
          .toArray()

        const existingRoles = new Map(existingLinkedTasks.map(t => {
          const role = t.title?.toLowerCase().includes('portare') || t.title?.toLowerCase().includes('porta')
            ? 'porta' : t.title?.toLowerCase().includes('riprendere') || t.title?.toLowerCase().includes('riprende')
            ? 'riprende' : null
          return [role, t]
        }))

        for (const log of validLogistics) {
          if (!log.member_id || !log.role) continue
          const logMember = members.find(m => m.id === log.member_id)
          const personOwner = members.find(m => m.id === eventData.person_id)
          const ownerName = personOwner?.name || 'evento'
          const roleName = log.role === 'porta' ? 'Portare' : 'Riprendere'
          const taskTitle = `${roleName} ${ownerName} - ${eventData.title}`

          const existingTask = existingRoles.get(log.role)
          if (existingTask) {
            if (existingTask.assigned_to !== log.member_id) {
              await updateTask(existingTask.id, {
                assigned_to: log.member_id,
                title: taskTitle,
                accepted: log.member_id === currentMemberId,
              })
            }
          } else {
            await addTask({
              title: taskTitle,
              assigned_to: log.member_id,
              due_date: eventData.date || editingEvent.date,
              status: 'todo',
              priority: 'medium',
              category: 'altro',
              points: 5,
              accepted: log.member_id === currentMemberId,
              linked_event_id: editingEvent.id,
            })
          }
        }

        const hasPorta = validLogistics.some(l => l.role === 'porta' && l.member_id)
        if (hasPorta) {
          await updateEvent(editingEvent.id, { incomplete: null })
        }
      }

      showSuccess('Evento aggiornato')
    } else if (_recurrence) {
      await createRecurrence({
        ..._recurrence,
        event_template: eventData,
      })
      showSuccess('Evento ricorrente creato')
    } else {
      await addEvent(eventData)
      showSuccess('Evento aggiunto')
      // Notify family
      notifyEvents.eventCreated(
        currentMember?.name, currentMember?.icon,
        eventData.title, eventData.date,
        eventData.person_id === 'tutti' ? 'Tutti' : members.find(m => m.id === eventData.person_id)?.name
      ).catch(() => {})
    }
    setShowForm(false)
    setEditingEvent(null)
  }, [editingEvent, members, currentMember, familyId])

  const handleDeleteRequest = (eventId) => {
    // Se l'evento è ricorrente, chiedi "solo questo o tutti?"
    const event = events.find(e => e.id === eventId)
    if (event?.recurrence_id) {
      setConfirmDeleteAll(event) // mostra dialog con scelta
    } else {
      setConfirmDelete(eventId) // dialog semplice
    }
  }

  const handleDeleteConfirm = useCallback(async () => {
    const id = confirmDelete
    setConfirmDelete(null)
    await deleteEvent(id)
    showUndo('Evento eliminato', async () => {
      await undoDeleteEvent(id)
    })
  }, [confirmDelete])

  // Elimina solo questa occorrenza di un evento ricorrente
  const handleDeleteSingleRecurrence = useCallback(async () => {
    const event = confirmDeleteAll
    setConfirmDeleteAll(null)
    if (!event) return
    await deleteEvent(event.id)
    showUndo('Occorrenza eliminata', async () => {
      await undoDeleteEvent(event.id)
    })
  }, [confirmDeleteAll])

  // Elimina tutti gli eventi futuri di questa ricorrenza
  const handleDeleteAllRecurrence = useCallback(async () => {
    const event = confirmDeleteAll
    setConfirmDeleteAll(null)
    if (!event?.recurrence_id) return
    const today = todayStr()
    const futureEvents = events.filter(
      e => e.recurrence_id === event.recurrence_id && e.date >= today && !e._deleted
    )
    for (const ev of futureEvents) {
      await deleteEvent(ev.id)
    }
    showSuccess(`${futureEvents.length} eventi eliminati`)
  }, [confirmDeleteAll, events])

  // ─── Loading skeleton ──────────────────────────────────
  const isLoading = familyId && members.length === 0 && events.length === 0

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3.5 px-4 py-4 pb-24" style={{ background: 'var(--bg-main)' }}>
        <Skeleton h={36} w="60%" />
        <div className="card p-3">
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 35 }, (_, i) => (
              <Skeleton key={i} h={40} className="rounded-lg" />
            ))}
          </div>
        </div>
        <Skeleton.Card />
        <Skeleton.Card />
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────
  return (
    <div className="flex flex-col gap-3.5 px-4 py-4 pb-24" style={{ background: 'var(--bg-main)' }}>
      {/* View toggle */}
      <ViewToggle value={viewMode} onChange={setViewMode} />

      {/* Navigation header (day/week views need their own nav) */}
      {viewMode !== 'month' && (
        <div
          className="flex items-center justify-between px-2 py-2 rounded-xl"
          style={{
            background: 'linear-gradient(135deg, rgba(9,132,227,0.06) 0%, rgba(116,185,255,0.06) 100%)',
          }}
        >
          <button
            type="button"
            onClick={handlePrev}
            className="flex h-8 w-8 items-center justify-center rounded-lg transition-all active:scale-90"
            style={{ background: 'rgba(9,132,227,0.08)', color: '#0984E3' }}
          >
            <ChevronLeft size={16} strokeWidth={2.5} />
          </button>

          <button
            type="button"
            onClick={handleToday}
            className="text-sm font-bold capitalize"
            style={{ color: '#2D3436', letterSpacing: '-0.3px' }}
          >
            {navTitle}
          </button>

          <button
            type="button"
            onClick={handleNext}
            className="flex h-8 w-8 items-center justify-center rounded-lg transition-all active:scale-90"
            style={{ background: 'rgba(9,132,227,0.08)', color: '#0984E3' }}
          >
            <ChevronRight size={16} strokeWidth={2.5} />
          </button>
        </div>
      )}

      {/* ═══ MONTH VIEW ═══ */}
      {viewMode === 'month' && (
        <>
          <MonthGrid
            year={viewYear}
            month={viewMonth}
            events={events}
            tasks={tasksInMonth}
            selectedDate={selectedDate}
            onDayClick={handleDayClick}
            onPrev={handlePrev}
            onNext={handleNext}
          />
          <DayDetail
            date={selectedDate}
            events={events}
            tasks={tasksInMonth}
            members={members}
            onAdd={handleAdd}
            onEdit={handleEdit}
            onDelete={handleDeleteRequest}
            onCompleteTask={completeTask}
          />
        </>
      )}

      {/* ═══ WEEK VIEW ═══ */}
      {viewMode === 'week' && (
        <WeekView
          selectedDate={selectedDate}
          events={weekEvents}
          tasks={weekTasks}
          members={members}
          onDayClick={(date) => {
            handleDayClick(date)
            setViewMode('day') // Click on day → switch to day view
          }}
          onAdd={handleAdd}
          onEdit={handleEdit}
          onDelete={handleDeleteRequest}
          onCompleteTask={completeTask}
        />
      )}

      {/* ═══ DAY VIEW ═══ */}
      {viewMode === 'day' && (
        <DayView
          date={selectedDate}
          events={events}
          tasks={tasksInMonth}
          members={members}
          onAdd={handleAdd}
          onEdit={handleEdit}
          onDelete={handleDeleteRequest}
          onCompleteTask={completeTask}
        />
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditingEvent(null) }}
        title={editingEvent ? 'Modifica evento' : 'Nuovo evento'}
      >
        <EventForm
          members={members}
          currentMember={currentMember}
          onSave={handleSave}
          event={editingEvent}
          onClose={() => { setShowForm(false); setEditingEvent(null) }}
          selectedDate={selectedDate}
        />
      </Modal>

      {/* Delete Confirm (evento singolo) */}
      <ConfirmDialog
        isOpen={confirmDelete !== null}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setConfirmDelete(null)}
        title="Elimina evento"
        message="Vuoi eliminare questo evento? Potrai annullare l'operazione."
        confirmLabel="Elimina"
        danger
      />

      {/* Delete Confirm (evento ricorrente — scelta solo questo / tutti) */}
      <Modal
        isOpen={confirmDeleteAll !== null}
        onClose={() => setConfirmDeleteAll(null)}
        title="Evento ricorrente"
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-gray-600">
            Questo evento fa parte di una serie ricorrente. Cosa vuoi eliminare?
          </p>
          <button
            type="button"
            onClick={handleDeleteSingleRecurrence}
            className="w-full rounded-xl py-2.5 text-sm font-semibold text-white bg-red-500
              hover:bg-red-600 transition-all"
          >
            Solo questa occorrenza
          </button>
          <button
            type="button"
            onClick={handleDeleteAllRecurrence}
            className="w-full rounded-xl py-2.5 text-sm font-semibold text-red-600 bg-red-50
              hover:bg-red-100 transition-all"
          >
            Tutti gli eventi futuri
          </button>
          <button
            type="button"
            onClick={() => setConfirmDeleteAll(null)}
            className="w-full rounded-xl py-2.5 text-sm font-medium text-gray-500
              hover:bg-gray-50 transition-all"
          >
            Annulla
          </button>
        </div>
      </Modal>

    </div>
  )
}
