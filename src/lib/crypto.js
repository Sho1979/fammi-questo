/**
 * crypto.js — AES-256-GCM encryption/decryption for backup files.
 * Uses Web Crypto API (available in all modern browsers + Capacitor).
 *
 * Key derivation: PBKDF2(PIN, random_salt, 200K iterations, SHA-256) → AES-256-GCM
 *
 * Binary format: salt(16) + iv(12) + ciphertext (includes 16-byte GCM auth tag)
 *
 * NOTE: For sync encryption see syncCrypto.js + deviceSecret.js
 */

const SALT_LENGTH = 16
const IV_LENGTH = 12
const ITERATIONS = 200000 // upgraded from 100K → 200K for stronger brute-force resistance

/**
 * Derive an AES-GCM key from a PIN/password.
 * @param {string} pin
 * @param {Uint8Array} salt
 * @returns {Promise<CryptoKey>}
 */
async function deriveKey(pin, salt) {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(pin),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

/**
 * Encrypt a string with AES-GCM using a PIN.
 * Output format: salt (16 bytes) + iv (12 bytes) + ciphertext
 * @param {string} plaintext
 * @param {string} pin
 * @returns {Promise<ArrayBuffer>}
 */
export async function encrypt(plaintext, pin) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const key = await deriveKey(pin, salt)
  const encoder = new TextEncoder()
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plaintext)
  )
  // Concatenate salt + iv + ciphertext
  const result = new Uint8Array(salt.length + iv.length + new Uint8Array(ciphertext).length)
  result.set(salt, 0)
  result.set(iv, salt.length)
  result.set(new Uint8Array(ciphertext), salt.length + iv.length)
  return result.buffer
}

/**
 * Decrypt an ArrayBuffer encrypted with encrypt().
 * @param {ArrayBuffer} data
 * @param {string} pin
 * @returns {Promise<string>}
 */
export async function decrypt(data, pin) {
  const bytes = new Uint8Array(data)
  const salt = bytes.slice(0, SALT_LENGTH)
  const iv = bytes.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH)
  const ciphertext = bytes.slice(SALT_LENGTH + IV_LENGTH)
  const key = await deriveKey(pin, salt)
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  )
  return new TextDecoder().decode(decrypted)
}
