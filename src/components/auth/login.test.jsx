/**
 * STEP 5.4 — Tests for MemberSelect and PinLogin.
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react'
import { expect as vitestExpect } from 'vitest'
import * as matchers from '@testing-library/jest-dom/matchers'

vitestExpect.extend(matchers)

import MemberSelect from './MemberSelect.jsx'
import PinLogin from './PinLogin.jsx'

afterEach(() => { cleanup() })

const fakeMembers = [
  { id: 'm1', name: 'Papà', icon: '👨', color: '#4A90D9' },
  { id: 'm2', name: 'Mamma', icon: '👩', color: '#E91E63' },
  { id: 'm3', name: 'Marco', icon: '👧', color: '#8BC34A' },
]

// ===== MemberSelect =====

describe('MemberSelect', () => {
  it('renders all member names', () => {
    const { container } = render(
      <MemberSelect members={fakeMembers} onSelect={() => {}} />
    )
    expect(container.textContent).toContain('Papà')
    expect(container.textContent).toContain('Mamma')
    expect(container.textContent).toContain('Marco')
  })

  it('renders "Chi sei?" heading', () => {
    render(<MemberSelect members={fakeMembers} onSelect={() => {}} />)
    expect(screen.getByText('Chi sei?')).toBeInTheDocument()
  })

  it('calls onSelect with member id on click', () => {
    const onSelect = vi.fn()
    const { container } = render(
      <MemberSelect members={fakeMembers} onSelect={onSelect} />
    )
    const buttons = container.querySelectorAll('button')
    fireEvent.click(buttons[1]) // Mamma
    expect(onSelect).toHaveBeenCalledWith('m2')
  })

  it('renders one button per member', () => {
    const { container } = render(
      <MemberSelect members={fakeMembers} onSelect={() => {}} />
    )
    const buttons = container.querySelectorAll('button')
    expect(buttons.length).toBe(3)
  })
})

// ===== PinLogin =====

describe('PinLogin', () => {
  const member = fakeMembers[0]

  it('renders member name', () => {
    const { container } = render(
      <PinLogin member={member} onLogin={vi.fn()} onBack={vi.fn()} />
    )
    expect(container.textContent).toContain('Papà')
  })

  it('renders numeric keypad (0-9)', () => {
    const { container } = render(
      <PinLogin member={member} onLogin={vi.fn()} onBack={vi.fn()} />
    )
    for (let i = 0; i <= 9; i++) {
      const btn = Array.from(container.querySelectorAll('button')).find(
        b => b.textContent.trim() === String(i)
      )
      expect(btn).toBeDefined()
    }
  })

  it('renders Entra button', () => {
    render(<PinLogin member={member} onLogin={vi.fn()} onBack={vi.fn()} />)
    expect(screen.getByText('Entra')).toBeInTheDocument()
  })

  it('shows error if PIN < 4 digits and submit', async () => {
    const { container } = render(
      <PinLogin member={member} onLogin={vi.fn()} onBack={vi.fn()} />
    )
    // Type 2 digits
    const btn1 = Array.from(container.querySelectorAll('button')).find(b => b.textContent.trim() === '1')
    fireEvent.click(btn1)
    fireEvent.click(btn1)

    // Submit (handleSubmit is async)
    await act(async () => {
      fireEvent.click(screen.getByText('Entra'))
    })
    expect(container.textContent).toContain('almeno 4 cifre')
  })

  it('calls onLogin with PIN when submitted', async () => {
    const onLogin = vi.fn().mockResolvedValue(true)
    const { container } = render(
      <PinLogin member={member} onLogin={onLogin} onBack={vi.fn()} />
    )

    // Type 4 digits: 1234
    const digits = ['1', '2', '3', '4']
    for (const d of digits) {
      const btn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.trim() === d)
      fireEvent.click(btn)
    }

    fireEvent.click(screen.getByText('Entra'))
    expect(onLogin).toHaveBeenCalledWith('1234')
  })

  it('calls onBack when back link clicked', () => {
    const onBack = vi.fn()
    render(<PinLogin member={member} onLogin={vi.fn()} onBack={onBack} />)
    fireEvent.click(screen.getByText('Torna alla selezione'))
    expect(onBack).toHaveBeenCalled()
  })

  it('delete button removes last digit', () => {
    const { container } = render(
      <PinLogin member={member} onLogin={vi.fn()} onBack={vi.fn()} />
    )
    // Type 3 digits
    const btn1 = Array.from(container.querySelectorAll('button')).find(b => b.textContent.trim() === '1')
    fireEvent.click(btn1)
    fireEvent.click(btn1)
    fireEvent.click(btn1)

    // Delete one
    const deleteBtn = container.querySelector('[aria-label="Cancella cifra"]')
    fireEvent.click(deleteBtn)

    // Check: 2 dots filled (3 - 1) using data-filled attribute
    const filledDots = container.querySelectorAll('[data-filled="true"]')
    expect(filledDots.length).toBe(2)
  })
})
