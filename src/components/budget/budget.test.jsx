/**
 * STEP 8.5 — Tests for BudgetOverview and BudgetSetup components.
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { expect as vitestExpect } from 'vitest'
import * as matchers from '@testing-library/jest-dom/matchers'

vitestExpect.extend(matchers)

import BudgetOverview from './BudgetOverview.jsx'
import BudgetSetup from './BudgetSetup.jsx'

afterEach(() => { cleanup() })

// ===== BudgetOverview =====

describe('BudgetOverview', () => {
  const defaultProps = {
    budget: 3000,
    spent: 750,
    remaining: 2250,
    percentage: 25,
    byCategory: [
      { id: 'alimentari', label: 'Alimentari', icon: '🛒', color: '#4CAF50', spent: 500 },
      { id: 'trasporto', label: 'Trasporto', icon: '🚗', color: '#2196F3', spent: 250 },
    ],
  }

  it('renders spent amount', () => {
    const { container } = render(<BudgetOverview {...defaultProps} />)
    expect(container.textContent).toMatch(/750/)
  })

  it('renders budget amount', () => {
    const { container } = render(<BudgetOverview {...defaultProps} />)
    expect(container.textContent).toMatch(/3[\.\s]?000/)
  })

  it('renders percentage', () => {
    const { container } = render(<BudgetOverview {...defaultProps} />)
    expect(container.textContent).toContain('25%')
  })

  it('renders progress bar', () => {
    const { container } = render(<BudgetOverview {...defaultProps} />)
    const bar = container.querySelector('[role="progressbar"]')
    expect(bar).not.toBeNull()
    expect(bar.getAttribute('aria-valuenow')).toBe('25')
  })

  it('uses green color for low percentage (<50%)', () => {
    const { container } = render(<BudgetOverview {...defaultProps} percentage={25} />)
    const bar = container.querySelector('[role="progressbar"]')
    expect(bar.className).toContain('bg-green')
  })

  it('uses yellow color for medium percentage (50-79%)', () => {
    const { container } = render(<BudgetOverview {...defaultProps} percentage={60} />)
    const bar = container.querySelector('[role="progressbar"]')
    expect(bar.className).toContain('bg-yellow')
  })

  it('uses red color for high percentage (>=80%)', () => {
    const { container } = render(<BudgetOverview {...defaultProps} percentage={90} />)
    const bar = container.querySelector('[role="progressbar"]')
    expect(bar.className).toContain('bg-red')
  })

  it('renders category breakdown', () => {
    const { container } = render(<BudgetOverview {...defaultProps} />)
    expect(container.textContent).toContain('Alimentari')
    expect(container.textContent).toContain('Trasporto')
    expect(container.textContent).toContain('Per categoria')
  })

  it('hides category breakdown when empty', () => {
    const { container } = render(<BudgetOverview {...defaultProps} byCategory={[]} />)
    expect(container.textContent).not.toContain('Per categoria')
  })
})

// ===== BudgetSetup =====

describe('BudgetSetup', () => {
  it('renders budget input', () => {
    const { container } = render(<BudgetSetup currentBudget={3000} onSave={vi.fn()} />)
    expect(container.textContent).toContain('Budget mensile')
    const input = container.querySelector('input[inputmode="decimal"]')
    expect(input).not.toBeNull()
  })

  it('pre-fills with current budget', () => {
    const { container } = render(<BudgetSetup currentBudget={3000} onSave={vi.fn()} />)
    const input = container.querySelector('input[inputmode="decimal"]')
    expect(input.value).toBe('3000')
  })

  it('renders save button', () => {
    const { container } = render(<BudgetSetup currentBudget={0} onSave={vi.fn()} />)
    expect(container.textContent).toContain('Salva')
  })

  it('calls onSave with parsed amount', async () => {
    const onSave = vi.fn().mockResolvedValue()
    const { container } = render(<BudgetSetup currentBudget={0} onSave={onSave} />)
    const input = container.querySelector('input[inputmode="decimal"]')
    fireEvent.change(input, { target: { value: '2500' } })
    const saveBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Salva'))
    fireEvent.click(saveBtn)
    expect(onSave).toHaveBeenCalledWith(2500)
  })

  it('does not call onSave with invalid input', () => {
    const onSave = vi.fn()
    const { container } = render(<BudgetSetup currentBudget={0} onSave={onSave} />)
    const saveBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Salva'))
    fireEvent.click(saveBtn)
    expect(onSave).not.toHaveBeenCalled()
  })
})
