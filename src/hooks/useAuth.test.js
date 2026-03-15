/**
 * STEP 2.3 — useAuth: verifyPin, hashPin, login, logout.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../lib/localDb.js'
import useAuthStore from '../store/authStore.js'
import { hashPin, verifyPin, login, logout } from './useAuth.js'

/** Helper: seed a member in Dexie with a hashed PIN */
async function seedMember(overrides = {}) {
  const pin = overrides.pin || '1234'
  const pin_hash = await hashPin(pin)
  const member = {
    id: overrides.id || 'member-1',
    family_id: overrides.family_id || 'fam-1',
    name: overrides.name || 'Papà',
    role: overrides.role || 'parent',
    access_level: overrides.access_level || 'full',
    icon: overrides.icon || '👨',
    color: overrides.color || '#4A90D9',
    pin_hash,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    _deleted: false,
    _version: 1,
    _device_id: 'test-device',
  }
  await db.members.add(member)
  return member
}

describe('useAuth', () => {
  beforeEach(async () => {
    await db.members.clear()
    useAuthStore.getState().fullReset()
  })

  // --- hashPin ---

  it('hashPin returns a bcrypt hash string', async () => {
    const hash = await hashPin('5678')
    expect(hash).toBeDefined()
    expect(typeof hash).toBe('string')
    expect(hash.startsWith('$2')).toBe(true) // bcrypt prefix
  })

  it('hashPin returns different hashes for different PINs', async () => {
    const h1 = await hashPin('1111')
    const h2 = await hashPin('2222')
    expect(h1).not.toBe(h2)
  })

  // --- verifyPin ---

  it('verifyPin returns true for correct PIN', async () => {
    await seedMember({ id: 'v1', pin: '4321' })
    const result = await verifyPin('v1', '4321')
    expect(result).toBe(true)
  })

  it('verifyPin returns false for wrong PIN', async () => {
    await seedMember({ id: 'v2', pin: '4321' })
    const result = await verifyPin('v2', '9999')
    expect(result).toBe(false)
  })

  it('verifyPin returns false for non-existent member', async () => {
    const result = await verifyPin('non-existent', '1234')
    expect(result).toBe(false)
  })

  it('verifyPin returns false for member without pin_hash', async () => {
    // Add member with no pin_hash
    await db.members.add({
      id: 'no-pin',
      family_id: 'fam-1',
      name: 'NoPIN',
      role: 'child',
      access_level: 'view_only',
      icon: '👧',
      color: '#E91E63',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      _deleted: false,
      _version: 1,
      _device_id: 'test-device',
    })
    const result = await verifyPin('no-pin', '1234')
    expect(result).toBe(false)
  })

  // --- login ---

  it('login sets currentMember in store on correct PIN', async () => {
    await seedMember({ id: 'login-1', pin: '1234', name: 'Mamma', role: 'parent' })
    const success = await login('login-1', '1234')
    expect(success).toBe(true)

    const member = useAuthStore.getState().currentMember
    expect(member).toBeDefined()
    expect(member.id).toBe('login-1')
    expect(member.name).toBe('Mamma')
    expect(member.role).toBe('parent')
    expect(member.access_level).toBe('full')
    // Must NOT contain pin_hash
    expect(member.pin_hash).toBeUndefined()
  })

  it('login returns false on wrong PIN and does not set member', async () => {
    await seedMember({ id: 'login-2', pin: '5555' })
    const success = await login('login-2', '0000')
    expect(success).toBe(false)
    expect(useAuthStore.getState().currentMember).toBeNull()
  })

  it('login returns false for non-existent member', async () => {
    const success = await login('ghost', '1234')
    expect(success).toBe(false)
    expect(useAuthStore.getState().currentMember).toBeNull()
  })

  // --- logout ---

  it('logout clears currentMember from store', async () => {
    await seedMember({ id: 'logout-1', pin: '1234' })
    await login('logout-1', '1234')
    expect(useAuthStore.getState().currentMember).not.toBeNull()

    logout()
    expect(useAuthStore.getState().currentMember).toBeNull()
  })
})
