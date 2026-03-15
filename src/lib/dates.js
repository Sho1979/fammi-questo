/**
 * Date utilities â€” all output in Italian.
 * No external date lib (stack-compliant).
 */

const MONTHS_FULL = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
]

const MONTHS_SHORT = [
  'gen', 'feb', 'mar', 'apr', 'mag', 'giu',
  'lug', 'ago', 'set', 'ott', 'nov', 'dic',
]

const WEEKDAYS = [
  'Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato',
]

function toDate(value) {
  if (value instanceof Date) return value
  if (typeof value === 'string') return new Date(value)
  return new Date(NaN)
}

/**
 * @param {string} isoString - ISO 8601 date (or date-time)
 * @returns {string} e.g. "6 marzo 2026"
 */
export function formatDate(isoString) {
  const d = toDate(isoString)
  if (Number.isNaN(d.getTime())) return ''
  const day = d.getDate()
  const month = MONTHS_FULL[d.getMonth()]
  const year = d.getFullYear()
  return `${day} ${month} ${year}`
}

/**
 * @param {string} isoString - ISO 8601 date (or date-time)
 * @returns {string} e.g. "6 mar"
 */
export function formatDateShort(isoString) {
  const d = toDate(isoString)
  if (Number.isNaN(d.getTime())) return ''
  const day = d.getDate()
  const month = MONTHS_SHORT[d.getMonth()]
  return `${day} ${month}`
}

/**
 * @param {string} isoString - ISO 8601 date (or date-time)
 * @returns {string} e.g. "Venerdì"
 */
export function formatWeekday(isoString) {
  const d = toDate(isoString)
  if (Number.isNaN(d.getTime())) return ''
  return WEEKDAYS[d.getDay()]
}

/**
 * @param {string} yyyy_mm - "YYYY-MM"
 * @returns {{ start: string, end: string }} ISO date strings (start of first day, end of last day in month)
 */
export function getMonthRange(yyyy_mm) {
  const [y, m] = yyyy_mm.split('-').map(Number)
  if (!y || !m || m < 1 || m > 12) return { start: '', end: '' }
  const lastDay = new Date(y, m, 0).getDate()
  const pad = (n) => String(n).padStart(2, '0')
  return {
    start: `${y}-${pad(m)}-01`,
    end: `${y}-${pad(m)}-${pad(lastDay)}`,
  }
}

/**
 * @param {Date|string} date - date or ISO string
 * @returns {{ monday: string, sunday: string }} ISO date strings for week (Monâ€“Sun)
 */
function toYYYYMMDD(d) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function getWeekRange(date) {
  const d = toDate(date)
  if (Number.isNaN(d.getTime())) return { monday: '', sunday: '' }
  const day = d.getDay()
  // Sunday = 0 â†’ offset to Monday = 0: subtract (day - 1), but if day === 0 then -6
  const toMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(d)
  monday.setDate(d.getDate() + toMonday)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return {
    monday: toYYYYMMDD(monday),
    sunday: toYYYYMMDD(sunday),
  }
}

/**
 * @param {string} isoString - ISO 8601 date (or date-time)
 * @returns {boolean}
 */
export function isToday(isoString) {
  const d = toDate(isoString)
  if (Number.isNaN(d.getTime())) return false
  const today = new Date()
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  )
}


/**
 * Get array of 7 days (Mon-Sun) for the week containing the given date.
 * @param {string} dateStr - ISO date string 'YYYY-MM-DD'
 * @returns {string[]} Array of 7 ISO date strings
 */
export function getWeekDays(dateStr) {
  const d = toDate(dateStr)
  if (Number.isNaN(d.getTime())) return []
  const day = d.getDay()
  const toMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(d)
  monday.setDate(d.getDate() + toMonday)
  const days = []
  for (let i = 0; i < 7; i++) {
    const dd = new Date(monday)
    dd.setDate(monday.getDate() + i)
    days.push(toYYYYMMDD(dd))
  }
  return days
}

/**
 * Short day label: "Lun 12" format
 * @param {string} isoString
 * @returns {string}
 */
export function formatDayShort(isoString) {
  const d = toDate(isoString)
  if (Number.isNaN(d.getTime())) return ''
  const WDAYS = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab']
  return WDAYS[d.getDay()] + ' ' + d.getDate()
}

/**
 * Navigate date by offset days.
 * @param {string} dateStr - ISO date 'YYYY-MM-DD'
 * @param {number} offset - days to add (negative = subtract)
 * @returns {string} ISO date string
 */
export function addDays(dateStr, offset) {
  const d = toDate(dateStr)
  d.setDate(d.getDate() + offset)
  return toYYYYMMDD(d)
}

// â”€â”€â”€ Calendar grid utilities (R2) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Generate the calendar grid for a given month.
 * Returns a flat array of { date: 'YYYY-MM-DD', day: number, isCurrentMonth: boolean, isToday: boolean }.
 * Starts from Monday. Pads with previous/next month days.
 * @param {number} year
 * @param {number} month - 0-indexed (0=Jan)
 * @returns {Array<{ date: string, day: number, isCurrentMonth: boolean, isToday: boolean }>}
 */
export function getCalendarGrid(year, month) {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const daysInMonth = lastDay.getDate()

  // Day of week for 1st (0=Sun â†’ shift to Mon=0)
  let startDow = firstDay.getDay() - 1
  if (startDow < 0) startDow = 6 // Sunday â†’ 6

  const grid = []
  const todayStr = toYYYYMMDD(new Date())

  // Previous month padding
  const prevMonthLast = new Date(year, month, 0)
  const prevDays = prevMonthLast.getDate()
  for (let i = startDow - 1; i >= 0; i--) {
    const d = prevDays - i
    const date = toYYYYMMDD(new Date(year, month - 1, d))
    grid.push({ date, day: d, isCurrentMonth: false, isToday: date === todayStr })
  }

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    const date = toYYYYMMDD(new Date(year, month, d))
    grid.push({ date, day: d, isCurrentMonth: true, isToday: date === todayStr })
  }

  // Next month padding (fill to complete last week row)
  const remaining = 7 - (grid.length % 7)
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      const date = toYYYYMMDD(new Date(year, month + 1, d))
      grid.push({ date, day: d, isCurrentMonth: false, isToday: date === todayStr })
    }
  }

  return grid
}

/**
 * Format month name + year in Italian. E.g. "Marzo 2026"
 * @param {number} year
 * @param {number} month - 0-indexed
 * @returns {string}
 */
export function formatMonthYear(year, month) {
  const name = MONTHS_FULL[month]
  return `${name.charAt(0).toUpperCase() + name.slice(1)} ${year}`
}

/**
 * Format time string HH:MM â†’ "14:30" (pass-through, no conversion needed).
 * Returns '' if falsy.
 */
export function formatTime(time) {
  return time || ''
}
