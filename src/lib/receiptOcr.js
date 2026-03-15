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
import { AI_MODEL, AI_API_URL } from './constants.js'

const ANTHROPIC_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY

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
  if (!ANTHROPIC_KEY) {
    throw new Error('API key Anthropic non configurata')
  }

  // Extract base64 and media type
  const match = imageDataUrl.match(/^data:(image\/[^;]+);base64,(.+)$/)
  if (!match) throw new Error('Formato immagine non valido')
  const mediaType = match[1]
  const base64Data = match[2]

  const response = await fetch(AI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: AI_MODEL,
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64Data,
            },
          },
          {
            type: 'text',
            text: `Sei un assistente che analizza scontrini italiani.
Estrai TUTTI i prodotti da questo scontrino. Per ogni prodotto indica:
- name: nome pulito del prodotto (senza codici, senza prezzi, in italiano naturale)
- quantity: quantità (default 1)
- price: prezzo unitario in euro (null se non leggibile)
- category: una tra [frutta, verdura, carne, pesce, latticini, pane, pasta, condimenti, bevande, surgelati, igiene, casa, dolci, altro]

Ignora: totali, subtotali, IVA, sconti, intestazioni, piè di pagina.

Rispondi SOLO con un JSON array. Esempio:
[{"name":"Latte intero","quantity":2,"price":1.49,"category":"latticini"},{"name":"Pane integrale","quantity":1,"price":2.30,"category":"pane"}]

Se lo scontrino non è leggibile o non contiene prodotti, rispondi con [].`
          }
        ]
      }]
    })
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Errore API: ${response.status} — ${err}`)
  }

  const data = await response.json()
  const text = data.content?.[0]?.text || '[]'

  // Parse JSON from response (handle markdown code blocks)
  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) return []

  try {
    const products = JSON.parse(jsonMatch[0])
    return products.filter((p) => p.name && typeof p.name === 'string')
  } catch {
    console.warn('OCR parse error:', text)
    return []
  }
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
