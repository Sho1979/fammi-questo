/**
 * MonthGrid — Modern calendar grid with colored header,
 * rounded day cells, today ring, event dot indicators, smooth transitions.
 */
import { useMemo, memo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getCalendarGrid, formatMonthYear } from '../../lib/dates.js'
import { WEEKDAYS_SHORT, EVENT_CATEGORIES } from '../../lib/constants.js'

// Accent color for calendar section (matches BottomNav blue)
const CAL_COLOR = '#0984E3'
const CAL_LIGHT = '#74B9FF'
const CAL_BG = 'rgba(9,132,227,0.08)'
const CAL_GRADIENT = 'linear-gradient(135deg, #0984E3 0%, #74B9FF 100%)'

export default memo(function MonthGrid({ year, month, events, tasks = [], onDayClick, selectedDate, onPrev, onNext }) {
  const grid = useMemo(() => getCalendarGrid(year, month), [year, month])

  // Build a map: date -> array of event colors
  // Arancione (#FF9800) se l'evento � incompleto (manca orario, logistica, pickup)
  const INCOMPLETE_COLOR = '#FF9800'
  const eventDots = useMemo(() => {
    const map = {}
    for (const ev of events) {
      if (!map[ev.date]) map[ev.date] = []
      const isAbsence = ev.isAbsence || ev.category === 'assenza'
      const hasWarnings = !isAbsence && (ev.incomplete || ev.needsPickup || !ev.time_start)
      const cat = EVENT_CATEGORIES.find((c) => c.id === ev.category)
      const color = hasWarnings ? INCOMPLETE_COLOR : (ev.color || cat?.color || '#9E9E9E')
      if (map[ev.date].length < 3) map[ev.date].push(color)
    }
    return map
  }, [events])

  // Task dots: viola per task con scadenza
  const TASK_COLOR = '#A855F7'  // viola
  const taskDots = useMemo(() => {
    const map = {}
    for (const t of tasks) {
      if (!t.due_date) continue
      if (!map[t.due_date]) map[t.due_date] = []
      if (map[t.due_date].length < 2) map[t.due_date].push(TASK_COLOR)
    }
    return map
  }, [tasks])

  // Count events per day for badge
  const eventCounts = useMemo(() => {
    const map = {}
    for (const ev of events) {
      map[ev.date] = (map[ev.date] || 0) + 1
    }
    return map
  }, [events])

  return (
    <div
      className="overflow-hidden"
      style={{
        borderRadius: '20px',
        background: '#FFFFFF',
        boxShadow: '0 2px 16px rgba(9,132,227,0.08), 0 1px 3px rgba(0,0,0,0.04)',
        border: '1px solid rgba(9,132,227,0.08)',
      }}
    >
      {/* Month header with gradient accent */}
      <div
        className="px-5 py-4"
        style={{
          background: 'linear-gradient(135deg, rgba(9,132,227,0.06) 0%, rgba(116,185,255,0.06) 100%)',
          borderBottom: '1px solid rgba(9,132,227,0.08)',
        }}
      >
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onPrev}
            className="flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200 active:scale-90"
            style={{ background: CAL_BG, color: CAL_COLOR }}
            aria-label="Mese precedente"
          >
            <ChevronLeft size={18} strokeWidth={2.5} />
          </button>

          <h3
            className="text-lg font-bold capitalize"
            style={{ color: '#2D3436', letterSpacing: '-0.3px' }}
          >
            {formatMonthYear(year, month)}
          </h3>

          <button
            type="button"
            onClick={onNext}
            className="flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200 active:scale-90"
            style={{ background: CAL_BG, color: CAL_COLOR }}
            aria-label="Mese successivo"
          >
            <ChevronRight size={18} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* Calendar body */}
      <div className="px-3 pt-3 pb-3">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 mb-1">
          {WEEKDAYS_SHORT.map((wd, i) => (
            <div
              key={wd}
              className="text-center text-[10px] font-bold uppercase tracking-widest py-2"
              style={{
                color: i >= 5 ? CAL_COLOR : '#B2BEC3',
              }}
            >
              {wd}
            </div>
          ))}
        </div>

        {/* Day cells grid */}
        <div className="grid grid-cols-7 gap-[3px]">
          {grid.map((cell, idx) => {
            const isSelected = cell.date === selectedDate
            const dots = eventDots[cell.date] || []
            const tDots = taskDots[cell.date] || []
            const count = eventCounts[cell.date] || 0
            const colIndex = idx % 7  // 0=Lun ... 5=Sab, 6=Dom
            const isWeekend = colIndex >= 5

            return (
              <button
                key={cell.date}
                type="button"
                onClick={() => onDayClick(cell.date)}
                className="relative flex flex-col items-center justify-center transition-all duration-200 active:scale-95"
                style={{
                  minHeight: '48px',
                  borderRadius: '14px',
                  opacity: cell.isCurrentMonth ? 1 : 0.25,
                  color: isSelected ? '#FFFFFF'
                    : cell.isToday ? CAL_COLOR
                    : isWeekend && cell.isCurrentMonth ? CAL_COLOR
                    : cell.isCurrentMonth ? '#2D3436'
                    : '#B2BEC3',
                  fontWeight: cell.isToday || isSelected ? 700 : isWeekend ? 600 : 500,
                  background: isSelected
                    ? CAL_GRADIENT
                    : cell.isToday
                    ? CAL_BG
                    : 'transparent',
                  boxShadow: isSelected
                    ? '0 4px 14px rgba(9,132,227,0.35)'
                    : 'none',
                  transform: isSelected ? 'scale(1.08)' : 'scale(1)',
                }}
              >
                {/* Today ring indicator */}
                {cell.isToday && !isSelected && (
                  <div
                    className="absolute inset-[3px] rounded-xl pointer-events-none"
                    style={{
                      border: `2px solid ${CAL_COLOR}`,
                      opacity: 0.35,
                    }}
                  />
                )}

                <span className="text-sm leading-none">{cell.day}</span>

                {/* Event dots */}
                {dots.length > 0 && (
                  <div className="flex gap-[3px] mt-1.5">
                    {dots.map((color, i) => (
                      <span
                        key={i}
                        className="rounded-full"
                        style={{
                          width: '5px',
                          height: '5px',
                          backgroundColor: isSelected ? 'rgba(255,255,255,0.85)' : color,
                          boxShadow: isSelected ? 'none' : `0 0 6px ${color}50`,
                        }}
                      />
                    ))}
                  </div>
                )}

                {/* Task squares (viola) */}
                {tDots.length > 0 && (
                  <div className="flex gap-[3px] mt-0.5">
                    {tDots.map((color, i) => (
                      <span
                        key={"t" + i}
                        style={{
                          width: '5px',
                          height: '5px',
                          borderRadius: '1.5px',
                          backgroundColor: isSelected ? 'rgba(255,255,255,0.85)' : color,
                          boxShadow: isSelected ? 'none' : '0 0 6px ' + color + '50',
                        }}
                      />
                    ))}
                  </div>
                )}

                {/* Event count badge for 3+ events */}
                {count >= 3 && !isSelected && (
                  <div
                    className="absolute -top-0.5 -right-0.5 flex items-center justify-center rounded-full text-white text-[8px] font-bold"
                    style={{
                      width: '16px',
                      height: '16px',
                      background: CAL_GRADIENT,
                      boxShadow: '0 2px 6px rgba(9,132,227,0.3)',
                    }}
                  >
                    {count}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
})
