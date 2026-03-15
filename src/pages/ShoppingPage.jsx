/**
 * R3.1 — ShoppingPage: family shopping list with quick-add, check off, categories.
 */
import { useState, useCallback } from 'react'
import useAuthStore from '../store/authStore.js'
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
import useOptimisticList from '../hooks/useOptimisticList.js'
import { moveShoppingToInventory } from '../hooks/useInventory.js'
import { Toast } from '../components/shared/index.js'
import { ShoppingCart, Plus, Trash2, CheckCheck, X, PackageCheck } from 'lucide-react'

export default function ShoppingPage() {
  const { familyId } = useAuthStore()
  const rawItems = useShoppingList(familyId)
  const { items, optimisticUpdate, optimisticRemove, optimisticAdd } = useOptimisticList(rawItems)
  const { total, checked } = useShoppingCount(familyId)

  const [quickText, setQuickText] = useState('')
  const [quickCategory, setQuickCategory] = useState('altro')
  const [toast, setToast] = useState(null)

  const handleQuickAdd = useCallback(async () => {
    if (!quickText.trim()) return
    const parsed = parseQuickAdd(quickText)
    await addShoppingItem({
      ...parsed,
      category: quickCategory,
    })
    setQuickText('')
    setToast({ message: `${parsed.name} aggiunto` })
  }, [quickText, quickCategory])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleQuickAdd()
  }

  const handleClearChecked = async () => {
    const count = await clearCheckedItems(familyId)
    if (count > 0) setToast({ message: `${count} articoli rimossi` })
  }

  // Move checked items to inventory (dispensa)
  const handleMoveToInventory = async () => {
    const checkedItems = items.filter((i) => i.checked)
    if (checkedItems.length === 0) return
    const result = await moveShoppingToInventory(checkedItems)
    setToast({
      message: `${result.moved + result.merged} prodotti spostati in dispensa`
    })
  }

  // Group by category
  const grouped = {}
  for (const item of items) {
    const cat = item.category || 'altro'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(item)
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingCart size={22} className="text-violet-500" />
          <h2 className="text-lg font-bold text-gray-900">Lista Spesa</h2>
        </div>
        {checked > 0 && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleMoveToInventory}
              className="flex items-center gap-1 text-xs font-medium text-green-600 hover:text-green-700 transition-colors"
            >
              <PackageCheck size={14} /> Dispensa ({checked})
            </button>
            <button
              type="button"
              onClick={handleClearChecked}
              className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-red-500 transition-colors"
            >
              <CheckCheck size={14} /> Pulisci
            </button>
          </div>
        )}
      </div>

      {/* Progress */}
      {total > 0 && (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-green-500 transition-all"
              style={{ width: `${Math.round((checked / total) * 100)}%` }}
            />
          </div>
          <span className="text-xs text-gray-400">{checked}/{total}</span>
        </div>
      )}

      {/* Quick add */}
      <div className="rounded-2xl bg-white p-3 shadow-sm border border-gray-100">
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={quickText}
            onChange={(e) => setQuickText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder='Es: "2 kg pomodori" o "latte"'
            className="flex-1 rounded-xl border border-gray-200 px-3 py-2.5 text-sm
              focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
          />
          <button
            type="button"
            onClick={handleQuickAdd}
            disabled={!quickText.trim()}
            className="rounded-xl bg-violet-600 px-3 py-2.5 text-white shadow-md
              hover:bg-violet-700 disabled:opacity-50 transition-all"
          >
            <Plus size={18} />
          </button>
        </div>
        {/* Category quick select */}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {SHOPPING_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setQuickCategory(cat.id)}
              className={`flex-shrink-0 rounded-full px-2.5 py-1 text-xs transition-all
                ${quickCategory === cat.id
                  ? 'bg-violet-600 text-white'
                  : 'bg-gray-100 text-gray-600'
                }`}
            >
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
              <h3 className="text-xs font-semibold text-gray-400 uppercase mb-1.5 px-1">
                {cat.icon} {cat.label}
              </h3>
              <div className="flex flex-col gap-1">
                {catItems.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all
                      ${item.checked ? 'bg-gray-50' : 'bg-white border border-gray-100'}`}
                  >
                    {/* Checkbox — optimistic toggle via React 19 useOptimistic */}
                    <button
                      type="button"
                      onClick={() => optimisticUpdate(item.id, { checked: !item.checked }, () => toggleItem(item.id, item.checked))}
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all
                        ${item.checked
                          ? 'bg-green-500 border-green-500 text-white'
                          : 'border-gray-300 hover:border-violet-400'
                        }`}
                    >
                      {item.checked && <span className="text-xs">✓</span>}
                    </button>

                    {/* Name + quantity */}
                    <div className="flex-1 min-w-0">
                      <span className={`text-sm ${item.checked ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                        {item.name}
                      </span>
                      {(item.quantity > 1 || item.unit) && (
                        <span className="text-xs text-gray-400 ml-1">
                          ({item.quantity}{item.unit ? ` ${item.unit}` : ''})
                        </span>
                      )}
                    </div>

                    {/* Delete — optimistic remove via React 19 useOptimistic */}
                    <button
                      type="button"
                      onClick={() => optimisticRemove(item.id, () => deleteShoppingItem(item.id))}
                      className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )
        })
      ) : (
        <div className="text-center py-10">
          <ShoppingCart size={32} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-400">Lista vuota. Aggiungi qualcosa!</p>
        </div>
      )}

      {toast && <Toast message={toast.message} onClose={() => setToast(null)} />}
    </div>
  )
}
