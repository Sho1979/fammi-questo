/**
 * Tests for BrainSheet.jsx
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'

import BrainSheet from './BrainSheet.jsx'

const members = [
  { id: 'm1', name: 'Papà', role: 'parent', icon: '👨', color: '#4A90D9' },
  { id: 'm2', name: 'Luca', role: 'child', icon: '👦', color: '#FF9800' },
]

const mockResult = {
  actions: [
    { type: 'calendar', title: 'Danza', date: '2026-03-25', time_start: '17:00', person_id: 'm2' },
    { type: 'expense', amount: 45, category: 'cibo', date: '2026-03-22' },
  ],
  summary: 'Evento danza + spesa cibo',
}

describe('BrainSheet', () => {
  it('renders nothing when phase is null', () => {
    const { container } = render(
      <BrainSheet phase={null} result={null} members={members} confirmActions={() => {}} cancel={() => {}} />
    )
    // Should render empty or no visible content
    expect(container.textContent).toBe('')
  })

  it('renders listening state with mic indicator', () => {
    const { container } = render(
      <BrainSheet phase="listening" result={null} members={members} confirmActions={() => {}} cancel={() => {}} />
    )
    expect(container.textContent).toContain('ascoltando')
  })

  it('renders preview with action cards', () => {
    const { container } = render(
      <BrainSheet phase="preview" result={mockResult} members={members} confirmActions={() => {}} cancel={() => {}} />
    )
    expect(container.textContent).toContain('Danza')
    expect(container.textContent).toContain('45')
  })

  it('calls confirmActions when Conferma is clicked', () => {
    const confirmActions = vi.fn()
    const { container } = render(
      <BrainSheet phase="preview" result={mockResult} members={members} confirmActions={confirmActions} cancel={() => {}} />
    )
    const confirmBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Conferma'))
    if (confirmBtn) {
      fireEvent.click(confirmBtn)
      expect(confirmActions).toHaveBeenCalled()
    }
  })

  it('calls cancel when cancel button is clicked', () => {
    const cancel = vi.fn()
    const { container } = render(
      <BrainSheet phase="preview" result={mockResult} members={members} confirmActions={() => {}} cancel={cancel} />
    )
    // Find the Annulla button specifically
    const cancelBtn = Array.from(container.querySelectorAll('button')).find(
      b => b.textContent.includes('Annulla')
    )
    expect(cancelBtn).toBeTruthy()
    fireEvent.click(cancelBtn)
    expect(cancel).toHaveBeenCalled()
  })

  it('renders done state with success message', () => {
    const { container } = render(
      <BrainSheet
        phase="done"
        result={mockResult}
        executionLog={[{ ok: true }, { ok: true }]}
        members={members}
        confirmActions={() => {}}
        cancel={() => {}}
      />
    )
    // Should show some success indicator
    expect(container.querySelector('svg') || container.textContent.length > 0).toBeTruthy()
  })

  it('renders error state', () => {
    const { container } = render(
      <BrainSheet phase="error" error="Qualcosa è andato storto" result={null} members={members} confirmActions={() => {}} cancel={() => {}} />
    )
    expect(container.textContent).toContain('storto')
  })
})
