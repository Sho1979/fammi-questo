/**
 * STEP 4.6 — Tests for Wizard steps and SetupWizard completion logic.
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { expect as vitestExpect } from 'vitest'
import * as matchers from '@testing-library/jest-dom/matchers'

vi.mock('../../lib/sync.js', () => ({
  joinFamilyByCode: vi.fn(),
}))

vi.mock('../../lib/localDb.js', () => ({
  db: {
    members: {
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          toArray: vi.fn(() => Promise.resolve([
            { id: 'c1', name: 'Luca', role: 'child', access_level: 'basic', icon: '👦', color: '#FF9800', family_id: 'f1', pin_hash: 'xxx', _deleted: false, _version: 1 },
            { id: 'c2', name: 'Sara', role: 'child', access_level: 'basic', icon: '👧', color: '#E91E63', family_id: 'f1', pin_hash: 'yyy', _deleted: false, _version: 1 },
            { id: 'p1', name: 'Papà', role: 'parent', access_level: 'full', icon: '👨', color: '#4A90D9', family_id: 'f1', pin_hash: 'zzz', _deleted: false, _version: 1 },
          ])),
        })),
      })),
    },
  },
}))

import { joinFamilyByCode } from '../../lib/sync.js'
import { db } from '../../lib/localDb.js'

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

// ===== WizardStep3 — Child Join Flow =====

describe('WizardStep3 — child join flow', () => {
  const childData = {
    ownerRole: 'child',
    ownerName: 'Luca',
    parents: [],
    hasChildren: false,
    children: [],
  }

  beforeEach(() => {
    vi.restoreAllMocks()
    // Re-set the default mock for db.members.where
    db.members.where.mockReturnValue({
      equals: vi.fn(() => ({
        toArray: vi.fn(() => Promise.resolve([
          { id: 'c1', name: 'Luca', role: 'child', access_level: 'basic', icon: '👦', color: '#FF9800', family_id: 'f1', pin_hash: 'xxx', _deleted: false, _version: 1 },
          { id: 'c2', name: 'Sara', role: 'child', access_level: 'basic', icon: '👧', color: '#E91E63', family_id: 'f1', pin_hash: 'yyy', _deleted: false, _version: 1 },
          { id: 'p1', name: 'Papà', role: 'parent', access_level: 'full', icon: '👨', color: '#4A90D9', family_id: 'f1', pin_hash: 'zzz', _deleted: false, _version: 1 },
        ])),
      })),
    })
  })

  it('renders invite code input for child role', () => {
    const { container } = render(
      <WizardStep3 data={childData} onUpdate={() => {}} onNext={() => {}} onBack={() => {}} />
    )
    expect(container.textContent).toContain('Codice invito')
    const input = container.querySelector('input[type="text"]')
    expect(input).not.toBeNull()
  })

  it('shows error for empty code submission', async () => {
    const { container } = render(
      <WizardStep3 data={childData} onUpdate={() => {}} onNext={() => {}} onBack={() => {}} />
    )
    const joinBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Unisciti'))
    fireEvent.click(joinBtn)
    await waitFor(() => {
      expect(container.textContent).toContain('Inserisci il codice')
    })
  })

  it('shows error for code too short', async () => {
    const { container } = render(
      <WizardStep3 data={childData} onUpdate={() => {}} onNext={() => {}} onBack={() => {}} />
    )
    const input = container.querySelector('input[type="text"]')
    fireEvent.change(input, { target: { value: 'AB' } })
    const joinBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Unisciti'))
    fireEvent.click(joinBtn)
    await waitFor(() => {
      expect(container.textContent).toContain('Il codice deve essere di 6 caratteri')
    })
  })

  it('calls joinFamilyByCode and shows child members on success', async () => {
    joinFamilyByCode.mockResolvedValue({ id: 'f1', name: 'Famiglia Test' })

    const { container } = render(
      <WizardStep3 data={childData} onUpdate={() => {}} onNext={() => {}} onBack={() => {}} />
    )
    const input = container.querySelector('input[type="text"]')
    fireEvent.change(input, { target: { value: 'A3B7K9' } })
    const joinBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Unisciti'))
    fireEvent.click(joinBtn)

    await waitFor(() => {
      expect(container.textContent).toContain('Luca')
      expect(container.textContent).toContain('Sara')
      // Should NOT show parent
      expect(container.textContent).not.toContain('Papà')
    })
  })

  it('shows error when joinFamilyByCode fails', async () => {
    joinFamilyByCode.mockRejectedValue(new Error('Codice non valido'))

    const { container } = render(
      <WizardStep3 data={childData} onUpdate={() => {}} onNext={() => {}} onBack={() => {}} />
    )
    const input = container.querySelector('input[type="text"]')
    fireEvent.change(input, { target: { value: 'XXXXXX' } })
    const joinBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Unisciti'))
    fireEvent.click(joinBtn)

    await waitFor(() => {
      expect(container.textContent).toContain('Codice non valido')
    })
  })

  it('calls onNext with familyId and mapped member when child selected', async () => {
    joinFamilyByCode.mockResolvedValue({ id: 'f1', name: 'Famiglia Test' })
    const onNext = vi.fn()

    const { container } = render(
      <WizardStep3 data={childData} onUpdate={() => {}} onNext={onNext} onBack={() => {}} />
    )
    const input = container.querySelector('input[type="text"]')
    fireEvent.change(input, { target: { value: 'A3B7K9' } })
    const joinBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Unisciti'))
    fireEvent.click(joinBtn)

    await waitFor(() => {
      expect(container.textContent).toContain('Luca')
    })

    // Select Luca
    const lucaBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Luca'))
    fireEvent.click(lucaBtn)

    // Confirm
    const confirmBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Conferma'))
    fireEvent.click(confirmBtn)

    expect(onNext).toHaveBeenCalledWith({
      familyId: 'f1',
      selectedMember: { id: 'c1', name: 'Luca', role: 'child', access_level: 'basic', icon: '👦', color: '#FF9800' },
    })
  })

  it('shows no-children message when family has no child members', async () => {
    joinFamilyByCode.mockResolvedValue({ id: 'f1', name: 'Famiglia Test' })
    // Override mock to return only adults
    db.members.where.mockReturnValue({
      equals: vi.fn(() => ({
        toArray: vi.fn(() => Promise.resolve([
          { id: 'p1', name: 'Papà', role: 'parent', access_level: 'full', icon: '👨', color: '#4A90D9' },
        ])),
      })),
    })

    const { container } = render(
      <WizardStep3 data={childData} onUpdate={() => {}} onNext={() => {}} onBack={() => {}} />
    )
    const input = container.querySelector('input[type="text"]')
    fireEvent.change(input, { target: { value: 'A3B7K9' } })
    const joinBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Unisciti'))
    fireEvent.click(joinBtn)

    await waitFor(() => {
      expect(container.textContent).toContain('Nessun figlio configurato')
    })
  })

  it('shows encrypted family error when member names look encrypted', async () => {
    joinFamilyByCode.mockResolvedValue({ id: 'f1', name: 'Famiglia Test' })
    // Encrypted names are base64 strings
    db.members.where.mockReturnValue({
      equals: vi.fn(() => ({
        toArray: vi.fn(() => Promise.resolve([
          { id: 'c1', name: 'dGVzdCBlbmNyeXB0ZWQ=', role: 'child', access_level: 'basic', icon: '👦', color: '#FF9800' },
        ])),
      })),
    })

    const { container } = render(
      <WizardStep3 data={childData} onUpdate={() => {}} onNext={() => {}} onBack={() => {}} />
    )
    const input = container.querySelector('input[type="text"]')
    fireEvent.change(input, { target: { value: 'A3B7K9' } })
    const joinBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Unisciti'))
    fireEvent.click(joinBtn)

    await waitFor(() => {
      expect(container.textContent).toContain('sincronizzazione crittografata')
    })
  })
})
