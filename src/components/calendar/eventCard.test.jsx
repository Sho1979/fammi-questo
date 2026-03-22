/**
 * Tests for EventCard — renders event info, actions, and logistics.
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import EventCard from './EventCard.jsx'

const MEMBERS = [
  { id: 'm1', name: 'Mamma', icon: '👩', role: 'parent' },
  { id: 'm2', name: 'Luca', icon: '👦', role: 'child' },
]

const baseEvent = {
  id: 'e1',
  title: 'Partita calcio',
  date: '2026-03-25',
  time_start: '17:00',
  time_end: '18:30',
  category: 'sport',
  person_id: 'm2',
  note: 'Palestra via Roma',
  logistics: [],
}

describe('EventCard', () => {
  it('renders title and category icon', () => {
    const { container } = render(<EventCard event={baseEvent} members={MEMBERS} onEdit={vi.fn()} onDelete={vi.fn()} />)
    expect(container.textContent).toContain('Partita calcio')
    expect(container.textContent).toContain('⚽')
  })

  it('renders time range', () => {
    const { container } = render(<EventCard event={baseEvent} members={MEMBERS} onEdit={vi.fn()} onDelete={vi.fn()} />)
    expect(container.textContent).toContain('17:00')
    expect(container.textContent).toContain('18:30')
  })

  it('renders owner name', () => {
    const { container } = render(<EventCard event={baseEvent} members={MEMBERS} onEdit={vi.fn()} onDelete={vi.fn()} />)
    expect(container.textContent).toContain('Luca')
  })

  it('renders note', () => {
    const { container } = render(<EventCard event={baseEvent} members={MEMBERS} onEdit={vi.fn()} onDelete={vi.fn()} />)
    expect(container.textContent).toContain('Palestra via Roma')
  })

  it('renders "Tutti" for person_id=tutti', () => {
    const ev = { ...baseEvent, person_id: 'tutti' }
    const { container } = render(<EventCard event={ev} members={MEMBERS} onEdit={vi.fn()} onDelete={vi.fn()} />)
    expect(container.textContent).toContain('Tutti')
  })

  it('shows "Tutto il giorno" when no time_start', () => {
    const ev = { ...baseEvent, time_start: null, time_end: null }
    const { container } = render(<EventCard event={ev} members={MEMBERS} onEdit={vi.fn()} onDelete={vi.fn()} />)
    expect(container.textContent).toContain('Tutto il giorno')
  })

  it('calls onEdit when edit button clicked', () => {
    const onEdit = vi.fn()
    const { container } = render(<EventCard event={baseEvent} members={MEMBERS} onEdit={onEdit} onDelete={vi.fn()} />)
    fireEvent.click(container.querySelector('[aria-label="Modifica evento"]'))
    expect(onEdit).toHaveBeenCalledWith(baseEvent)
  })

  it('calls onDelete when delete button clicked', () => {
    const onDelete = vi.fn()
    const { container } = render(<EventCard event={baseEvent} members={MEMBERS} onEdit={vi.fn()} onDelete={onDelete} />)
    fireEvent.click(container.querySelector('[aria-label="Elimina evento"]'))
    expect(onDelete).toHaveBeenCalledWith('e1')
  })

  it('renders logistics badges', () => {
    const ev = {
      ...baseEvent,
      logistics: [{ role: 'porta', member_id: 'm1' }],
    }
    const { container } = render(<EventCard event={ev} members={MEMBERS} onEdit={vi.fn()} onDelete={vi.fn()} />)
    expect(container.textContent).toContain('Porta')
    expect(container.textContent).toContain('Mamma')
  })

  it('renders recurrence badge', () => {
    const ev = { ...baseEvent, recurrence_id: 'rec1' }
    const { container } = render(<EventCard event={ev} members={MEMBERS} onEdit={vi.fn()} onDelete={vi.fn()} />)
    expect(container.textContent).toContain('Ricorrente')
  })

  it('renders absence style for category=assenza', () => {
    const ev = { ...baseEvent, category: 'assenza', title: 'Mamma assente' }
    const { container } = render(<EventCard event={ev} members={MEMBERS} onEdit={vi.fn()} onDelete={vi.fn()} />)
    expect(container.textContent).toContain('🚫')
    expect(container.textContent).toContain('Mamma assente')
  })
})
