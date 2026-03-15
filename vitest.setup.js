/**
 * Vitest setup: IndexedDB polyfill for Dexie, localStorage for crud getDeviceId().
 */
import 'fake-indexeddb/auto'

const store = {}
if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = {
    getItem(k) { return store[k] ?? null },
    setItem(k, v) { store[k] = String(v) },
    removeItem(k) { delete store[k] },
    clear() { for (const k of Object.keys(store)) delete store[k] },
    get length() { return Object.keys(store).length },
    key(i) { return Object.keys(store)[i] ?? null },
  }
}
