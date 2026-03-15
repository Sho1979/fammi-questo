/**
 * R3.3 — InventoryPage: track what's in the house, with expiry alerts.
 * Enhanced: OCR receipt scanning, smart merge, auto-categorization.
 */
import { useState, useCallback } from 'react'
import useAuthStore from '../store/authStore.js'
import {
  useInventory,
  useExpiringItems,
  addInventoryItem,
  deleteInventoryItem,
  addReceiptToInventory,
  LOCATIONS,
} from '../hooks/useInventory.js'
import { captureReceipt, extractProductsFromReceipt } from '../lib/receiptOcr.js'
import { Modal, Toast } from '../components/shared/index.js'
import EmptyState from '../components/shared/EmptyState.jsx'
import { Package, Plus, X, AlertTriangle, Camera, Loader2, Check } from 'lucide-react'

export default function InventoryPage() {
  const { familyId } = useAuthStore()
  const items = useInventory(familyId)
  const expiring = useExpiringItems(familyId, 3)

  const [showAdd, setShowAdd] = useState(false)
  const [filter, setFilter] = useState('all')
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unit, setUnit] = useState('pz')
  const [location, setLocation] = useState('dispensa')
  const [expiryDate, setExpiryDate] = useState('')
  const [toast, setToast] = useState(null)

  // OCR state
  const [scanning, setScanning] = useState(false)
  const [ocrProducts, setOcrProducts] = useState(null)
  const [ocrSaving, setOcrSaving] = useState(false)

  const filtered = filter === 'all' ? items : items.filter((i) => i.location === filter)

  // Group by location
  const grouped = {}
  for (const item of filtered) {
    const loc = item.location || 'altro'
    if (!grouped[loc]) grouped[loc] = []
    grouped[loc].push(item)
  }

  const handleAdd = useCallback(async () => {
    if (!name.trim()) return
    await addInventoryItem({
      name: name.trim(),
      quantity: parseFloat(quantity) || 1,
      unit,
      location,
      expiry_date: expiryDate || null,
    })
    setName('')
    setQuantity('1')
    setExpiryDate('')
    setShowAdd(false)
    setToast({ message: `${name.trim()} aggiunto` })
  }, [name, quantity, unit, location, expiryDate])

  // OCR Receipt scanning
  const handleScanReceipt = useCallback(async () => {
    try {
      setScanning(true)
      const imageData = await captureReceipt()
      const products = await extractProductsFromReceipt(imageData)
      if (products.length === 0) {
        setToast({ message: 'Nessun prodotto trovato nello scontrino' })
      } else {
        // Show products for review before adding
        setOcrProducts(products.map((p) => ({ ...p, selected: true })))
      }
    } catch (err) {
      if (err.message !== 'Annullato') {
        setToast({ message: `Errore: ${err.message}` })
      }
    } finally {
      setScanning(false)
    }
  }, [])

  const handleOcrConfirm = useCallback(async () => {
    if (!ocrProducts) return
    setOcrSaving(true)
    const selected = ocrProducts.filter((p) => p.selected)
    const result = await addReceiptToInventory(selected)
    setOcrProducts(null)
    setOcrSaving(false)
    setToast({
      message: `${result.added} aggiunti, ${result.merged} aggiornati`
    })
  }, [ocrProducts])

  const toggleOcrProduct = (idx) => {
    setOcrProducts((prev) => prev.map((p, i) =>
      i === idx ? { ...p, selected: !p.selected } : p
    ))
  }

  const isExpired = (date) => {
    if (!date) return false
    return date <= new Date().toISOString().slice(0, 10)
  }

  const isExpiringSoon = (date) => {
    if (!date) return false
    const limit = new Date()
    limit.setDate(limit.getDate() + 3)
    return date <= limit.toISOString().slice(0, 10) && !isExpired(date)
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package size={22} className="text-violet-500" />
          <h2 className="text-lg font-bold text-gray-900">Inventario</h2>
        </div>
        <div className="flex gap-2">
          {/* Scan receipt button */}
          <button
            type="button"
            onClick={handleScanReceipt}
            disabled={scanning}
            className="flex items-center gap-1 rounded-xl bg-amber-500 px-3 py-2 text-xs font-semibold text-white
              shadow-md hover:bg-amber-600 disabled:opacity-50 transition-all"
          >
            {scanning ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
            {scanning ? 'Analisi...' : 'Scontrino'}
          </button>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1 rounded-xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white
              shadow-md hover:bg-violet-700 transition-all"
          >
            <Plus size={14} /> Aggiungi
          </button>
        </div>
      </div>

      {/* Expiry alert */}
      {expiring.length > 0 && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 flex items-start gap-2">
          <AlertTriangle size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs font-semibold text-amber-800">
              {expiring.length} prodott{expiring.length === 1 ? 'o' : 'i'} in scadenza!
            </p>
            <p className="text-xs text-amber-600">
              {expiring.map((e) => e.name).join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* Location filter */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`flex-shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-all
            ${filter === 'all' ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600'}`}
        >
          Tutto ({items.length})
        </button>
        {LOCATIONS.map((loc) => {
          const count = items.filter((i) => i.location === loc.id).length
          return (
            <button
              key={loc.id}
              type="button"
              onClick={() => setFilter(loc.id)}
              className={`flex-shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-all
                ${filter === loc.id ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600'}`}
            >
              {loc.icon} {count}
            </button>
          )
        })}
      </div>

      {/* Items */}
      {Object.keys(grouped).length > 0 ? (
        Object.entries(grouped).map(([locId, locItems]) => {
          const loc = LOCATIONS.find((l) => l.id === locId) || { icon: '📦', label: locId }
          return (
            <div key={locId}>
              <h3 className="text-xs font-semibold text-gray-400 uppercase mb-1.5 px-1">
                {loc.icon} {loc.label}
              </h3>
              <div className="flex flex-col gap-1">
                {locItems.map((item) => (
                  <div key={item.id}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 bg-white border transition-all
                      ${isExpired(item.expiry_date) ? 'border-red-200 bg-red-50'
                        : isExpiringSoon(item.expiry_date) ? 'border-amber-200 bg-amber-50'
                        : 'border-gray-100'}`}
                  >
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-gray-900">{item.name}</span>
                      <span className="text-xs text-gray-400 ml-1">
                        {item.quantity}{item.unit ? ` ${item.unit}` : ''}
                      </span>
                      {item.expiry_date && (
                        <span className={`text-xs ml-2 ${isExpired(item.expiry_date) ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                          Scad: {item.expiry_date.slice(5).replace('-', '/')}
                        </span>
                      )}
                    </div>
                    <button type="button" onClick={() => deleteInventoryItem(item.id)}
                      className="p-1 text-gray-300 hover:text-red-500">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )
        })
      ) : (
        <EmptyState
          icon={Package}
          title="Inventario vuoto"
          description="Scansiona uno scontrino o aggiungi manualmente i prodotti"
          action={() => setShowAdd(true)}
          actionLabel="Aggiungi prodotto"
        />
      )}

      {/* Add modal */}
      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Aggiungi prodotto">
        <div className="flex flex-col gap-3 p-4">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome prodotto"
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold
              focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100" autoFocus />
          <div className="flex gap-2">
            <input type="text" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)}
              placeholder="Qta" className="w-20 rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-center
              focus:border-violet-400 focus:outline-none" />
            <select value={unit} onChange={(e) => setUnit(e.target.value)}
              className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-violet-400 focus:outline-none">
              {['pz', 'kg', 'g', 'L', 'mL'].map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
            <select value={location} onChange={(e) => setLocation(e.target.value)}
              className="flex-1 rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-violet-400 focus:outline-none">
              {LOCATIONS.map((l) => <option key={l.id} value={l.id}>{l.icon} {l.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Scadenza (opzionale)</label>
            <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm
              focus:border-violet-400 focus:outline-none" />
          </div>
          <button type="button" onClick={handleAdd} disabled={!name.trim()}
            className="w-full rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white
              shadow-md hover:bg-violet-700 disabled:opacity-50 transition-all">
            Salva
          </button>
        </div>
      </Modal>

      {/* OCR Results Review Modal */}
      <Modal
        isOpen={ocrProducts !== null}
        onClose={() => setOcrProducts(null)}
        title="Prodotti dallo scontrino"
      >
        <div className="flex flex-col gap-2 p-4 max-h-[60vh] overflow-y-auto">
          {ocrProducts && (
            <>
              <p className="text-xs text-gray-500 mb-2">
                Trovati {ocrProducts.length} prodotti. Deseleziona quelli da non aggiungere.
              </p>
              {ocrProducts.map((p, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleOcrProduct(i)}
                  className={`flex items-center gap-3 rounded-xl p-3 border transition-all text-left
                    ${p.selected ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200 opacity-50'}`}
                >
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0
                    ${p.selected ? 'bg-green-500 text-white' : 'bg-gray-200'}`}>
                    {p.selected && <Check size={12} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{p.name}</p>
                    <p className="text-xs text-gray-500">
                      x{p.quantity || 1}
                      {p.price ? ` · €${p.price}` : ''}
                      {p.category ? ` · ${p.category}` : ''}
                    </p>
                  </div>
                </button>
              ))}
              <button
                type="button"
                onClick={handleOcrConfirm}
                disabled={ocrSaving || !ocrProducts.some((p) => p.selected)}
                className="w-full rounded-xl bg-green-500 py-2.5 text-sm font-semibold text-white
                  shadow-md hover:bg-green-600 disabled:opacity-50 transition-all mt-2"
              >
                {ocrSaving ? 'Aggiungo...' : `Aggiungi ${ocrProducts.filter((p) => p.selected).length} alla dispensa`}
              </button>
            </>
          )}
        </div>
      </Modal>

      {toast && <Toast message={toast.message} onClose={() => setToast(null)} />}
    </div>
  )
}
