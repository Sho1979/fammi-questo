/**
 * sync.test.js — Test per il mutex sync e le protezioni anti-corruzione.
 */

import { describe, it, expect, vi } from 'vitest'

// Mock supabase per evitare chiamate reali
vi.mock('./supabase.js', () => ({
  supabase: { rpc: vi.fn(), from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ data: [], error: null })) })) })) },
  isSyncEnabled: () => true,
  ensureAuth: vi.fn(),
  linkUserToFamily: vi.fn(),
}))

// Mock localDb
vi.mock('./localDb.js', () => ({
  db: {
    family: { get: vi.fn() },
    transaction: vi.fn(),
  },
}))

describe('sync mutex', () => {
  it('fullSync exports correctly', async () => {
    const { fullSync } = await import('./sync.js')
    expect(typeof fullSync).toBe('function')
  })
})

describe('syncCrypto hard-fail', () => {
  it('decryptRecord throws on decryption failure instead of setting null', async () => {
    const { decryptRecord } = await import('./syncCrypto.js')

    // Create a record with encrypted flag but garbage data
    const badRecord = {
      id: 'test-123',
      _encrypted: true,
      title: '[encrypted]',
      title_enc: 'not-valid-base64!!!',
    }

    // Generate a valid CryptoKey
    const key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    )

    // Should throw, not silently set to null
    await expect(decryptRecord(badRecord, 'tasks', key)).rejects.toThrow(/Decriptazione fallita/)
  })

  it('decryptRecord passes through unencrypted records', async () => {
    const { decryptRecord } = await import('./syncCrypto.js')

    const plainRecord = { id: 'test-456', title: 'Test Task', _encrypted: false }
    const key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    )

    const result = await decryptRecord(plainRecord, 'tasks', key)
    expect(result.title).toBe('Test Task')
  })
})
