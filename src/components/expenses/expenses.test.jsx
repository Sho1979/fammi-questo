/**
 * STEP 7.7 — Tests for expense components (CategoryPicker, ExpenseForm, ExpenseCard, ExpenseList).
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { expect as vitestExpect } from 'vitest'
import * as matchers from '@testing-library/jest-dom/matchers'

vitestExpect.extend(matchers)

import CategoryPicker from './CategoryPicker.jsx'
import ExpenseForm from './ExpenseForm.jsx'
import ExpenseCard from './ExpenseCard.jsx'
import ExpenseList from './ExpenseList.jsx'

afterEach(() => { cleanup() })

const fakeMembers = [
  { id: 'm1', name: 'Papà', icon: '👨', color: '#4A90D9' },
  { id: 'm2', name: 'Mamma', icon: '👩', color: '#E91E63' },
]

// ===== CategoryPicker =====

describe('CategoryPicker', () => {
  it('renders 16 category buttons', () => {
    const { container } = render(<CategoryPicker value="" onChange={() => {}} />)
    const buttons = container.querySelectorAll('button')
    expect(buttons.length).toBe(16)
  })

  it('renders category labels', () => {
    const { container } = render(<CategoryPicker value="" onChange={() => {}} />)
    expect(container.textContent).toContain('Alimentari')
    expect(container.textContent).toContain('Trasporto')
    expect(container.textContent).toContain('Svago')
  })

  it('calls onChange when category clicked', () => {
    const onChange = vi.fn()
    const { container } = render(<CategoryPicker value="" onChange={onChange} />)
    const buttons = container.querySelectorAll('button')
    fireEvent.click(buttons[0]) // Alimentari
    expect(onChange).toHaveBeenCalledWith('alimentari')
  })

  it('highlights selected category', () => {
    const { container } = render(<CategoryPicker value="alimentari" onChange={() => {}} />)
    const buttons = container.querySelectorAll('button')
    expect(buttons[0].className).toContain('ring-2')
  })
})

// ===== ExpenseForm =====

describe('ExpenseForm', () => {
  const defaultProps = {
    members: fakeMembers,
    currentMember: fakeMembers[0],
    onSave: vi.fn(),
    expense: null,
    onClose: vi.fn(),
  }

  it('renders amount input', () => {
    const { container } = render(<ExpenseForm {...defaultProps} />)
    expect(container.textContent).toContain('Importo')
    const input = container.querySelector('input[inputmode="decimal"]')
    expect(input).not.toBeNull()
  })

  it('renders category picker', () => {
    const { container } = render(<ExpenseForm {...defaultProps} />)
    expect(container.textContent).toContain('Categoria')
    expect(container.textContent).toContain('Alimentari')
  })

  it('shows validation error if no amount', async () => {
    const onSave = vi.fn()
    const { container } = render(<ExpenseForm {...defaultProps} onSave={onSave} />)
    const saveBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Salva'))
    fireEvent.click(saveBtn)
    await waitFor(() => {
      expect(container.textContent).toContain('importo valido')
    })
    expect(onSave).not.toHaveBeenCalled()
  })

  it('shows validation error if no category', async () => {
    const onSave = vi.fn()
    const { container } = render(<ExpenseForm {...defaultProps} onSave={onSave} />)
    // Set amount
    const amountInput = container.querySelector('input[inputmode="decimal"]')
    fireEvent.change(amountInput, { target: { value: '25' } })
    const saveBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Salva'))
    fireEvent.click(saveBtn)
    await waitFor(() => {
      expect(container.textContent).toContain('Seleziona una categoria')
    })
  })

  it('renders "Aggiorna" in edit mode', () => {
    const expense = { amount: 10, category: 'altro', note: '', person_id: 'm1', date: '2026-03-07' }
    const { container } = render(<ExpenseForm {...defaultProps} expense={expense} />)
    expect(container.textContent).toContain('Aggiorna')
  })

  it('calls onClose when Annulla clicked', () => {
    const onClose = vi.fn()
    const { container } = render(<ExpenseForm {...defaultProps} onClose={onClose} />)
    const cancelBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Annulla'))
    fireEvent.click(cancelBtn)
    expect(onClose).toHaveBeenCalled()
  })

  it('renders PersonPicker when multiple members', () => {
    const { container } = render(<ExpenseForm {...defaultProps} />)
    expect(container.textContent).toContain('Chi ha speso')
  })

  it('hides PersonPicker when single member', () => {
    const { container } = render(
      <ExpenseForm {...defaultProps} members={[fakeMembers[0]]} />
    )
    expect(container.textContent).not.toContain('Chi ha speso')
  })
})

// ===== ExpenseCard =====

describe('ExpenseCard', () => {
  const expense = {
    id: 'e1',
    amount: 35.5,
    category: 'alimentari',
    note: 'Spesa Esselunga',
    person_id: 'm1',
    date: '2026-03-07',
  }

  it('renders expense note', () => {
    const { container } = render(
      <ExpenseCard expense={expense} members={fakeMembers} onEdit={() => {}} onDelete={() => {}} />
    )
    expect(container.textContent).toContain('Spesa Esselunga')
  })

  it('renders formatted amount', () => {
    const { container } = render(
      <ExpenseCard expense={expense} members={fakeMembers} onEdit={() => {}} onDelete={() => {}} />
    )
    // Intl formats vary, but should contain 35,50 or 35.50
    expect(container.textContent).toMatch(/35[,.]50/)
  })

  it('renders category icon', () => {
    const { container } = render(
      <ExpenseCard expense={expense} members={fakeMembers} onEdit={() => {}} onDelete={() => {}} />
    )
    expect(container.textContent).toContain('🛒')
  })

  it('renders person name', () => {
    const { container } = render(
      <ExpenseCard expense={expense} members={fakeMembers} onEdit={() => {}} onDelete={() => {}} />
    )
    expect(container.textContent).toContain('Papà')
  })

  it('calls onEdit when card clicked', () => {
    const onEdit = vi.fn()
    const { container } = render(
      <ExpenseCard expense={expense} members={fakeMembers} onEdit={onEdit} onDelete={() => {}} />
    )
    // Click on the note area (first button with note text)
    const editBtn = container.querySelector('[aria-label*="Modifica"]')
    fireEvent.click(editBtn)
    expect(onEdit).toHaveBeenCalledWith(expense)
  })

  it('calls onDelete when delete button clicked', () => {
    const onDelete = vi.fn()
    const { container } = render(
      <ExpenseCard expense={expense} members={fakeMembers} onEdit={() => {}} onDelete={onDelete} />
    )
    const deleteBtn = container.querySelector('[aria-label="Elimina spesa"]')
    fireEvent.click(deleteBtn)
    expect(onDelete).toHaveBeenCalledWith('e1')
  })

  it('shows category label when no note', () => {
    const noNoteExpense = { ...expense, note: '' }
    const { container } = render(
      <ExpenseCard expense={noNoteExpense} members={fakeMembers} onEdit={() => {}} onDelete={() => {}} />
    )
    expect(container.textContent).toContain('Alimentari')
  })
})

// ===== ExpenseList =====

describe('ExpenseList', () => {
  const expenses = [
    { id: 'e1', amount: 20, category: 'alimentari', note: 'Spesa', person_id: 'm1', date: '2026-03-07' },
    { id: 'e2', amount: 15, category: 'trasporto', note: 'Benzina', person_id: 'm2', date: '2026-03-06' },
  ]

  const defaultProps = {
    expenses,
    members: fakeMembers,
    monthlyTotal: 35,
    currentMonth: '2026-03',
    onMonthChange: vi.fn(),
    onAdd: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
  }

  it('renders month label', () => {
    const { container } = render(<ExpenseList {...defaultProps} />)
    expect(container.textContent).toContain('Marzo 2026')
  })

  it('renders monthly total', () => {
    const { container } = render(<ExpenseList {...defaultProps} />)
    expect(container.textContent).toContain('Totale mese')
  })

  it('renders expense cards', () => {
    const { container } = render(<ExpenseList {...defaultProps} />)
    expect(container.textContent).toContain('Spesa')
    expect(container.textContent).toContain('Benzina')
  })

  it('shows empty state when no expenses', () => {
    const { container } = render(
      <ExpenseList {...defaultProps} expenses={[]} />
    )
    expect(container.textContent).toContain('Nessuna spesa')
  })

  it('calls onMonthChange when arrows clicked', () => {
    const onMonthChange = vi.fn()
    const { container } = render(
      <ExpenseList {...defaultProps} onMonthChange={onMonthChange} />
    )
    const prevBtn = container.querySelector('[aria-label="Mese precedente"]')
    fireEvent.click(prevBtn)
    expect(onMonthChange).toHaveBeenCalledWith('2026-02')
  })

  it('calls onAdd when FAB clicked', () => {
    const onAdd = vi.fn()
    const { container } = render(
      <ExpenseList {...defaultProps} onAdd={onAdd} />
    )
    const fab = container.querySelector('[aria-label="Aggiungi spesa"]')
    fireEvent.click(fab)
    expect(onAdd).toHaveBeenCalled()
  })
})
