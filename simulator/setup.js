/**
 * setup.js — Polyfill environment + create family + init NLP
 *
 * MUST be imported FIRST, before any app module.
 * Provides: indexedDB, localStorage, crypto.randomUUID
 */

// ─── POLYFILLS ───────────────────────────────────────────────
import 'fake-indexeddb/auto'

import { randomUUID } from 'node:crypto'
if (!globalThis.crypto?.randomUUID) {
  globalThis.crypto = { ...globalThis.crypto, randomUUID }
}

// localStorage shim (same as vitest.setup.js)
if (typeof globalThis.localStorage === 'undefined') {
  const store = {}
  globalThis.localStorage = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v) },
    removeItem: (k) => { delete store[k] },
    clear: () => { Object.keys(store).forEach(k => delete store[k]) },
    get length() { return Object.keys(store).length },
    key: (i) => Object.keys(store)[i] ?? null,
  }
}

// ─── APP IMPORTS (after polyfills) ───────────────────────────
import { db } from '../src/lib/localDb.js'
import { initNlp } from '../src/lib/brainNlp.js'

// ─── FAMILY DATA ─────────────────────────────────────────────
const FAMILY_ID = 'sim-family-001'

const MEMBERS = [
  {
    id: 'sim-cristian',
    family_id: FAMILY_ID,
    name: 'Cristian',
    role: 'genitore',
    gender: 'M',
    aliases: ['papà', 'papa', 'cri'],
    birth_date: '1979-10-09',
    icon: '👨',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'sim-chiara',
    family_id: FAMILY_ID,
    name: 'Chiara',
    role: 'genitore',
    gender: 'F',
    aliases: ['mamma'],
    birth_date: '1983-05-22',
    icon: '👩',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'sim-viola',
    family_id: FAMILY_ID,
    name: 'Viola',
    role: 'figlio',
    gender: 'F',
    aliases: [],
    birth_date: '2012-04-01',
    icon: '👧',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'sim-asia',
    family_id: FAMILY_ID,
    name: 'Asia',
    role: 'figlio',
    gender: 'F',
    aliases: [],
    birth_date: '2017-04-12',
    icon: '👧',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'sim-mariangela',
    family_id: FAMILY_ID,
    name: 'Mariangela',
    role: 'nonno',
    gender: 'F',
    aliases: ['nonna'],
    birth_date: '1955-03-15',
    icon: '👵',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'sim-roberto',
    family_id: FAMILY_ID,
    name: 'Roberto',
    role: 'nonno',
    gender: 'M',
    aliases: ['nonno'],
    birth_date: '1952-08-20',
    icon: '👴',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
]

/**
 * Initialize DB with family + members, train NLP.
 * Returns { familyId, members, db }
 */
export async function setupSimulator() {
  console.log('[Setup] Creating family and members...')

  // Create family record
  await db.family.put({
    id: FAMILY_ID,
    name: 'Famiglia Perani (Simulazione)',
    members_count: MEMBERS.length,
    created_at: new Date().toISOString(),
  })

  // Create all members
  for (const m of MEMBERS) {
    await db.members.put(m)
  }

  // Init NLP.js (trains the neural network)
  console.log('[Setup] Training NLP.js...')
  await initNlp(FAMILY_ID)

  console.log(`[Setup] Done. Family: ${FAMILY_ID}, Members: ${MEMBERS.length}`)

  return {
    familyId: FAMILY_ID,
    members: MEMBERS,
    db,
  }
}

export { FAMILY_ID, MEMBERS }
