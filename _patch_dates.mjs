import { readFileSync, writeFileSync } from 'fs'

const file = 'src/lib/dates.js'
let content = readFileSync(file, 'utf8')

const newHelpers = `
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

`

const marker = '// ─── Calendar grid utilities (R2)'
if (content.includes(marker)) {
  content = content.replace(marker, newHelpers + marker)
  writeFileSync(file, content, 'utf8')
  console.log('OK: helpers inserted before calendar grid section')
} else {
  console.log('ERROR: marker not found')
}
