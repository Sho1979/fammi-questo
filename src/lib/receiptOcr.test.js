/**
 * Tests for receiptOcr.js
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest'
import { extractProductsFromReceipt, OcrError, getAutoExpiry, getAutoLocation } from './receiptOcr.js'

// Mock supabase to control isSyncEnabled
vi.mock('./supabase.js', () => ({
  isSyncEnabled: () => false,
  supabase: { functions: { invoke: vi.fn() } },
}))

describe('receiptOcr', () => {
  it('extractProductsFromReceipt throws OcrError when sync not enabled', async () => {
    // Without sync configured, should throw OCR_SYNC_DISABLED
    await expect(extractProductsFromReceipt('data:image/png;base64,abc'))
      .rejects.toThrow(OcrError)

    try {
      await extractProductsFromReceipt('data:image/png;base64,abc')
    } catch (err) {
      expect(err.code).toBe('OCR_SYNC_DISABLED')
      expect(err.name).toBe('OcrError')
      expect(err.message).toContain('sync cloud')
    }
  })

  it('OcrError has correct code property', () => {
    const err = new OcrError('OCR_API_ERROR', 'test')
    expect(err.code).toBe('OCR_API_ERROR')
    expect(err.name).toBe('OcrError')
    expect(err.message).toBe('test')
  })

  it('getAutoExpiry returns future date string', () => {
    const expiry = getAutoExpiry('latticini')
    expect(expiry).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    const expiryDate = new Date(expiry)
    expect(expiryDate.getTime()).toBeGreaterThan(Date.now())
  })

  it('getAutoLocation returns frigo for perishables', () => {
    expect(getAutoLocation('latticini')).toBe('frigo')
    expect(getAutoLocation('carne')).toBe('frigo')
    expect(getAutoLocation('surgelati')).toBe('freezer')
    expect(getAutoLocation('pasta')).toBe('dispensa')
  })
})
