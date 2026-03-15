/**
 * DispensaPage — Unified Shopping + Inventory + OCR receipt scanning.
 * Two sub-tabs: "Lista Spesa" and "Inventario".
 * Redesigned Inventario: visual location shelves, product cards, expiry badges.
 */
import { useState, useCallback, useMemo, useEffect } from 'react'
import useAuthStore from '../store/authStore.js'

// Shopping hooks
import {
  useShoppingList,
  useShoppingCount,
  addShoppingItem,
  toggleItem,
  deleteShoppingItem,
  clearCheckedItems,
  parseQuickAdd,
  SHOPPING_CATEGORIES,
} from '../hooks/useShopping.js'

// Inventory hooks
import {
  useInventory,
  useExpiringItems,
  addInventoryItem,
  deleteInventoryItem,
  addReceiptToInventory,
  moveShoppingToInventory,
  LOCATIONS,
} from '../hooks/useInventory.js'

// OCR
import { captureReceipt, extractProductsFromReceipt } from '../lib/receiptOcr.js'

// Shared
import { Modal, Toast } from '../components/shared/index.js'
import EmptyState from '../components/shared/EmptyState.jsx'
import {
  ShoppingCart, Package, Plus, X, CheckCheck, PackageCheck,
  Camera, Loader2, Check, AlertTriangle, Trash2, ChevronDown, ChevronUp,
  Search, ArrowUpDown,
} from 'lucide-react'

const TABS = [
  { id: 'spesa', label: 'Lista Spesa', icon: ShoppingCart },
  { id: 'inventario', label: 'Inventario', icon: Package },
]

const DISPENSA_TAB_KEY = 'dispensa_active_tab'
const DISPENSA_COLLAPSE_KEY = 'dispensa_collapsed'

/** Read persisted tab from localStorage */
function readPersistedTab() {
  try { return localStorage.getItem(DISPENSA_TAB_KEY) || 'spesa' }
  catch { return 'spesa' }
}

/** Read persisted collapse state from localStorage */
function readPersistedCollapse() {
  try { return JSON.parse(localStorage.getItem(DISPENSA_COLLAPSE_KEY) || '{}') }
  catch { return {} }
}

export default function DispensaPage() {
  const { familyId } = useAuthStore()
  const [activeTab, setActiveTab] = useState(readPersistedTab)
  const [toast, setToast] = useState(null)

  // Persist active tab
  const handleTabChange = useCallback((tabId) => {
    setActiveTab(tabId)
    try { localStorage.setItem(DISPENSA_TAB_KEY, tabId) } catch { /* noop */ }
  }, [])

  return (
    <div className="flex flex-col gap-0 pb-24" style={{ background: 'var(--bg-main)' }}>
      {/* Tab selector */}
      <div className="glass flex border-b border-white/40 px-4 pt-3 pb-0 sticky top-0 z-10"
        style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.03)' }}>
        {TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              className={`relative flex-1 flex items-center justify-center gap-1.5 pb-3 text-sm font-semibold transition-all duration-200
                ${isActive ? 'text-violet-600' : 'text-gray-400'}`}
            >
              <Icon size={16} />
              {tab.label}
              {isActive && <div className="absolute bottom-0 left-[15%] right-[15%] h-[3px] rounded-t-full"
                style={{ background: 'var(--gradient-primary)' }} />}
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div className="px-4 py-4 flex flex-col gap-3.5">
        {activeTab === 'spesa' ? (
          <ShoppingTab familyId={familyId} toast={toast} setToast={setToast} />
        ) : (
          <InventoryTab familyId={familyId} toast={toast} setToast={setToast} />
        )}
      </div>

      {toast && <Toast message={toast.message} onClose={() => setToast(null)} />}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// SHOPPING TAB (unchanged)
// ═══════════════════════════════════════════════════════════
const SORT_OPTIONS = [
  { id: 'default', label: 'Categoria' },
  { id: 'name', label: 'Nome A-Z' },
  { id: 'recent', label: 'Più recenti' },
]

function ShoppingTab({ familyId, setToast }) {
  const items = useShoppingList(familyId)
  const { total, checked } = useShoppingCount(familyId)

  const [quickText, setQuickText] = useState('')
  const [quickCategory, setQuickCategory] = useState('altro')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('default')
  const [showSort, setShowSort] = useState(false)

  // Filter items by search query
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items
    const q = searchQuery.trim().toLowerCase()
    return items.filter((i) => i.name.toLowerCase().includes(q))
  }, [items, searchQuery])

  // Sort items
  const sortedItems = useMemo(() => {
    if (sortBy === 'default') return filteredItems // already sorted by category
    const sorted = [...filteredItems]
    if (sortBy === 'name') {
      sorted.sort((a, b) => {
        if (a.checked !== b.checked) return a.checked ? 1 : -1
        return (a.name || '').localeCompare(b.name || '')
      })
    } else if (sortBy === 'recent') {
      sorted.sort((a, b) => {
        if (a.checked !== b.checked) return a.checked ? 1 : -1
        return (b.created_at || '').localeCompare(a.created_at || '')
      })
    }
    return sorted
  }, [filteredItems, sortBy])

  const handleQuickAdd = useCallback(async () => {
    if (!quickText.trim()) return
    const parsed = parseQuickAdd(quickText)
    await addShoppingItem({ ...parsed, category: quickCategory })
    setQuickText('')
    setToast({ message: `${parsed.name} aggiunto alla lista` })
  }, [quickText, quickCategory, setToast])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleQuickAdd()
  }

  const handleClearChecked = async () => {
    const count = await clearCheckedItems(familyId)
    if (count > 0) setToast({ message: `${count} articoli rimossi` })
  }

  const handleMoveToInventory = async () => {
    const checkedItems = items.filter((i) => i.checked)
    if (checkedItems.length === 0) return
    const result = await moveShoppingToInventory(checkedItems)
    setToast({ message: `${result.moved + result.merged} spostati in inventario` })
  }

  // Group by category (use sortedItems for filtered+sorted result)
  const grouped = useMemo(() => {
    const g = {}
    for (const item of sortedItems) {
      const cat = item.category || 'altro'
      if (!g[cat]) g[cat] = []
      g[cat].push(item)
    }
    return g
  }, [sortedItems])

  return (
    <>
      {/* Actions bar */}
      {checked > 0 && (
        <div className="flex items-center justify-between rounded-xl bg-green-50 border border-green-200 px-3 py-2">
          <span className="text-xs text-green-700 font-medium">{checked} selezionati</span>
          <div className="flex gap-3">
            <button type="button" onClick={handleMoveToInventory}
              className="flex items-center gap-1 text-xs font-semibold text-green-600 hover:text-green-700">
              <PackageCheck size={14} /> → Inventario
            </button>
            <button type="button" onClick={handleClearChecked}
              className="flex items-center gap-1 text-xs font-semibold text-red-400 hover:text-red-500">
              <CheckCheck size={14} /> Pulisci
            </button>
          </div>
        </div>
      )}

      {/* Progress */}
      {total > 0 && (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border-subtle)' }}>
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.round((checked / total) * 100)}%`, background: 'linear-gradient(90deg, #22C55E, #16A34A)' }} />
          </div>
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{checked}/{total}</span>
        </div>
      )}

      {/* Search + Sort */}
      {total > 3 && (
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cerca nella lista..."
              className="w-full rounded-xl border pl-9 pr-3 py-2 text-sm
                focus:outline-none focus:ring-2 focus:ring-violet-200 transition-all"
              style={{ borderColor: 'var(--border-subtle)' }} />
          </div>
          <div className="relative">
            <button type="button" onClick={() => setShowSort(!showSort)}
              className="flex items-center gap-1 rounded-xl border px-3 py-2 text-xs font-medium transition-all"
              style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
              <ArrowUpDown size={13} />
            </button>
            {showSort && (
              <div className="absolute right-0 top-full mt-1 z-20 rounded-xl bg-white shadow-lg border p-1 min-w-[140px]"
                style={{ borderColor: 'var(--border-subtle)' }}>
                {SORT_OPTIONS.map((opt) => (
                  <button key={opt.id} type="button"
                    onClick={() => { setSortBy(opt.id); setShowSort(false) }}
                    className={`w-full text-left rounded-lg px-3 py-2 text-xs transition-all
                      ${sortBy === opt.id ? 'bg-violet-50 text-violet-700 font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick add */}
      <div className="card p-3">
        <div className="flex gap-2 mb-2">
          <input type="text" value={quickText}
            onChange={(e) => setQuickText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder='Es: "2 kg pomodori" o "latte"'
            className="flex-1 rounded-xl border px-3 py-2.5 text-sm
              focus:outline-none focus:ring-2 focus:ring-violet-200 transition-all"
            style={{ borderColor: 'var(--border-subtle)' }} />
          <button type="button" onClick={handleQuickAdd} disabled={!quickText.trim()}
            className="rounded-xl px-3 py-2.5 text-white shadow-md
              disabled:opacity-50 transition-all active:scale-95"
            style={{ background: 'var(--gradient-primary)' }}>
            <Plus size={18} />
          </button>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {SHOPPING_CATEGORIES.map((cat) => (
            <button key={cat.id} type="button" onClick={() => setQuickCategory(cat.id)}
              className={`flex-shrink-0 rounded-full px-2.5 py-1 text-xs transition-all
                ${quickCategory === cat.id ? 'text-white shadow-sm' : 'text-gray-600'}`}
              style={quickCategory === cat.id
                ? { background: 'var(--gradient-primary)' }
                : { background: 'var(--border-subtle)' }}>
              {cat.icon}
            </button>
          ))}
        </div>
      </div>

      {/* Items by category */}
      {Object.keys(grouped).length > 0 ? (
        Object.entries(grouped).map(([catId, catItems]) => {
          const cat = SHOPPING_CATEGORIES.find((c) => c.id === catId) || { icon: '📦', label: catId }
          return (
            <div key={catId}>
              <h3 className="text-xs font-semibold uppercase mb-1.5 px-1 tracking-wider"
                style={{ color: 'var(--text-muted)' }}>
                {cat.icon} {cat.label}
              </h3>
              <div className="flex flex-col gap-1">
                {catItems.map((item) => (
                  <div key={item.id}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all
                      ${item.checked ? 'opacity-50' : ''}`}
                    style={{ background: item.checked ? 'var(--border-subtle)' : 'var(--bg-card)', border: item.checked ? 'none' : '1px solid var(--border-subtle)' }}>
                    <button type="button" onClick={() => toggleItem(item.id, item.checked)}
                      className="w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all"
                      style={item.checked
                        ? { background: 'linear-gradient(135deg, #22C55E, #16A34A)', borderColor: '#22C55E', color: 'white' }
                        : { borderColor: 'var(--border-subtle)' }}>
                      {item.checked && <span className="text-xs">✓</span>}
                    </button>
                    <div className="flex-1 min-w-0">
                      <span className={`text-sm ${item.checked ? 'line-through' : ''}`}
                        style={{ color: item.checked ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                        {item.name}
                      </span>
                      {(item.quantity > 1 || item.unit) && (
                        <span className="text-xs ml-1" style={{ color: 'var(--text-muted)' }}>
                          ({item.quantity}{item.unit ? ` ${item.unit}` : ''})
                        </span>
                      )}
                    </div>
                    <button type="button" onClick={() => deleteShoppingItem(item.id)}
                      className="p-1 text-gray-300 hover:text-red-500 transition-colors">
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
          icon={ShoppingCart}
          title="Lista vuota"
          description="Aggiungi qualcosa dalla barra sopra o usa la voce"
        />
      )}
    </>
  )
}

// ═══════════════════════════════════════════════════════════
// INVENTORY TAB — Redesigned with location shelves
// ═══════════════════════════════════════════════════════════

const LOCATION_STYLES = {
  dispensa: { gradient: 'linear-gradient(135deg, #F5F0E8, #E8DCC8)', accent: '#92400E', iconBg: '#FDE68A' },
  frigo:    { gradient: 'linear-gradient(135deg, #EBF5FF, #DBEAFE)', accent: '#1E40AF', iconBg: '#BFDBFE' },
  freezer:  { gradient: 'linear-gradient(135deg, #F0F4FF, #E0E7FF)', accent: '#4338CA', iconBg: '#C7D2FE' },
  altro:    { gradient: 'linear-gradient(135deg, #F5F3FF, #EDE9FE)', accent: '#6D28D9', iconBg: '#DDD6FE' },
}

function InventoryTab({ familyId, setToast }) {
  const items = useInventory(familyId)
  const expiring = useExpiringItems(familyId, 3)

  const [showAdd, setShowAdd] = useState(false)
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unit, setUnit] = useState('pz')
  const [location, setLocation] = useState('dispensa')
  const [expiryDate, setExpiryDate] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // OCR state
  const [scanning, setScanning] = useState(false)
  const [ocrProducts, setOcrProducts] = useState(null)
  const [ocrSaving, setOcrSaving] = useState(false)

  // Collapsed shelves (persisted in localStorage)
  const [collapsed, setCollapsed] = useState(readPersistedCollapse)
  const toggleCollapse = (locId) => setCollapsed((prev) => {
    const updated = { ...prev, [locId]: !prev[locId] }
    try { localStorage.setItem(DISPENSA_COLLAPSE_KEY, JSON.stringify(updated)) } catch { /* noop */ }
    return updated
  })

  // Filter by search
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items
    const q = searchQuery.trim().toLowerCase()
    return items.filter((i) => i.name.toLowerCase().includes(q))
  }, [items, searchQuery])

  // Group by location
  const grouped = useMemo(() => {
    const g = {}
    for (const item of filteredItems) {
      const loc = item.location || 'altro'
      if (!g[loc]) g[loc] = []
      g[loc].push(item)
    }
    return g
  }, [filteredItems])

  const handleAdd = useCallback(async () => {
    if (!name.trim()) return
    await addInventoryItem({
      name: name.trim(),
      quantity: parseFloat(quantity) || 1,
      unit, location,
      expiry_date: expiryDate || null,
    })
    setName(''); setQuantity('1'); setExpiryDate(''); setShowAdd(false)
    setToast({ message: `${name.trim()} aggiunto` })
  }, [name, quantity, unit, location, expiryDate, setToast])

  // OCR
  const handleScanReceipt = useCallback(async () => {
    try {
      setScanning(true)
      const imageData = await captureReceipt()
      const products = await extractProductsFromReceipt(imageData)
      if (products.length === 0) {
        setToast({ message: 'Nessun prodotto trovato nello scontrino' })
      } else {
        setOcrProducts(products.map((p) => ({ ...p, selected: true })))
      }
    } catch (err) {
      if (err.message !== 'Annullato') setToast({ message: `Errore: ${err.message}` })
    } finally {
      setScanning(false)
    }
  }, [setToast])

  const handleOcrConfirm = useCallback(async () => {
    if (!ocrProducts) return
    setOcrSaving(true)
    const selected = ocrProducts.filter((p) => p.selected)
    const result = await addReceiptToInventory(selected)
    setOcrProducts(null)
    setOcrSaving(false)
    setToast({ message: `${result.added} aggiunti, ${result.merged} aggiornati` })
  }, [ocrProducts, setToast])

  const toggleOcrProduct = (idx) => {
    setOcrProducts((prev) => prev.map((p, i) => i === idx ? { ...p, selected: !p.selected } : p))
  }

  const isExpired = (date) => date && date <= new Date().toISOString().slice(0, 10)
  const isExpiringSoon = (date) => {
    if (!date) return false
    const limit = new Date()
    limit.setDate(limit.getDate() + 3)
    return date <= limit.toISOString().slice(0, 10) && !isExpired(date)
  }

  // Summary stats
  const totalItems = items.length
  const filteredCount = filteredItems.length
  const expiringCount = expiring.length

  return (
    <>
      {/* Summary bar */}
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{totalItems}</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>prodotti in casa</p>
          </div>
          <div className="flex gap-3">
            {LOCATIONS.map((loc) => {
              const count = grouped[loc.id]?.length || 0
              return (
                <div key={loc.id} className="text-center">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg mb-0.5"
                    style={{ background: LOCATION_STYLES[loc.id]?.iconBg || '#E5E7EB' }}>
                    {loc.icon}
                  </div>
                  <span className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>{count}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button type="button" onClick={handleScanReceipt} disabled={scanning}
          className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white
            disabled:opacity-50 transition-all active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', boxShadow: '0 4px 16px rgba(245,158,11,0.35)' }}>
          {scanning ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
          {scanning ? 'Analisi...' : 'Scansiona Scontrino'}
        </button>
        <button type="button" onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 rounded-xl px-4 py-3 text-sm font-semibold text-white
            transition-all active:scale-95"
          style={{ background: 'var(--gradient-primary)', boxShadow: 'var(--shadow-glow)' }}>
          <Plus size={16} /> Aggiungi
        </button>
      </div>

      {/* Search */}
      {totalItems > 5 && (
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cerca nell'inventario..."
            className="w-full rounded-xl border pl-9 pr-3 py-2.5 text-sm
              focus:outline-none focus:ring-2 focus:ring-violet-200 transition-all"
            style={{ borderColor: 'var(--border-subtle)' }} />
        </div>
      )}

      {/* Expiry alert */}
      {expiringCount > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-start gap-3 px-4 py-3"
            style={{ background: 'linear-gradient(135deg, #FEF3C7, #FDE68A40)' }}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(245,158,11,0.2)' }}>
              <AlertTriangle size={16} className="text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold text-amber-800">
                {expiringCount} prodott{expiringCount === 1 ? 'o' : 'i'} in scadenza!
              </p>
              <p className="text-xs text-amber-600 mt-0.5">
                {expiring.slice(0, 4).map((e) => e.name).join(', ')}
                {expiring.length > 4 ? ` +${expiring.length - 4}` : ''}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Location shelves */}
      {filteredCount > 0 ? (
        <div className="flex flex-col gap-3">
          {LOCATIONS.map((loc) => {
            const locItems = grouped[loc.id]
            if (!locItems || locItems.length === 0) return null
            const style = LOCATION_STYLES[loc.id] || LOCATION_STYLES.altro
            const isCollapsed = collapsed[loc.id]

            return (
              <div key={loc.id} className="card overflow-hidden">
                {/* Shelf header */}
                <button
                  type="button"
                  onClick={() => toggleCollapse(loc.id)}
                  className="flex items-center gap-3 w-full px-4 py-3 transition-all"
                  style={{ background: style.gradient }}
                >
                  <span className="text-xl">{loc.icon}</span>
                  <div className="flex-1 text-left">
                    <span className="text-sm font-bold" style={{ color: style.accent }}>
                      {loc.label}
                    </span>
                    <span className="text-xs font-medium ml-2" style={{ color: `${style.accent}99` }}>
                      {locItems.length} prodott{locItems.length === 1 ? 'o' : 'i'}
                    </span>
                  </div>
                  {isCollapsed
                    ? <ChevronDown size={16} style={{ color: style.accent }} />
                    : <ChevronUp size={16} style={{ color: style.accent }} />}
                </button>

                {/* Products */}
                {!isCollapsed && (
                  <div className="px-3 py-2 flex flex-col gap-1 animate-fade-in">
                    {locItems.map((item) => {
                      const expired = isExpired(item.expiry_date)
                      const expSoon = isExpiringSoon(item.expiry_date)
                      return (
                        <div key={item.id}
                          className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all"
                          style={{
                            background: expired ? 'rgba(239,68,68,0.06)' : expSoon ? 'rgba(245,158,11,0.06)' : 'transparent',
                            borderLeft: expired ? '3px solid #EF4444' : expSoon ? '3px solid #F59E0B' : '3px solid transparent',
                          }}>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                                {item.name}
                              </span>
                              <span className="text-xs rounded-md px-1.5 py-0.5 font-medium"
                                style={{ background: 'var(--border-subtle)', color: 'var(--text-muted)' }}>
                                {item.quantity} {item.unit || 'pz'}
                              </span>
                            </div>
                            {item.expiry_date && (
                              <span className={`text-[11px] font-medium mt-0.5 inline-block
                                ${expired ? 'text-red-500' : expSoon ? 'text-amber-500' : 'text-gray-400'}`}>
                                {expired ? '⛔ Scaduto' : expSoon ? '⚠️ Scade' : 'Scad.'} {item.expiry_date.slice(5).replace('-', '/')}
                              </span>
                            )}
                          </div>
                          <button type="button" onClick={() => deleteInventoryItem(item.id)}
                            className="p-1.5 rounded-lg text-gray-300 hover:bg-red-50 hover:text-red-500 transition-all">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <EmptyState
          icon={Package}
          title="Inventario vuoto"
          description="Scansiona uno scontrino o aggiungi manualmente i prodotti"
          action={() => setShowAdd(true)}
          actionLabel="Aggiungi prodotto"
        />
      )}

      {/* Add product modal */}
      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Aggiungi prodotto">
        <div className="flex flex-col gap-3 p-4">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome prodotto"
            className="w-full rounded-xl border px-4 py-3 text-sm font-semibold
              focus:outline-none focus:ring-2 focus:ring-violet-200 transition-all"
            style={{ borderColor: 'var(--border-subtle)' }}
            autoFocus />
          <div className="flex gap-2">
            <input type="text" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)}
              placeholder="Qta" className="w-20 rounded-xl border px-3 py-2.5 text-sm text-center
              focus:outline-none focus:ring-2 focus:ring-violet-200"
              style={{ borderColor: 'var(--border-subtle)' }} />
            <select value={unit} onChange={(e) => setUnit(e.target.value)}
              className="rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
              style={{ borderColor: 'var(--border-subtle)' }}>
              {['pz', 'kg', 'g', 'L', 'mL'].map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
            <div className="flex-1 flex gap-1.5 overflow-x-auto">
              {LOCATIONS.map((l) => (
                <button key={l.id} type="button" onClick={() => setLocation(l.id)}
                  className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all
                    ${location === l.id ? 'ring-2 ring-violet-400 scale-105' : ''}`}
                  style={{ background: LOCATION_STYLES[l.id]?.iconBg || '#E5E7EB' }}>
                  {l.icon}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>
              Scadenza (opzionale)
            </label>
            <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)}
              className="w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
              style={{ borderColor: 'var(--border-subtle)' }} />
          </div>
          <button type="button" onClick={handleAdd} disabled={!name.trim()}
            className="w-full rounded-xl py-3 text-sm font-bold text-white
              disabled:opacity-50 transition-all active:scale-[0.98]"
            style={{ background: 'var(--gradient-primary)', boxShadow: 'var(--shadow-glow)' }}>
            Salva
          </button>
        </div>
      </Modal>

      {/* OCR Results Review Modal */}
      <Modal isOpen={ocrProducts !== null} onClose={() => setOcrProducts(null)} title="Prodotti dallo scontrino">
        <div className="flex flex-col gap-2 p-4 max-h-[60vh] overflow-y-auto">
          {ocrProducts && (
            <>
              <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                Trovati {ocrProducts.length} prodotti. Deseleziona quelli da non aggiungere.
              </p>
              {ocrProducts.map((p, i) => (
                <button key={i} type="button" onClick={() => toggleOcrProduct(i)}
                  className={`flex items-center gap-3 rounded-xl p-3 border transition-all text-left
                    ${p.selected ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200 opacity-50'}`}>
                  <div className={`w-5 h-5 rounded-lg flex items-center justify-center flex-shrink-0 transition-all
                    ${p.selected ? 'text-white' : 'bg-gray-200'}`}
                    style={p.selected ? { background: 'linear-gradient(135deg, #22C55E, #16A34A)' } : {}}>
                    {p.selected && <Check size={12} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{p.name}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      x{p.quantity || 1}
                      {p.price ? ` · €${p.price}` : ''}
                      {p.category ? ` · ${p.category}` : ''}
                    </p>
                  </div>
                </button>
              ))}
              <button type="button" onClick={handleOcrConfirm}
                disabled={ocrSaving || !ocrProducts.some((p) => p.selected)}
                className="w-full rounded-xl py-3 text-sm font-bold text-white
                  disabled:opacity-50 transition-all active:scale-[0.98] mt-2"
                style={{ background: 'linear-gradient(135deg, #22C55E, #16A34A)', boxShadow: '0 4px 16px rgba(34,197,94,0.3)' }}>
                {ocrSaving ? 'Aggiungo...' : `Aggiungi ${ocrProducts.filter((p) => p.selected).length} all'inventario`}
              </button>
            </>
          )}
        </div>
      </Modal>
    </>
  )
}
