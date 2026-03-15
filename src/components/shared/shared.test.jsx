/**
 * STEP 3.9 — Tests for all shared components.
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import { expect as vitestExpect } from 'vitest'
import * as matchers from '@testing-library/jest-dom/matchers'

vitestExpect.extend(matchers)

import Toast from './Toast.jsx'
import Modal from './Modal.jsx'
import ConfirmDialog from './ConfirmDialog.jsx'
import PersonBadge from './PersonBadge.jsx'
import PersonPicker from './PersonPicker.jsx'
import DatePicker from './DatePicker.jsx'
import EmptyState from './EmptyState.jsx'
import LoadingSpinner from './LoadingSpinner.jsx'

// --- Test data ---

const fakeMember = { id: 'm1', name: 'Papà', icon: '👨', color: '#4A90D9' }
const fakeMembers = [
  { id: 'm1', name: 'Papà', icon: '👨', color: '#4A90D9' },
  { id: 'm2', name: 'Mamma', icon: '👩', color: '#E91E63' },
  { id: 'm3', name: 'Marco', icon: '👧', color: '#8BC34A' },
]

afterEach(() => {
  cleanup()
})

// ===== Toast =====

describe('Toast', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('renders message', () => {
    render(<Toast message="Spesa aggiunta" />)
    expect(screen.getByText('Spesa aggiunta')).toBeInTheDocument()
  })

  it('renders action button when provided', () => {
    render(<Toast message="Eliminata" action="Annulla" onAction={() => {}} />)
    expect(screen.getByText('Annulla')).toBeInTheDocument()
  })

  it('auto-dismisses after duration', () => {
    const onClose = vi.fn()
    render(<Toast message="Test" duration={2000} onClose={onClose} />)
    expect(screen.getByText('Test')).toBeInTheDocument()

    act(() => { vi.advanceTimersByTime(2000) })
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onAction when action button clicked', () => {
    const onAction = vi.fn()
    const onClose = vi.fn()
    render(<Toast message="Test" action="Undo" onAction={onAction} onClose={onClose} />)
    fireEvent.click(screen.getByText('Undo'))
    expect(onAction).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('close button dismisses toast', () => {
    const onClose = vi.fn()
    render(<Toast message="Sola toast" onClose={onClose} />)
    const closeButtons = screen.getAllByLabelText('Chiudi')
    fireEvent.click(closeButtons[0])
    expect(onClose).toHaveBeenCalled()
  })

  it('has role="alert" for accessibility', () => {
    render(<Toast message="Alert unico" />)
    const alerts = screen.getAllByRole('alert')
    expect(alerts.length).toBeGreaterThanOrEqual(1)
  })
})

// ===== Modal =====

describe('Modal', () => {
  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <Modal isOpen={false} onClose={() => {}} title="HiddenTitle">Content</Modal>
    )
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })

  it('renders title and children when open', () => {
    render(<Modal isOpen={true} onClose={() => {}} title="Modifica Spesa">Form here</Modal>)
    expect(screen.getByText('Modifica Spesa')).toBeInTheDocument()
    expect(screen.getByText('Form here')).toBeInTheDocument()
  })

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn()
    render(<Modal isOpen={true} onClose={onClose} title="ModalX">Content</Modal>)
    // Get the close button inside the dialog
    const dialog = screen.getByRole('dialog')
    const closeBtn = dialog.querySelector('[aria-label="Chiudi"]')
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose on Escape key', () => {
    const onClose = vi.fn()
    render(<Modal isOpen={true} onClose={onClose} title="EscTest">Content</Modal>)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when overlay clicked', () => {
    const onClose = vi.fn()
    render(<Modal isOpen={true} onClose={onClose} title="OverlayTest">Content</Modal>)
    const overlay = document.querySelector('[aria-hidden="true"]')
    fireEvent.click(overlay)
    expect(onClose).toHaveBeenCalled()
  })

  it('has dialog role and aria-modal', () => {
    render(<Modal isOpen={true} onClose={() => {}} title="AriaTest">C</Modal>)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })
})

// ===== ConfirmDialog =====

describe('ConfirmDialog', () => {
  it('renders title and message', () => {
    render(
      <ConfirmDialog
        isOpen={true}
        onConfirm={() => {}}
        onCancel={() => {}}
        title="Elimina?"
        message="Questa azione è irreversibile."
      />
    )
    expect(screen.getByText('Elimina?')).toBeInTheDocument()
    expect(screen.getByText('Questa azione è irreversibile.')).toBeInTheDocument()
  })

  it('calls onConfirm when confirm button clicked', () => {
    const onConfirm = vi.fn()
    render(
      <ConfirmDialog
        isOpen={true}
        onConfirm={onConfirm}
        onCancel={() => {}}
        title="ConfirmX"
        message="Y"
        confirmLabel="Elimina"
      />
    )
    fireEvent.click(screen.getByText('Elimina'))
    expect(onConfirm).toHaveBeenCalled()
  })

  it('calls onCancel when cancel button clicked', () => {
    const onCancel = vi.fn()
    render(
      <ConfirmDialog
        isOpen={true}
        onConfirm={() => {}}
        onCancel={onCancel}
        title="CancelX"
        message="Y"
      />
    )
    fireEvent.click(screen.getByText('Annulla'))
    expect(onCancel).toHaveBeenCalled()
  })

  it('default confirm label is Conferma', () => {
    render(
      <ConfirmDialog
        isOpen={true}
        onConfirm={() => {}}
        onCancel={() => {}}
        title="DefaultX"
        message="Y"
      />
    )
    expect(screen.getByText('Conferma')).toBeInTheDocument()
  })

  it('renders nothing when not open', () => {
    const { container } = render(
      <ConfirmDialog
        isOpen={false}
        onConfirm={() => {}}
        onCancel={() => {}}
        title="Nope"
        message="Hidden"
      />
    )
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })
})

// ===== PersonBadge =====

describe('PersonBadge', () => {
  it('renders member icon emoji', () => {
    const { container } = render(<PersonBadge member={fakeMember} />)
    expect(container.textContent).toContain('👨')
  })

  it('shows name for md size (default)', () => {
    const { container } = render(<PersonBadge member={fakeMember} />)
    expect(container.textContent).toContain('Papà')
  })

  it('hides name for sm size', () => {
    const { container } = render(<PersonBadge member={fakeMember} size="sm" />)
    // sm should only show icon, not name
    const spans = container.querySelectorAll('span')
    const nameSpans = Array.from(spans).filter(s => s.textContent === 'Papà')
    // The icon emoji is in a span, but the name text should not be rendered
    const hasVisibleName = container.querySelector('.text-xs')
    expect(hasVisibleName).toBeNull()
  })

  it('shows name for lg size', () => {
    const { container } = render(<PersonBadge member={fakeMember} size="lg" />)
    expect(container.textContent).toContain('Papà')
  })

  it('applies member color to border', () => {
    const { container } = render(<PersonBadge member={fakeMember} />)
    const circle = container.querySelector('[aria-label="Papà"]')
    // jsdom normalizes hex to rgb
    expect(circle.style.borderColor).toBe('rgb(74, 144, 217)')
  })
})

// ===== PersonPicker =====

describe('PersonPicker', () => {
  it('renders all members', () => {
    const { container } = render(
      <PersonPicker members={fakeMembers} value="m1" onChange={() => {}} />
    )
    expect(container.textContent).toContain('Papà')
    expect(container.textContent).toContain('Mamma')
    expect(container.textContent).toContain('Marco')
  })

  it('selected member button has ring styling', () => {
    const { container } = render(
      <PersonPicker members={fakeMembers} value="m2" onChange={() => {}} />
    )
    const buttons = container.querySelectorAll('button[role="radio"]')
    const selectedBtn = Array.from(buttons).find(b => b.getAttribute('aria-checked') === 'true')
    expect(selectedBtn).toBeDefined()
    expect(selectedBtn.className).toContain('ring-2')
  })

  it('unselected members have aria-checked false', () => {
    const { container } = render(
      <PersonPicker members={fakeMembers} value="m2" onChange={() => {}} />
    )
    const buttons = container.querySelectorAll('button[role="radio"]')
    const unchecked = Array.from(buttons).filter(b => b.getAttribute('aria-checked') === 'false')
    expect(unchecked.length).toBe(2)
  })

  it('calls onChange with member id on click', () => {
    const onChange = vi.fn()
    const { container } = render(
      <PersonPicker members={fakeMembers} value="m1" onChange={onChange} />
    )
    const buttons = container.querySelectorAll('button[role="radio"]')
    // Third button is Marco (m3)
    fireEvent.click(buttons[2])
    expect(onChange).toHaveBeenCalledWith('m3')
  })

  it('has radiogroup role', () => {
    const { container } = render(
      <PersonPicker members={fakeMembers} value="m1" onChange={() => {}} />
    )
    expect(container.querySelector('[role="radiogroup"]')).not.toBeNull()
  })
})

// ===== DatePicker =====

describe('DatePicker', () => {
  it('renders label', () => {
    render(<DatePicker value="2026-03-07" onChange={() => {}} label="Data spesa" />)
    expect(screen.getByText('Data spesa')).toBeInTheDocument()
  })

  it('uses default label "Data"', () => {
    render(<DatePicker value="2026-03-07" onChange={() => {}} />)
    expect(screen.getByText('Data')).toBeInTheDocument()
  })

  it('renders input with value', () => {
    const { container } = render(<DatePicker value="2026-03-07" onChange={() => {}} />)
    const input = container.querySelector('input[type="date"]')
    expect(input.value).toBe('2026-03-07')
  })

  it('calls onChange when value changes', () => {
    const onChange = vi.fn()
    const { container } = render(<DatePicker value="2026-03-07" onChange={onChange} />)
    const input = container.querySelector('input[type="date"]')
    fireEvent.change(input, { target: { value: '2026-04-01' } })
    expect(onChange).toHaveBeenCalledWith('2026-04-01')
  })
})

// ===== EmptyState =====

describe('EmptyState', () => {
  it('renders title', () => {
    render(<EmptyState title="Nessuna spesa" />)
    expect(screen.getByText('Nessuna spesa')).toBeInTheDocument()
  })

  it('renders description when provided', () => {
    render(<EmptyState title="Vuoto" description="Aggiungi la prima spesa" />)
    expect(screen.getByText('Aggiungi la prima spesa')).toBeInTheDocument()
  })

  it('does not render description when not provided', () => {
    const { container } = render(<EmptyState title="Vuoto" />)
    const paragraphs = container.querySelectorAll('p')
    expect(paragraphs).toHaveLength(0)
  })

  it('renders icon when provided', () => {
    const FakeIcon = (props) => <svg data-testid="icon" {...props} />
    render(<EmptyState icon={FakeIcon} title="Test" />)
    expect(screen.getByTestId('icon')).toBeInTheDocument()
  })
})

// ===== LoadingSpinner =====

describe('LoadingSpinner', () => {
  it('renders with role="status"', () => {
    const { container } = render(<LoadingSpinner />)
    expect(container.querySelector('[role="status"]')).not.toBeNull()
  })

  it('has accessible label via aria-label', () => {
    const { container } = render(<LoadingSpinner />)
    const el = container.querySelector('[aria-label="Caricamento"]')
    expect(el).not.toBeNull()
  })

  it('renders sr-only text', () => {
    const { container } = render(<LoadingSpinner />)
    expect(container.textContent).toContain('Caricamento...')
  })

  it('accepts custom size', () => {
    const { container } = render(<LoadingSpinner size={48} />)
    const svg = container.querySelector('svg')
    expect(svg.getAttribute('width')).toBe('48')
    expect(svg.getAttribute('height')).toBe('48')
  })
})
