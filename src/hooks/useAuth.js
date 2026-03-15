/**
 * Auth hook — PIN verification with bcryptjs, login/logout helpers.
 * See 1_MASTER_ARCHITECTURE.md §4.2 for the auth flow.
 */
import bcrypt from 'bcryptjs'
import { db } from '../lib/localDb.js'
import useAuthStore from '../store/authStore.js'

/** Number of bcrypt salt rounds for hashing PINs */
export const BCRYPT_ROUNDS = 10

/**
 * Hash a plain-text PIN (used during setup / PIN change).
 * @param {string} pin - plain-text PIN (4-6 digits)
 * @returns {Promise<string>} bcrypt hash
 */
export async function hashPin(pin) {
  return bcrypt.hash(pin, BCRYPT_ROUNDS)
}

/**
 * Verify a plain-text PIN against a member's stored hash.
 * @param {string} memberId - member record id in Dexie
 * @param {string} inputPin - plain-text PIN entered by user
 * @returns {Promise<boolean>} true if PIN matches
 */
export async function verifyPin(memberId, inputPin) {
  const member = await db.members.get(memberId)
  if (!member || !member.pin_hash) return false
  return bcrypt.compare(inputPin, member.pin_hash)
}

/**
 * Full login flow: verify PIN → set currentMember in store.
 * @param {string} memberId
 * @param {string} pin
 * @returns {Promise<boolean>} true if login succeeded
 */
export async function login(memberId, pin) {
  const ok = await verifyPin(memberId, pin)
  if (!ok) return false

  const member = await db.members.get(memberId)
  if (!member) return false

  // Set only the fields the store needs (no pin_hash leak)
  const store = useAuthStore.getState()
  store.setMember({
    id: member.id,
    name: member.name,
    role: member.role,
    access_level: member.access_level,
    icon: member.icon,
    color: member.color,
  })
  // Store PIN in session memory for encrypted sync key derivation
  store.setSessionPin(pin)
  return true
}

/**
 * Logout: clear current member from store.
 */
export function logout() {
  useAuthStore.getState().logout()
}
