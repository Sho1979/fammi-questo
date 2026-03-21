/**
 * STEP 4.6 — Tests for Wizard steps and SetupWizard completion logic.
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { expect as vitestExpect } from 'vitest'
import * as matchers from '@testing-library/jest-dom/matchers'

vitestExpect.extend(matchers)

import WizardStep1 from './WizardStep1.jsx'
import WizardStep2 from './WizardStep2.jsx'
import WizardStep3 from './WizardStep3.jsx'
import WizardStep4 from './WizardStep4.jsx'

afterEach(() => { cleanup() })

// ===== WizardStep1 =====

describe('WizardStep1', () => {
  it('renders welcome text', () => {
    render(<WizardStep1 onNext={() => {}} />)
    expect(screen.getByText('Fammi Questo')).toBeInTheDocument()
  })

  it('renders privacy note', () => {
    const { container } = render(<WizardStep1 onNext={() => {}} />)
    expect(container.textContent).toContain('I tuoi dati restano sul tuo telefono')
  })

  it('calls onNext when button clicked', () => {
    const onNext = vi.fn()
    render(<WizardStep1 onNext={onNext} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onNext).toHaveBeenCalled()
  })
})

// ===== WizardStep2 =====

describe('WizardStep2', () => {
  const defaultProps = {
    data: { ownerRole: null, ownerName: '' },
    onUpdate: vi.fn(),
    onNext: vi.fn(),
    onBack: vi.fn(),
  }

  it('renders role selection cards', () => {
    const { container } = render(<WizardStep2 {...defaultProps} />)
    expect(container.textContent).toContain('Genitore / Adulto')
    expect(container.textContent).toContain('Figlio/a')
  })

  it('renders name input', () => {
    const { container } = render(<WizardStep2 {...defaultProps} />)
    const input = container.querySelector('input[type="text"]')
    expect(input).not.toBeNull()
  })

  it('calls onUpdate when role selected', () => {
    const onUpdate = vi.fn()
    const { container } = render(<WizardStep2 {...defaultProps} onUpdate={onUpdate} />)
    // Click first role card (parent)
    const buttons = container.querySelectorAll('button')
    // First button that contains "Genitore"
    const parentBtn = Array.from(buttons).find(b => b.textContent.includes('Genitore'))
    fireEvent.click(parentBtn)
    expect(onUpdate).toHaveBeenCalledWith({ ownerRole: 'parent' })
  })

  it('calls onUpdate when name typed', () => {
    const onUpdate = vi.fn()
    const { container } = render(<WizardStep2 {...defaultProps} onUpdate={onUpdate} />)
    const input = container.querySelector('input[type="text"]')
    fireEvent.change(input, { target: { value: 'Marco' } })
    expect(onUpdate).toHaveBeenCalledWith({ ownerName: 'Marco' })
  })

  it('validates: shows error if no role selected', () => {
    const onNext = vi.fn()
    const { container } = render(<WizardStep2 {...defaultProps} onNext={onNext} />)
    // Click "Avanti"
    const nextBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Avanti'))
    fireEvent.click(nextBtn)
    expect(onNext).not.toHaveBeenCalled()
    expect(container.textContent).toContain('Seleziona un ruolo')
  })

  it('validates: shows error if no name', () => {
    const onNext = vi.fn()
    const data = { ownerRole: 'parent', ownerName: '' }
    const { container } = render(<WizardStep2 {...defaultProps} data={data} onNext={onNext} />)
    const nextBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Avanti'))
    fireEvent.click(nextBtn)
    expect(onNext).not.toHaveBeenCalled()
    expect(container.textContent).toContain('Inserisci il tuo nome')
  })

  it('calls onNext when valid data provided', () => {
    const onNext = vi.fn()
    const data = { ownerRole: 'parent', ownerName: 'Papà' }
    const { container } = render(<WizardStep2 {...defaultProps} data={data} onNext={onNext} />)
    const nextBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Avanti'))
    fireEvent.click(nextBtn)
    expect(onNext).toHaveBeenCalled()
  })

  it('calls onBack when back button clicked', () => {
    const onBack = vi.fn()
    const { container } = render(<WizardStep2 {...defaultProps} onBack={onBack} />)
    const backBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Indietro'))
    fireEvent.click(backBtn)
    expect(onBack).toHaveBeenCalled()
  })
})

// ===== WizardStep3 =====

describe('WizardStep3', () => {
  const parentData = {
    ownerRole: 'parent',
    ownerName: 'Papà',
    parents: [{ name: 'Papà', role: 'parent' }],
    hasChildren: false,
    children: [],
  }

  it('renders parent count buttons for parent', () => {
    const { container } = render(
      <WizardStep3 data={parentData} onUpdate={() => {}} onNext={() => {}} onBack={() => {}} />
    )
    expect(container.textContent).toContain('Quanti genitori?')
  })

  it('shows child flow message for child role', () => {
    const childData = { ...parentData, ownerRole: 'child' }
    const { container } = render(
      <WizardStep3 data={childData} onUpdate={() => {}} onNext={() => {}} onBack={() => {}} />
    )
    expect(container.textContent).toContain('Accedi alla tua famiglia')
  })

  it('shows children section when hasChildren is true', () => {
    const data = { ...parentData, hasChildren: true, children: [{ name: '', age: '' }] }
    const { container } = render(
      <WizardStep3 data={data} onUpdate={() => {}} onNext={() => {}} onBack={() => {}} />
    )
    expect(container.textContent).toContain('Quanti figli?')
  })

  it('validates: error if parent has empty name', () => {
    const data = { ...parentData, ownerName: '', parents: [{ name: '', role: 'parent' }] }
    const onNext = vi.fn()
    const { container } = render(
      <WizardStep3 data={data} onUpdate={() => {}} onNext={onNext} onBack={() => {}} />
    )
    const nextBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Avanti'))
    fireEvent.click(nextBtn)
    expect(onNext).not.toHaveBeenCalled()
  })

  it('calls onNext with valid adult data', () => {
    const onNext = vi.fn()
    const { container } = render(
      <WizardStep3 data={parentData} onUpdate={() => {}} onNext={onNext} onBack={() => {}} />
    )
    const nextBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Avanti'))
    fireEvent.click(nextBtn)
    expect(onNext).toHaveBeenCalled()
  })
})

// ===== WizardStep4 =====

describe('WizardStep4', () => {
  const baseData = {
    hasChildren: false,
    children: [],
    parentPin: '',
    parentPinConfirm: '',
    childPin: '',
    childPinConfirm: '',
  }

  it('renders PIN input fields', () => {
    const { container } = render(
      <WizardStep4 data={baseData} onUpdate={() => {}} onNext={() => {}} onBack={() => {}} />
    )
    expect(container.textContent).toContain('PIN genitori')
    const inputs = container.querySelectorAll('input[type="password"]')
    expect(inputs.length).toBe(2) // parent + confirm
  })

  it('shows child PIN fields when hasChildren', () => {
    const data = { ...baseData, hasChildren: true, children: [{ name: 'Luca', age: '10' }] }
    const { container } = render(
      <WizardStep4 data={data} onUpdate={() => {}} onNext={() => {}} onBack={() => {}} />
    )
    expect(container.textContent).toContain('PIN figli')
    const inputs = container.querySelectorAll('input[type="password"]')
    expect(inputs.length).toBe(4) // parent + confirm + child + confirm
  })

  it('validates: error if PIN too short', () => {
    const data = { ...baseData, parentPin: '12', parentPinConfirm: '12' }
    const onNext = vi.fn()
    const { container } = render(
      <WizardStep4 data={data} onUpdate={() => {}} onNext={onNext} onBack={() => {}} />
    )
    const completeBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Completa'))
    fireEvent.click(completeBtn)
    expect(onNext).not.toHaveBeenCalled()
    expect(container.textContent).toContain('Minimo 4 cifre')
  })

  it('validates: error if PINs do not match', () => {
    const data = { ...baseData, parentPin: '1234', parentPinConfirm: '5678' }
    const onNext = vi.fn()
    const { container } = render(
      <WizardStep4 data={data} onUpdate={() => {}} onNext={onNext} onBack={() => {}} />
    )
    const completeBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Completa'))
    fireEvent.click(completeBtn)
    expect(onNext).not.toHaveBeenCalled()
    expect(container.textContent).toContain('I PIN non coincidono')
  })

  it('validates: error if parent and child PIN are same', () => {
    const data = {
      ...baseData,
      hasChildren: true,
      children: [{ name: 'Luca', age: '10' }],
      parentPin: '1234',
      parentPinConfirm: '1234',
      childPin: '1234',
      childPinConfirm: '1234',
    }
    const onNext = vi.fn()
    const { container } = render(
      <WizardStep4 data={data} onUpdate={() => {}} onNext={onNext} onBack={() => {}} />
    )
    const completeBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Completa'))
    fireEvent.click(completeBtn)
    expect(onNext).not.toHaveBeenCalled()
    expect(container.textContent).toContain('devono essere diversi')
  })

  it('calls onNext when valid PINs (no children)', () => {
    const data = { ...baseData, parentPin: '1234', parentPinConfirm: '1234' }
    const onNext = vi.fn()
    const { container } = render(
      <WizardStep4 data={data} onUpdate={() => {}} onNext={onNext} onBack={() => {}} />
    )
    const completeBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Completa'))
    fireEvent.click(completeBtn)
    expect(onNext).toHaveBeenCalled()
  })

  it('calls onNext when valid PINs (with children)', () => {
    const data = {
      ...baseData,
      hasChildren: true,
      children: [{ name: 'Luca', age: '10' }],
      parentPin: '1234',
      parentPinConfirm: '1234',
      childPin: '5678',
      childPinConfirm: '5678',
    }
    const onNext = vi.fn()
    const { container } = render(
      <WizardStep4 data={data} onUpdate={() => {}} onNext={onNext} onBack={() => {}} />
    )
    const completeBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Completa'))
    fireEvent.click(completeBtn)
    expect(onNext).toHaveBeenCalled()
  })

  it('strips non-digit characters from PIN input', () => {
    const onUpdate = vi.fn()
    const { container } = render(
      <WizardStep4 data={baseData} onUpdate={onUpdate} onNext={() => {}} onBack={() => {}} />
    )
    const inputs = container.querySelectorAll('input[type="password"]')
    fireEvent.change(inputs[0], { target: { value: 'abc123def456' } })
    // Should strip letters, keep only digits, max 6
    expect(onUpdate).toHaveBeenCalledWith({ parentPin: '123456' })
  })
})
