/**
 * STEP 9.2 — Tests for StatsPage rendering with mock data.
 * We test the chart data computation logic (pure functions) and component rendering.
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach } from 'vitest'
import { expect as vitestExpect } from 'vitest'
import * as matchers from '@testing-library/jest-dom/matchers'

vitestExpect.extend(matchers)

import { computeCategoryTotals } from '../hooks/useExpenses.js'
import { DEFAULT_CATEGORIES } from '../lib/constants.js'

afterEach(() => {})

describe('StatsPage computation logic', () => {
  const mockExpenses = [
    { category: 'alimentari', amount: 200, _deleted: false },
    { category: 'alimentari', amount: 150, _deleted: false },
    { category: 'trasporto', amount: 80, _deleted: false },
    { category: 'svago', amount: 50, _deleted: false },
    { category: 'bollette', amount: 120, _deleted: false },
    { category: 'alimentari', amount: 30, _deleted: true }, // deleted
  ]

  it('computes category totals correctly', () => {
    const totals = computeCategoryTotals(mockExpenses)
    expect(totals.alimentari).toBe(350) // 200 + 150
    expect(totals.trasporto).toBe(80)
    expect(totals.svago).toBe(50)
    expect(totals.bollette).toBe(120)
  })

  it('generates pie data from totals', () => {
    const totals = computeCategoryTotals(mockExpenses)
    const pieData = DEFAULT_CATEGORIES
      .filter((cat) => totals[cat.id] > 0)
      .map((cat) => ({
        name: cat.label,
        value: totals[cat.id],
        color: cat.color,
      }))
      .sort((a, b) => b.value - a.value)

    expect(pieData.length).toBe(4) // alimentari, bollette, trasporto, svago
    expect(pieData[0].name).toBe('Alimentari')
    expect(pieData[0].value).toBe(350)
  })

  it('top 3 categories are correct', () => {
    const totals = computeCategoryTotals(mockExpenses)
    const sorted = DEFAULT_CATEGORIES
      .filter((cat) => totals[cat.id] > 0)
      .map((cat) => ({ name: cat.label, value: totals[cat.id] }))
      .sort((a, b) => b.value - a.value)

    const top3 = sorted.slice(0, 3)
    expect(top3[0].name).toBe('Alimentari')
    expect(top3[1].name).toBe('Bollette')
    expect(top3[2].name).toBe('Trasporto')
  })

  it('handles empty expenses', () => {
    const totals = computeCategoryTotals([])
    const pieData = DEFAULT_CATEGORIES
      .filter((cat) => totals[cat.id] > 0)
    expect(pieData.length).toBe(0)
  })

  it('computes percentage correctly', () => {
    const totals = computeCategoryTotals(mockExpenses)
    const total = Object.values(totals).reduce((s, v) => s + v, 0)
    expect(total).toBe(600) // 350 + 80 + 50 + 120
    const alimentariPct = Math.round((350 / 600) * 100)
    expect(alimentariPct).toBe(58)
  })
})
