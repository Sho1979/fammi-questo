/**
 * Tests for EventForm.jsx
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'

import EventForm from './EventForm.jsx'

const members = [
  { id: 'm1', name: 'Papà', role: 'parent', icon: '👨' },
  { id: 'm2', name: 'Luca', role: 'child', icon: '👦' },
]

const currentMember = members[0]

describe('EventForm', () => {
  it('renders title input and action buttons', () => {
    const { container } = render(
      <EventForm members={members} currentMember={currentMember} onSave={() => {}} onClose={() => {}} />
    )
    const titleInput = container.querySelector('input[type="text"]')
    expect(titleInput).toBeTruthy()
    expect(container.textContent).toContain('Salva')
    expect(container.textContent).toContain('Annulla')
  })

  it('renders category picker with event categories', () => {
    const { container } = render(
      <EventForm members={members} currentMember={currentMember} onSave={() => {}} onClose={() => {}} />
    )
    expect(container.textContent).toContain('Sport')
    expect(container.textContent).toContain('Scuola')
    expect(container.textContent).toContain('Medico')
  })

  it('renders time inputs', () => {
    const { container } = render(
      <EventForm members={members} currentMember={currentMember} onSave={() => {}} onClose={() => {}} />
    )
    const timeInputs = container.querySelectorAll('input[type="time"]')
    expect(timeInputs).toHaveLength(2)
  })

  it('shows validation error when title is empty', async () => {
    const onSave = vi.fn()
    const { container } = render(
      <EventForm members={members} currentMember={currentMember} onSave={onSave} onClose={() => {}} />
    )
    const saveBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Salva'))
    fireEvent.click(saveBtn)
    expect(container.textContent).toContain('Inserisci un titolo')
    expect(onSave).not.toHaveBeenCalled()
  })

  it('calls onClose when Annulla is clicked', () => {
    const onClose = vi.fn()
    const { container } = render(
      <EventForm members={members} currentMember={currentMember} onSave={() => {}} onClose={onClose} />
    )
    const cancelBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Annulla'))
    fireEvent.click(cancelBtn)
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onSave with correct data on valid submit', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const { container } = render(
      <EventForm members={members} currentMember={currentMember} onSave={onSave} onClose={() => {}} selectedDate="2026-03-25" />
    )

    // Fill title
    const titleInput = container.querySelector('input[type="text"]')
    fireEvent.change(titleInput, { target: { value: 'Partita calcio' } })

    // Click save
    const saveBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Salva'))
    fireEvent.click(saveBtn)

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Partita calcio',
        date: '2026-03-25',
        person_id: 'm1',
      })
    )
  })

  it('pre-fills fields in edit mode', () => {
    const existingEvent = {
      title: 'Danza',
      date: '2026-03-20',
      time_start: '17:00',
      time_end: '18:30',
      category: 'sport',
      person_id: 'm2',
      note: 'Sala grande',
    }
    const { container } = render(
      <EventForm members={members} currentMember={currentMember} onSave={() => {}} onClose={() => {}} event={existingEvent} />
    )
    const titleInput = container.querySelector('input[type="text"]')
    expect(titleInput.value).toBe('Danza')
    expect(container.textContent).toContain('Aggiorna')
  })

  it('renders recurrence picker only for new events', () => {
    const { container } = render(
      <EventForm members={members} currentMember={currentMember} onSave={() => {}} onClose={() => {}} />
    )
    expect(container.textContent).toContain('Ripeti')
    expect(container.textContent).toContain('Ogni settimana')
  })

  it('hides recurrence picker in edit mode', () => {
    const existingEvent = { title: 'Test', date: '2026-03-20' }
    const { container } = render(
      <EventForm members={members} currentMember={currentMember} onSave={() => {}} onClose={() => {}} event={existingEvent} />
    )
    expect(container.textContent).not.toContain('Ripeti')
  })

  it('renders logistics section with add button', () => {
    const { container } = render(
      <EventForm members={members} currentMember={currentMember} onSave={() => {}} onClose={() => {}} />
    )
    expect(container.textContent).toContain('Logistica')
    expect(container.textContent).toContain('Aggiungi')
  })
})
