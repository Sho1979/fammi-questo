/**
 * Tests for receiptOcr.js
 */
import { describe, it, expect } from 'vitest'
import { extractProductsFromReceipt, OcrError, getAutoExpiry, getAutoLocation } from './receiptOcr.js'

describe('receiptOcr', () => {
  it('extractProductsFromReceipt throws OcrError with OCR_NOT_AVAILABLE', async () => {
    await expect(extractProductsFromReceipt('data:image/png;base64,abc'))
      .rejects.toThrow(OcrError)

    try {
      await extractProductsFromReceipt('data:image/png;base64,abc')
    } catch (err) {
      expect(err.code).toBe('OCR_NOT_AVAILABLE')
      expect(err.name).toBe('OcrError')
      expect(err.message).toContain('non è ancora disponibile')
    }
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
