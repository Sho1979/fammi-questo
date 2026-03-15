/**
 * STEP 4.6 — Integration test for SetupWizard completion logic.
 * Tests the data layer: family, members, budget created correctly in Dexie.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../../lib/localDb.js'
import { createRecord } from '../../lib/crud.js'
import { hashPin } from '../../hooks/useAuth.js'
import { ACCESS_BY_AGE, ROLE_ICONS, MEMBER_COLORS } from '../../lib/constants.js'
import useAuthStore from '../../store/authStore.js'

/**
 * Simulates the SetupWizard completion logic (same as SetupWizard.handleComplete)
 * without rendering React components.
 */
async function simulateWizardCompletion(wizardData) {
  const familyId = crypto.randomUUID()

  // 1. Create family
  await createRecord('family', {
    family_id: familyId,
    name: 'La mia famiglia',
    created_by: 'setup',
  })

  // 2. Create adult members
  const parentPinHash = await hashPin(wizardData.parentPin)
  let colorIndex = 0

  for (const adult of wizardData.adults) {
    const icon = ROLE_ICONS[adult.role] || ROLE_ICONS.parent
    const color = MEMBER_COLORS[colorIndex % MEMBER_COLORS.length]
    colorIndex++

    await createRecord('members', {
      family_id: familyId,
      name: adult.name.trim(),
      role: adult.role,
      access_level: 'full',
      icon,
      color,
      pin_hash: parentPinHash,
      age: null,
    })
  }

  // 3. Create child members
  if (wizardData.hasChildren && wizardData.children.length > 0) {
    const childPinHash = await hashPin(wizardData.childPin)

    for (const child of wizardData.children) {
      const age = parseInt(child.age)
      const accessLevel = ACCESS_BY_AGE(age)
      const icon = ROLE_ICONS.child
      const color = MEMBER_COLORS[colorIndex % MEMBER_COLORS.length]
      colorIndex++

      await createRecord('members', {
        family_id: familyId,
        name: child.name.trim(),
        role: 'child',
        access_level: accessLevel,
        icon,
        color,
        pin_hash: childPinHash,
        age,
      })
    }
  }

  // 4. Create default budget
  await createRecord('budgets', {
    family_id: familyId,
    monthly_amount: 3000,
    category: null,
    month: null,
  })

  // 5. Update authStore
  useAuthStore.getState().setFamily(familyId)
  useAuthStore.getState().completeSetup()

  return familyId
}

describe('SetupWizard completion logic', () => {
  beforeEach(async () => {
    await db.family.clear()
    await db.members.clear()
    await db.budgets.clear()
    await db.syncLog.clear()
    useAuthStore.getState().fullReset()
  })

  it('creates family, 2 adults, 2 children, 1 budget', async () => {
    const familyId = await simulateWizardCompletion({
      adults: [
        { name: 'Papà', role: 'parent' },
        { name: 'Mamma', role: 'parent' },
      ],
      hasChildren: true,
      children: [
        { name: 'Marco', age: '15' },
        { name: 'Sofia', age: '8' },
      ],
      parentPin: '1234',
      childPin: '5678',
    })

    // Family
    const families = await db.family.toArray()
    expect(families).toHaveLength(1)
    expect(families[0].family_id).toBe(familyId)
    expect(families[0].name).toBe('La mia famiglia')

    // Members
    const members = await db.members.where('family_id').equals(familyId).toArray()
    expect(members).toHaveLength(4)

    // Adults
    const papa = members.find(m => m.name === 'Papà')
    expect(papa.role).toBe('parent')
    expect(papa.access_level).toBe('full')
    expect(papa.pin_hash).toBeDefined()
    expect(papa.icon).toBe('👨')

    const mamma = members.find(m => m.name === 'Mamma')
    expect(mamma.role).toBe('parent')
    expect(mamma.access_level).toBe('full')

    // Children
    const marco = members.find(m => m.name === 'Marco')
    expect(marco.role).toBe('child')
    expect(marco.access_level).toBe('calendar_tasks') // age 15
    expect(marco.age).toBe(15)

    const sofia = members.find(m => m.name === 'Sofia')
    expect(sofia.role).toBe('child')
    expect(sofia.access_level).toBe('basic') // age 8

    // Budget
    const budgets = await db.budgets.toArray()
    expect(budgets).toHaveLength(1)
    expect(budgets[0].monthly_amount).toBe(3000)
    expect(budgets[0].family_id).toBe(familyId)

    // Auth store
    expect(useAuthStore.getState().familyId).toBe(familyId)
    expect(useAuthStore.getState().isSetupComplete).toBe(true)
  })

  it('creates family with adults only (no children)', async () => {
    const familyId = await simulateWizardCompletion({
      adults: [{ name: 'Solo', role: 'parent' }],
      hasChildren: false,
      children: [],
      parentPin: '9999',
      childPin: '',
    })

    const members = await db.members.where('family_id').equals(familyId).toArray()
    expect(members).toHaveLength(1)
    expect(members[0].name).toBe('Solo')
    expect(members[0].role).toBe('parent')
  })

  it('assigns different colors to each member', async () => {
    const familyId = await simulateWizardCompletion({
      adults: [
        { name: 'A1', role: 'parent' },
        { name: 'A2', role: 'parent' },
      ],
      hasChildren: true,
      children: [
        { name: 'C1', age: '10' },
        { name: 'C2', age: '5' },
      ],
      parentPin: '1234',
      childPin: '5678',
    })

    const members = await db.members.where('family_id').equals(familyId).toArray()
    const colors = members.map(m => m.color)
    // First 4 colors should all be different (we have 6 available)
    const unique = new Set(colors)
    expect(unique.size).toBe(4)
  })

  it('assigns correct access_level by age', async () => {
    const familyId = await simulateWizardCompletion({
      adults: [{ name: 'Papà', role: 'parent' }],
      hasChildren: true,
      children: [
        { name: 'Adulto', age: '18' },
        { name: 'Teen', age: '14' },
        { name: 'Kid', age: '7' },
        { name: 'Baby', age: '3' },
      ],
      parentPin: '1234',
      childPin: '5678',
    })

    const members = await db.members.where('family_id').equals(familyId).toArray()
    expect(members.find(m => m.name === 'Adulto').access_level).toBe('full')
    expect(members.find(m => m.name === 'Teen').access_level).toBe('calendar_tasks')
    expect(members.find(m => m.name === 'Kid').access_level).toBe('basic')
    expect(members.find(m => m.name === 'Baby').access_level).toBe('view_only')
  })

  it('uses elder icon for elder role', async () => {
    const familyId = await simulateWizardCompletion({
      adults: [
        { name: 'Papà', role: 'parent' },
        { name: 'Nonno', role: 'elder' },
      ],
      hasChildren: false,
      children: [],
      parentPin: '1234',
      childPin: '',
    })

    const members = await db.members.where('family_id').equals(familyId).toArray()
    expect(members.find(m => m.name === 'Nonno').icon).toBe('👴')
  })
})
