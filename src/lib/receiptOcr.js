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
 * Structured error for OCR operations.
 * Codes: OCR_NOT_AVAILABLE, OCR_SYNC_DISABLED, OCR_INVALID_IMAGE, OCR_API_ERROR
 */
export class OcrError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'OcrError'
    this.code = code
  }
}

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
    throw new OcrError('OCR_SYNC_DISABLED', 'Per scansionare gli scontrini devi attivare la sync cloud nelle Impostazioni.')
  }

  // Extract base64 and media type
  const match = imageDataUrl.match(/^data:(image\/[^;]+);base64,(.+)$/)
  if (!match) throw new OcrError('OCR_INVALID_IMAGE', 'Formato immagine non valido')
  const mediaType = match[1]

  // Resize image to max 800px to reduce API costs
  const resizedBase64 = await resizeImage(imageDataUrl, 800)

  const { data, error } = await supabase.functions.invoke('receipt-ocr', {
    body: {
      image: resizedBase64,
      media_type: mediaType,
    },
  })

  if (error) throw new OcrError('OCR_API_ERROR', `Errore scansione: ${error.message}`)
  if (!data?.ok) throw new OcrError('OCR_API_ERROR', data?.error || 'Errore nella risposta')
  if (!data?.products || data.products.length === 0) {
    throw new OcrError('OCR_API_ERROR', 'Nessun prodotto trovato nello scontrino. Riprova con una foto più chiara.')
  }

  return data.products.filter((p) => p.name && typeof p.name === 'string')
}

/**
 * Resize image to max dimension (preserving aspect ratio) to reduce API token costs.
 * Returns base64 string (without data URL prefix).
 */
function resizeImage(dataUrl, maxDim) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      let { width, height } = img
      if (width <= maxDim && height <= maxDim) {
        // Already small enough — strip prefix and return
        resolve(dataUrl.split(',')[1])
        return
      }
      // Scale down
      const ratio = Math.min(maxDim / width, maxDim / height)
      width = Math.round(width * ratio)
      height = Math.round(height * ratio)

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, width, height)
      // Export as JPEG with 85% quality
      const resized = canvas.toDataURL('image/jpeg', 0.85)
      resolve(resized.split(',')[1])
    }
    img.onerror = () => reject(new Error('Errore nel ridimensionamento immagine'))
    img.src = dataUrl
  })
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
