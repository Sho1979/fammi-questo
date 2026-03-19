/**
 * Receipt OCR — Scansione scontrini con camera + Claude Vision.
 * Modeled after api.php receipt_ocr.
 *
 * Flow: Camera capture → base64 image → Claude Haiku vision → structured products
 *
 * Since this is a client-side app (no Tesseract server), we use Claude Vision
 * to extract products directly from the receipt image. This is actually MORE
 * accurate than Tesseract for Italian receipts.
 */
import { supabase, isSyncEnabled } from './supabase.js'

/**
 * Capture photo from device camera.
 * Returns base64 data URL.
 */
export function captureReceipt() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.capture = 'environment' // rear camera
    input.style.display = 'none'
    document.body.appendChild(input)

    input.onchange = (e) => {
      const file = e.target.files?.[0]
      document.body.removeChild(input)
      if (!file) {
        reject(new Error('Nessuna foto selezionata'))
        return
      }
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = () => reject(new Error('Errore lettura immagine'))
      reader.readAsDataURL(file)
    }

    input.oncancel = () => {
      document.body.removeChild(input)
      reject(new Error('Annullato'))
    }

    input.click()
  })
}

/**
 * Extract products from receipt image using Claude Vision.
 * @param {string} imageDataUrl - base64 data URL of receipt photo
 * @returns {Promise<Array<{name: string, quantity: number, price: number|null, category: string}>>}
 */
export async function extractProductsFromReceipt(imageDataUrl) {
  if (!isSyncEnabled()) {
    throw new Error('OCR non disponibile: sync non configurato.')
  }

  // Extract base64 and media type
  const match = imageDataUrl.match(/^data:(image\/[^;]+);base64,(.+)$/)
  if (!match) throw new Error('Formato immagine non valido')
  const mediaType = match[1]
  const base64Data = match[2]

  const { data, error } = await supabase.functions.invoke('receipt-ocr', {
    body: {
      image: base64Data,
      media_type: mediaType,
    },
  })

  if (error) throw new Error(`Errore OCR: ${error.message}`)
  if (!data?.products) return []

  return data.products.filter((p) => p.name && typeof p.name === 'string')
}

/**
 * Category-based auto-expiry days (from api.php receipt_add logic).
 */
const EXPIRY_DAYS = {
  latticini: 7,
  carne: 5,
  pesce: 3,
  verdura: 7,
  frutta: 7,
  pane: 3,
  pasta: 90,
  condimenti: 90,
  bevande: 90,
  igiene: 365,
  surgelati: 90,
  casa: 365,
  dolci: 30,
  altro: 30,
  // Shopping composite categories (from useShopping.js)
  carne_pesce: 4,       // avg of carne(5) and pesce(3)
  frutta_verdura: 7,
  pane_pasta: 7,        // avg of pane(3) and pasta(90) → conservative
}

/**
 * Calculate expiry date based on product category.
 */
export function getAutoExpiry(category) {
  const days = EXPIRY_DAYS[category] || 30
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

/**
 * Category → location mapping for auto-placement in inventory.
 */
export function getAutoLocation(category) {
  switch (category) {
    case 'latticini':
    case 'carne':
    case 'pesce':
    case 'verdura':
    case 'frutta':
    case 'carne_pesce':     // shopping composite
    case 'frutta_verdura':  // shopping composite
      return 'frigo'
    case 'surgelati':
      return 'freezer'
    case 'igiene':
    case 'casa':
      return 'altro'
    default:
      return 'dispensa'
  }
}
