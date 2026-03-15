/**
 * Formatting utilities for currency and percentages.
 */

/**
 * @param {number} amount - numeric amount
 * @returns {string} e.g. "€ 45,50"
 */
export function formatCurrency(amount) {
  const n = Number(amount)
  if (Number.isNaN(n)) return '€ —'
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

/**
 * @param {number} value - numeric value (e.g. 0.73 or 73)
 * @returns {string} e.g. "73%" (integer, no decimals)
 */
export function formatPercent(value) {
  const n = Number(value)
  if (Number.isNaN(n)) return '—%'
  const percent = n <= 1 && n >= -1 ? Math.round(n * 100) : Math.round(n)
  return `${percent}%`
}
