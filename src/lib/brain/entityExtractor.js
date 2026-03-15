/**
 * entityExtractor.js — Estrazione entità: date, orari, importi, persone, logistica, luoghi, attività.
 */

import { tokenize, levenshtein, fuzzyMatch } from './textUtils.js'

// ═══════════════════════════════════════════════════════════════
// DATE PARSING
// ═══════════════════════════════════════════════════════════════
const WEEKDAYS_IT = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato']
const WEEKDAYS_ALT = ['domenica', 'lunedi', 'martedi', 'mercoledi', 'giovedi', 'venerdi', 'sabato']

export function parseLocalDate(text, today = new Date()) {
  const lower = text.toLowerCase()
  const todayStr = today.toISOString().slice(0, 10)
  const tomorrow = new Date(today.getTime() + 86400000).toISOString().slice(0, 10)
  const dopodomani = new Date(today.getTime() + 172800000).toISOString().slice(0, 10)

  if (/\boggi\b|\bstasera\b|\bstamattina\b|\bstanotte\b|\badesso\b/.test(lower)) return todayStr
  if (/\bdomani\b|\bdomattina\b/.test(lower)) return tomorrow
  if (/\bdopodomani\b/.test(lower)) return dopodomani

  // "settimana prossima" → +7 giorni
  if (/settimana\s+prossima/i.test(lower)) {
    return new Date(today.getTime() + 7 * 86400000).toISOString().slice(0, 10)
  }

  // "mese prossimo" → primo del mese prossimo
  if (/mese\s+prossimo/i.test(lower)) {
    const next = new Date(today.getFullYear(), today.getMonth() + 1, 1)
    return next.toISOString().slice(0, 10)
  }

  // "tra X giorni" → +X giorni
  const traMatch = lower.match(/tra\s+(\d+)\s+giorni/)
  if (traMatch) {
    return new Date(today.getTime() + parseInt(traMatch[1]) * 86400000).toISOString().slice(0, 10)
  }

  // Giorni della settimana — incluso "prossimo lunedì", "lunedì prossimo"
  for (let i = 0; i < WEEKDAYS_IT.length; i++) {
    const dayName = WEEKDAYS_IT[i]
    const dayNameAlt = WEEKDAYS_ALT[i]
    if (lower.includes(dayName) || lower.includes(dayNameAlt)) {
      const currentDay = today.getDay()
      let daysAhead = i - currentDay
      if (daysAhead <= 0) daysAhead += 7
      // "prossimo lunedì" o "lunedì prossimo" → se è questa settimana, aggiungi 7
      const hasProssimo = /prossim[oa]/i.test(lower)
      if (hasProssimo && daysAhead <= 6) {
        const dist = i - currentDay
        if (dist > 0) daysAhead = dist + 7
      }
      return new Date(today.getTime() + daysAhead * 86400000).toISOString().slice(0, 10)
    }
  }

  // Fuzzy match giorni
  const tokens = tokenize(lower)
  for (const token of tokens) {
    if (token.length >= 5) {
      const match = fuzzyMatch(token, [...WEEKDAYS_IT, ...WEEKDAYS_ALT])
      if (match && match.distance <= 1) {
        const idx = WEEKDAYS_IT.findIndex(d => d === match.target) !== -1
          ? WEEKDAYS_IT.findIndex(d => d === match.target)
          : WEEKDAYS_ALT.findIndex(d => d === match.target)
        if (idx >= 0) {
          const currentDay = today.getDay()
          let daysAhead = idx - currentDay
          if (daysAhead <= 0) daysAhead += 7
          return new Date(today.getTime() + daysAhead * 86400000).toISOString().slice(0, 10)
        }
      }
    }
  }

  // "il 15", "il 3 marzo"
  const months = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
    'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']
  const dateMatch = lower.match(/il\s+(\d{1,2})(?:\s+(?:di\s+)?(\w+))?/)
  if (dateMatch) {
    const day = parseInt(dateMatch[1])
    if (day >= 1 && day <= 31) {
      let month = today.getMonth()
      if (dateMatch[2]) {
        const mMatch = fuzzyMatch(dateMatch[2], months)
        if (mMatch) month = months.indexOf(mMatch.target)
      }
      let year = today.getFullYear()
      const d = new Date(year, month, day)
      if (d < today) {
        if (!dateMatch[2]) month += 1; else year += 1
      }
      return new Date(year, month, day).toISOString().slice(0, 10)
    }
  }

  return todayStr
}

// ═══════════════════════════════════════════════════════════════
// TIME PARSING
// ═══════════════════════════════════════════════════════════════
export function parseLocalTime(text) {
  const lower = text.toLowerCase()
  const m1 = lower.match(/all[e']?\s*(\d{1,2})(?:[:.:](\d{2}))?/)
  if (m1) return `${m1[1].padStart(2, '0')}:${m1[2] || '00'}`
  const m2 = lower.match(/(?:verso|per|intorno\s+all[e']?)\s*(?:le\s+)?(\d{1,2})(?:[:.:](\d{2}))?/)
  if (m2) return `${m2[1].padStart(2, '0')}:${m2[2] || '00'}`
  const m3 = lower.match(/(?:ore|h)\s*(\d{1,2})(?:[:.:](\d{2}))?/)
  if (m3) return `${m3[1].padStart(2, '0')}:${m3[2] || '00'}`
  return null
}

/**
 * Range di default per periodi della giornata (usati quando manca orario esplicito)
 */
export const DAY_PERIOD_RANGES = {
  mattina:    { start: '06:00', end: '14:00' },
  pomeriggio: { start: '13:00', end: '18:00' },
  sera:       { start: '19:00', end: '24:00' },
  notte:      { start: '00:00', end: '06:00' },
}

/**
 * Estrae un range di orari: "dalle 8 alle 14", "dalle 8:30 alle 14:00", "da le 9 a le 17"
 * Se non trova un range esplicito, cerca un periodo (mattina/pomeriggio/sera) e usa il default.
 * Ritorna { start: 'HH:MM', end: 'HH:MM' } o null
 */
export function parseTimeRange(text) {
  const lower = text.toLowerCase()

  // 1. Range esplicito: "dalle X alle Y"
  const m = lower.match(/dall[e']?\s*(\d{1,2})(?:[:.:](\d{2}))?\s+all[e']?\s*(\d{1,2})(?:[:.:](\d{2}))?/)
  if (m) {
    return {
      start: `${m[1].padStart(2, '0')}:${m[2] || '00'}`,
      end: `${m[3].padStart(2, '0')}:${m[4] || '00'}`,
    }
  }

  // 2. Range esplicito: "da le 9 a le 17"
  const m2 = lower.match(/da\s+le?\s*(\d{1,2})(?:[:.:](\d{2}))?\s+a\s+le?\s*(\d{1,2})(?:[:.:](\d{2}))?/)
  if (m2) {
    return {
      start: `${m2[1].padStart(2, '0')}:${m2[2] || '00'}`,
      end: `${m2[3].padStart(2, '0')}:${m2[4] || '00'}`,
    }
  }

  // 3. Periodo della giornata → range di default
  for (const [period, range] of Object.entries(DAY_PERIOD_RANGES)) {
    if (lower.includes(period)) return { ...range }
  }

  return null
}

// ═══════════════════════════════════════════════════════════════
// AMOUNT PARSING
// ═══════════════════════════════════════════════════════════════
export function parseAmount(text) {
  const lower = text.toLowerCase()
  const m = lower.match(/(\d+[.,]?\d*)\s*(?:euro|€)/) || lower.match(/(?:euro|€)\s*(\d+[.,]?\d*)/)
  if (m) return parseFloat(m[1].replace(',', '.'))
  const m2 = lower.match(/(?:spes[oaie]|pagat[oaie]|costat[oaie]|cost[oaie])\s+(\d+[.,]?\d*)/)
  if (m2) return parseFloat(m2[1].replace(',', '.'))
  // "3,90 per il giornale" — importo con contesto spesa senza verbo esplicito
  const m3 = lower.match(/(\d+[.,]\d{2})\s+(?:per|di|al|in)\b/)
  if (m3) return parseFloat(m3[1].replace(',', '.'))
  return null
}

// ═══════════════════════════════════════════════════════════════
// PERSON EXTRACTION
// ═══════════════════════════════════════════════════════════════
export function extractPersons(text, members) {
  const lower = text.toLowerCase()
  const found = []
  for (const m of members) {
    const name = m.name.toLowerCase()
    if (lower.includes(name)) {
      found.push({ ...m, matchScore: 1.0 })
      continue
    }
    // Controlla alias (nonna, mamma, nonno, ecc.)
    if (m.aliases) {
      let aliasFound = false
      for (const alias of m.aliases) {
        if (lower.includes(alias.toLowerCase())) {
          found.push({ ...m, matchScore: 0.9 })
          aliasFound = true
          break
        }
      }
      if (aliasFound) continue
    }
    if (name.length >= 3) {
      const tokens = tokenize(lower)
      for (const token of tokens) {
        const d = levenshtein(token, name)
        if (d <= 1 && d < name.length * 0.4) {
          found.push({ ...m, matchScore: 1 - (d / name.length) })
          break
        }
      }
    }
  }
  return found.sort((a, b) => lower.indexOf(a.name.toLowerCase()) - lower.indexOf(b.name.toLowerCase()))
}

// ═══════════════════════════════════════════════════════════════
// LOGISTICS EXTRACTION
// ═══════════════════════════════════════════════════════════════
/**
 * Estrae logistica E ruoli semantici dalla frase.
 *
 * "Cristian deve andare a prendere Asia alla stazione"
 *   → driver: Cristian, subject: Asia, actionVerb: 'prendere'
 *
 * "Chiara deve portare Asia alla palestra"
 *   → driver: Chiara, subject: Asia, actionVerb: 'portare'
 *
 * Ritorna: { accompaniedBy, pickupBy, subject, driver, actionVerb }
 *   actionVerb: 'portare' | 'prendere' | 'riprendere' | 'ritirare' | null
 */
export function extractLogistics(text, members) {
  const lower = text.toLowerCase()
  console.log('[Brain] extractLogistics input:', { text: lower, memberNames: members.map(m => m.name), memberCount: members.length })
  let accompaniedBy = null
  let pickupBy = null
  let subject = null   // chi è il soggetto dell'evento (es. Asia)
  let driver = null     // chi è il driver/accompagnatore
  let actionVerb = null // il verbo dell'azione: 'portare' vs 'prendere' ecc.

  const findMemberByName = (name) => {
    if (!name) return null
    const n = name.toLowerCase()
    return members.find(m => m.name.toLowerCase() === n)
      || members.find(m => m.aliases?.some(a => a.toLowerCase() === n))
      || members.find(m => m.name.toLowerCase().startsWith(n))
      || members.find(m => levenshtein(m.name.toLowerCase(), n) <= 1)
      || null
  }

  const NAME = '[a-zA-Z\u00C0-\u00FF]+'

  // ── Pattern "X porta/accompagna Y" — X=driver, Y=soggetto ──
  // Member-aware: cerca nomi familiari noti prima del verbo per evitare
  // di catturare parole temporali (dopodomani, lunedì, ecc.) come driver
  const LOGISTICS_VERBS_PORTA = /\s+(?:deve\s+)?(?:port(?:are|a)|accompagn(?:are|a))\s+([a-zA-Z\u00C0-\u00FF]+)/
  for (const mem of members) {
    const allNames = [mem.name.toLowerCase(), ...(mem.aliases || []).map(a => a.toLowerCase())]
    for (const driverName of allNames) {
      const driverIdx = lower.indexOf(driverName)
      if (driverIdx === -1) continue
      const afterDriver = lower.substring(driverIdx + driverName.length)
      const verbMatch = afterDriver.match(LOGISTICS_VERBS_PORTA)
      if (verbMatch) {
        const s = findMemberByName(verbMatch[1])
        console.log('[Brain] portare member-aware:', { driverName: mem.name, subjectName: s?.name, afterSnippet: afterDriver.substring(0, 40) })
        if (s && s.id !== mem.id) {
          driver = mem; accompaniedBy = mem; subject = s; actionVerb = 'portare'
          break
        }
      }
    }
    if (driver) break
  }

  // ── Dual logistics: "e NAME la/lo riprende" nella stessa frase ──
  if (driver && subject && !pickupBy) {
    const pickupDualRe = /\be\s+([a-zA-Z\u00C0-\u00FF]+)\s+(?:l[aoei]\s+|l['']\s*)?(?:riprende|riprenderà|va\s+a\s+prendere|prende|prenderà|viene\s+a\s+prendere)/i
    const pickupDualM = lower.match(pickupDualRe)
    console.log('[Brain] dual pickup regex test:', { matched: !!pickupDualM, captured: pickupDualM?.[1] })
    if (pickupDualM) {
      const pb = findMemberByName(pickupDualM[1])
      console.log('[Brain] dual pickup findMember:', { name: pickupDualM[1], found: pb?.name, driverId: driver?.id, pbId: pb?.id })
      if (pb && pb.id !== driver.id) {
        pickupBy = pb
        console.log('[Brain] dual logistics pickup detected:', { pickupBy: pb.name })
      }
    }
  }
  // ── Pattern "X [parole intermedie] deve/va a prendere Y" — X=driver, Y=soggetto ──
  // Member-aware: cerca nomi familiari noti prima del verbo pickup
  if (!driver && !subject) {
    const PICKUP_VERB_PATTERNS = [
      { re: /\s+(?:deve\s+)?(?:andare\s+a\s+|va\s+a\s+)prender[eao]\s+([a-zA-Z\u00C0-\u00FF]+)/, verb: 'prendere' },
      { re: /\s+(?:deve\s+)prender[eao]\s+([a-zA-Z\u00C0-\u00FF]+)/, verb: 'prendere' },
      { re: /\s+(?:deve\s+)?riprende(?:re)?\s+([a-zA-Z\u00C0-\u00FF]+)/, verb: 'riprendere' },
      { re: /\s+(?:deve\s+)?(?:andare\s+a\s+)?ritira(?:re)?\s+([a-zA-Z\u00C0-\u00FF]+)/, verb: 'ritirare' },
    ]
    for (const mem of members) {
      const allNames = [mem.name.toLowerCase(), ...(mem.aliases || []).map(a => a.toLowerCase())]
      for (const driverName of allNames) {
        const driverIdx = lower.indexOf(driverName)
        if (driverIdx === -1) continue
        const afterDriver = lower.substring(driverIdx + driverName.length)
        for (const { re, verb } of PICKUP_VERB_PATTERNS) {
          const verbMatch = afterDriver.match(re)
          if (verbMatch) {
            const s = findMemberByName(verbMatch[1])
            if (s && s.id !== mem.id) {
              driver = mem; pickupBy = mem; subject = s; actionVerb = verb
              console.log('[Brain] pickup member-aware:', { driver: mem.name, subject: s.name, verb })
              break
            }
          }
        }
        if (driver) break
      }
      if (driver) break
    }
  }
  // ── Pattern collettivi con alias di gruppo: "prendere le bambine/i ragazzi" ──
  if (!driver && !subject) {
    const groupAliases = [
      { re: /(?:prender[eao]|riprender[eao]|ritirare|portare)\s+(?:le\s+)?(?:bambine|ragazze|figlie|bimbe)\b/i, verb: 'prendere', filter: m => m.role === 'child' },
      { re: /(?:prender[eao]|riprender[eao]|ritirare|portare)\s+(?:i\s+)?(?:bambini|ragazzi|figli|bimbi)\b/i, verb: 'prendere', filter: m => m.role === 'child' },
      { re: /(?:accompagn(?:are|a))\s+(?:le\s+)?(?:bambine|ragazze|figlie|bimbe)\b/i, verb: 'portare', filter: m => m.role === 'child' },
      { re: /(?:viene|va)\s+a\s+prender[eao]\s+(?:le\s+)?(?:bambine|ragazze|figlie|bimbe)\b/i, verb: 'prendere', filter: m => m.role === 'child' },
    ]
    for (const { re: aliasRe, verb: aliasVerb } of groupAliases) {
      if (aliasRe.test(lower)) {
        // Usa il primo figlio come subject rappresentativo
        const children = members.filter(m => m.role === 'child')
        if (children.length > 0) {
          subject = children[0]
          actionVerb = aliasVerb
          // Cerca driver nella frase (es: "la nonna viene a prendere le bambine")
          for (const m of members) {
            if (m.role !== 'child' && lower.includes(m.name.toLowerCase())) {
              driver = m
              if (aliasVerb === 'prendere' || aliasVerb === 'riprendere') pickupBy = m
              else accompaniedBy = m
              break
            }
            // Check aliases
            if (m.aliases) {
              for (const alias of m.aliases) {
                if (lower.includes(alias.toLowerCase())) {
                  driver = m
                  if (aliasVerb === 'prendere' || aliasVerb === 'riprendere') pickupBy = m
                  else accompaniedBy = m
                  break
                }
              }
            }
            if (driver) break
          }
          break
        }
      }
    }
  }

  // ── Pattern collettivi: "dobbiamo/devo/bisogna andare a prendere NAME" ──
  // Nessun driver esplicito, ma c'è un soggetto (la persona da prendere)
  if (!driver && !subject) {
    const collectivePickupPatterns = [
      { re: new RegExp(`(?:dobbiamo|devo|devono|bisogna|occorre|tocca)\\s+(?:andare\\s+a\\s+|passare\\s+a\\s+)?prender[eao]\\s+(?:la\\s+|il\\s+|l[''']\\s*)?(${NAME})`), verb: 'prendere' },
      { re: new RegExp(`(?:andiamo|vado|vanno)\\s+a\\s+prender[eao]\\s+(?:la\\s+|il\\s+|l[''']\\s*)?(${NAME})`), verb: 'prendere' },
      { re: new RegExp(`(?:dobbiamo|devo|devono|bisogna)\\s+(?:andare\\s+a\\s+)?riprender[eao]\\s+(?:la\\s+|il\\s+|l[''']\\s*)?(${NAME})`), verb: 'riprendere' },
      { re: new RegExp(`(?:dobbiamo|devo|devono|bisogna|tocca)\\s+(?:andare\\s+a\\s+)?ritira(?:re)?\\s+(?:la\\s+|il\\s+|l[''']\\s*)?(${NAME})`), verb: 'ritirare' },
      { re: new RegExp(`(?:dobbiamo|devo|devono|bisogna)\\s+(?:andare\\s+a\\s+)?port(?:are|a)\\s+(?:la\\s+|il\\s+|l[''']\\s*)?(${NAME})`), verb: 'portare' },
    ]
    for (const { re, verb } of collectivePickupPatterns) {
      const m = lower.match(re)
      if (m) {
        const s = findMemberByName(m[1])
        if (s) {
          subject = s
          actionVerb = verb
          // driver è il currentMember o resta null (collettivo)
          break
        }
      }
    }
  }

  // ── Pattern semplice: "la porta X", "lo riprende X" ──
  if (!accompaniedBy && !driver) {
    const portaPatterns = [
      { re: /(?:l[aoei]|ci|li|le)\s+port[ai]\s+(\w+)/, verb: 'portare' },
      { re: /accompagnat[oa]\s+da\s+(\w+)/, verb: 'portare' },
      { re: /port[ai]t[oa]\s+da\s+(\w+)/, verb: 'portare' },
    ]
    for (const { re, verb } of portaPatterns) {
      const m = lower.match(re)
      if (m) {
        accompaniedBy = findMemberByName(m[1])
        if (accompaniedBy) { driver = accompaniedBy; actionVerb = verb; break }
      }
    }
  }

  if (!pickupBy && !driver) {
    const riprendePatterns = [
      { re: /(?:l[aoei]|ci|li|le)\s+(?:riprende|va\s+a\s+prendere)\s+(\w+)/, verb: 'prendere' },
      { re: /viene\s+a\s+prender[elao]+\s+(\w+)/, verb: 'prendere' },
      { re: /ripres[oa]\s+da\s+(\w+)/, verb: 'riprendere' },
    ]
    for (const { re, verb } of riprendePatterns) {
      const m = lower.match(re)
      if (m) {
        pickupBy = findMemberByName(m[1])
        if (pickupBy) { driver = pickupBy; actionVerb = verb; break }
      }
    }
  }

  console.log('[Brain] extractLogistics:', { driver: driver?.name, subject: subject?.name, accompaniedBy: accompaniedBy?.name, pickupBy: pickupBy?.name, actionVerb })
  return { accompaniedBy, pickupBy, subject, driver, actionVerb }
}

// ═══════════════════════════════════════════════════════════════
// LOCATION EXTRACTION
// ═══════════════════════════════════════════════════════════════
/**
 * Estrae un luogo dalla frase. Cerca pattern come:
 * "alla stazione di Desenzano", "all'aeroporto", "a scuola", "in palestra"
 */
export function extractLocation(text, members = null) {
  const lower = text.toLowerCase()

  // "alla stazione di X", "alla palestra Falcone", "all'aeroporto di Verona"
  const m1 = lower.match(/(?:alla\s+|all['\u2019\u2018`]\s*|al\s+)(stazione|aeroporto|ospedale|porto|stadio|palestra|piscina|scuola|chiesa|fermata|terminal)\s+(?:di\s+)?(.+?)(?:\s+(?:ad?|per|alle?|ore|dove|che|devi?)\s|\s+(?:ad?\s+)?(?:allenar|nuotar|giocar|danzan|studiar)|$)/i)
  if (m1) {
    const locName = m1[2].trim()
    if (locName.length > 0) return `${m1[1]} ${locName}`
    return m1[1]
  }

  // "alla stazione", "all'aeroporto", "al stadio" (senza nome specifico)
  const m2 = lower.match(/(?:alla\s+|all['\u2019\u2018`]\s*|al\s+)(stazione|aeroporto|ospedale|porto|stadio|palestra|piscina|scuola|chiesa|fermata|terminal|campo\s+\w+)(?:\b)/i)
  if (m2) return m2[1]

  // "alla Fenice", "al Garda" — nome proprio dopo preposizione articolata (solo nomi propri iniziale maiuscola)
  const m0b = text.match(/(?:all[ae'''`]\s*|al\s+)([A-Z\u00C0-\u00FF][a-zA-Z\u00C0-\u00FF]{2,})/)
  if (m0b) {
    const locCandidate = m0b[1].trim()
    const structureWords = ['stazione', 'aeroporto', 'ospedale', 'porto', 'stadio', 'palestra', 'piscina', 'scuola', 'chiesa', 'fermata', 'terminal', 'campo', 'ore']
    if (!structureWords.includes(locCandidate.toLowerCase())) {
      if (members) {
        const isMember = members.some(mb => mb.name.toLowerCase() === locCandidate.toLowerCase())
        if (!isMember) return locCandidate
      } else {
        return locCandidate
      }
    }
  }

  // "allenamento Falcone", "palestra Falcone" — nome del luogo dopo keyword
  const TEMPORAL_WORDS = new Set([
    'oggi', 'domani', 'dopodomani', 'stasera', 'domattina', 'stamattina', 'stanotte',
    'alle', 'ore', 'verso', 'dopo', 'prima', 'adesso', 'poi', 'sempre', 'mai',
    'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica',
    'lunedi', 'martedi', 'mercoledi', 'giovedi', 'venerdi',
    'prossimo', 'prossima', 'settimana', 'mese',
  ])
  const m0 = lower.match(/(?:allenamento|palestra|piscina|campo|stadio|scuola)\s+([A-Z\u00C0-\u00FF][a-zA-Z\u00C0-\u00FF]+)/i)
  if (m0) {
    const locCandidate = m0[1].trim()
    // Non matchare nomi di familiari o parole temporali
    if (!TEMPORAL_WORDS.has(locCandidate.toLowerCase())) {
      if (members) {
        const isMember = members.some(mb => mb.name.toLowerCase() === locCandidate.toLowerCase())
        if (!isMember && locCandidate.length > 2) return locCandidate
      } else if (locCandidate.length > 2) {
        return locCandidate
      }
    }
  }

  // "in stazione a Desenzano", "in palestra a Brescia"
  const m3a = lower.match(/\bin\s+(stazione|aeroporto|ospedale|palestra|piscina|ufficio|centro|piazza)\s+(?:a|di)\s+(.+?)(?:\s+(?:ad?|per|alle?|ore|dove|che|devi?)\s|\s+(?:ad?\s+)?(?:allenar|nuotar|giocar|danzan|studiar)|$)/i)
  if (m3a) {
    const locName = m3a[2].trim()
    if (locName.length > 0) return `${m3a[1]} ${locName}`
    return m3a[1]
  }

  // "in stazione", "in palestra" (senza città)
  const m3 = lower.match(/\bin\s+(stazione|aeroporto|ospedale|palestra|piscina|ufficio|centro|piazza)\b/i)
  if (m3) return m3[1]

  return null
}

// ═══════════════════════════════════════════════════════════════
// ACTIVITY EXTRACTION
// ═══════════════════════════════════════════════════════════════
/**
 * Estrae l'attività dalla frase.
 * "portare Asia alla palestra Falcone ad allenarsi" → "Allenamento"
 */
export function extractActivity(text) {
  const lower = text.toLowerCase()

  const activityMap = [
    // ── Pattern composti SPECIFICI (prima dei generici) ──
    { re: /(?:lezione|corso)\s+(?:di\s+)?piano\b/i, label: 'Piano' },
    { re: /(?:lezione|corso)\s+(?:di\s+)?inglese\b/i, label: 'Inglese' },
    { re: /(?:lezione|corso)\s+(?:di\s+)?(?:matematica|mate)\b/i, label: 'Matematica' },
    { re: /(?:lezione|corso)\s+(?:di\s+)?(?:chitarra)\b/i, label: 'Chitarra' },
    { re: /(?:lezione|corso)\s+(?:di\s+)?(?:violino)\b/i, label: 'Violino' },
    { re: /(?:lezione|corso)\s+(?:di\s+)?(?:canto)\b/i, label: 'Canto' },
    { re: /(?:lezione|corso)\s+(?:di\s+)?(?:danza|ballo)\b/i, label: 'Danza' },
    { re: /(?:lezione|corso)\s+(?:di\s+)?(?:nuoto)\b/i, label: 'Nuoto' },
    { re: /(?:lezione|corso)\s+(?:di\s+)?(?:karate|judo)\b/i, label: 'Karate' },
    { re: /saggio\s+(?:di\s+)?(?:danza|ballo|piano|musica|chitarra)\b/i, label: 'Saggio' },
    // ── Verbi di azione ──
    { re: /(?:ad?\s+)?allenar[sme]i/i, label: 'Allenamento' },
    { re: /(?:ad?\s+)?nuota(?:re|ndo)/i, label: 'Nuoto' },
    { re: /(?:ad?\s+)?gioca(?:re|ndo)/i, label: 'Partita' },
    { re: /(?:ad?\s+)?danza(?:re|ndo)|ballare|ballo/i, label: 'Danza' },
    { re: /(?:per\s+)?(?:la\s+)?lezion[ei]/i, label: 'Lezione' },
    { re: /(?:per\s+)?(?:l['']\s*)?allenamento/i, label: 'Allenamento' },
    { re: /(?:per\s+)?(?:la\s+)?partita/i, label: 'Partita' },
    { re: /(?:per\s+)?(?:la\s+)?gara/i, label: 'Gara' },
    { re: /(?:per\s+)?(?:il\s+)?corso/i, label: 'Corso' },
    { re: /(?:per\s+)?(?:la\s+)?visita/i, label: 'Visita' },
    { re: /(?:per\s+)?(?:il\s+)?(?:check-?up|controllo)/i, label: 'Controllo' },
    { re: /(?:per\s+)?(?:la\s+)?(?:ripetizione|lezione\s+privata)/i, label: 'Ripetizione' },
    { re: /(?:ad?\s+)?studia(?:re|ndo)/i, label: 'Studio' },
    { re: /(?:per\s+)?catechismo/i, label: 'Catechismo' },
    { re: /(?:per\s+)?scout/i, label: 'Scout' },
    // ── Sport/attività standalone (senza verbo) ──
    { re: /\b(?:a\s+)?danza\b/i, label: 'Danza' },
    { re: /\b(?:a\s+)?nuoto\b/i, label: 'Nuoto' },
    { re: /\b(?:a\s+)?pallavolo\b/i, label: 'Pallavolo' },
    { re: /\b(?:a\s+)?karate\b/i, label: 'Karate' },
    { re: /\b(?:a\s+)?calcio\b/i, label: 'Calcio' },
    { re: /\b(?:a\s+)?calcetto\b/i, label: 'Calcetto' },
    { re: /\b(?:a\s+)?basket\b/i, label: 'Basket' },
    { re: /\bminibasket\b/i, label: 'Minibasket' },
    { re: /\b(?:a\s+)?tennis\b/i, label: 'Tennis' },
    { re: /\b(?:a\s+)?ginnastica\b/i, label: 'Ginnastica' },
    { re: /\b(?:in\s+)?palestra\b/i, label: 'Palestra' },
    { re: /\b(?:in\s+)?piscina\b/i, label: 'Piscina' },
    { re: /\b(?:a\s+)?(?:il\s+)?piano\b/i, label: 'Piano' },
    { re: /\b(?:di\s+)?inglese\b/i, label: 'Inglese' },
    { re: /\bsaggio\b/i, label: 'Saggio' },
    { re: /\brecita\b/i, label: 'Recita' },
    { re: /\btorneo\b/i, label: 'Torneo' },
    { re: /\bvaccino\b/i, label: 'Vaccino' },
    { re: /\bdentista\b/i, label: 'Dentista' },
    { re: /\bpediatra\b/i, label: 'Pediatra' },
  ]

  for (const { re, label } of activityMap) {
    if (re.test(lower)) return label
  }

  // ─── TAXONOMY FUZZY: cattura varianti non previste dai regex ───
  // Es: "danza moderna", "corso di nuoto", "lezione di piano",
  //     "allenamento calcio", "partita di calcetto"
  const taxonomyFuzzy = fuzzyActivityMatch(lower)
  if (taxonomyFuzzy) return taxonomyFuzzy

  return null
}

// Tassonomia attività → label normalizzato
// Copre varianti colloquiali, abbreviazioni, sinonimi
const ACTIVITY_TAXONOMY = {
  sport: {
    label: 'Sport',
    terms: ['sport', 'attivit sportiv'],
    children: {
      calcio: { label: 'Calcio', terms: ['calcio', 'football', 'pallone'] },
      calcetto: { label: 'Calcetto', terms: ['calcetto', 'calciotto', 'calcio a 5'] },
      basket: { label: 'Basket', terms: ['basket', 'pallacanestro', 'minibasket'] },
      pallavolo: { label: 'Pallavolo', terms: ['pallavolo', 'volley', 'volleyball'] },
      nuoto: { label: 'Nuoto', terms: ['nuoto', 'nuotare', 'vasca'] },
      tennis: { label: 'Tennis', terms: ['tennis', 'padel', 'paddle'] },
      danza: { label: 'Danza', terms: ['danza', 'ballo', 'danza moderna', 'danza classica', 'hip hop', 'hip-hop'] },
      karate: { label: 'Karate', terms: ['karate', 'judo', 'arti marziali', 'taekwondo', 'kung fu'] },
      ginnastica: { label: 'Ginnastica', terms: ['ginnastica', 'ginnastica artistica', 'ginnastica ritmica'] },
      atletica: { label: 'Atletica', terms: ['atletica', 'corsa', 'atletica leggera'] },
      ciclismo: { label: 'Ciclismo', terms: ['ciclismo', 'bici', 'bicicletta', 'mtb'] },
      equitazione: { label: 'Equitazione', terms: ['equitazione', 'cavallo', 'maneggio', 'ippica'] },
      scherma: { label: 'Scherma', terms: ['scherma'] },
      arrampicata: { label: 'Arrampicata', terms: ['arrampicata', 'climbing', 'boulder'] },
      pattinaggio: { label: 'Pattinaggio', terms: ['pattinaggio', 'pattini', 'pattinare'] },
      rugby: { label: 'Rugby', terms: ['rugby'] },
    },
  },
  musica: {
    label: 'Musica',
    terms: ['musica', 'conservatorio'],
    children: {
      piano: { label: 'Piano', terms: ['piano', 'pianoforte'] },
      chitarra: { label: 'Chitarra', terms: ['chitarra'] },
      violino: { label: 'Violino', terms: ['violino'] },
      batteria: { label: 'Batteria', terms: ['batteria'] },
      canto: { label: 'Canto', terms: ['canto', 'coro', 'cantare'] },
    },
  },
  studio: {
    label: 'Studio',
    terms: ['studio', 'studiare', 'compiti', 'ripetizioni'],
    children: {
      inglese: { label: 'Inglese', terms: ['inglese', 'english'] },
      matematica: { label: 'Matematica', terms: ['matematica', 'mate'] },
      italiano: { label: 'Italiano', terms: ['italiano', 'grammatica'] },
    },
  },
  salute: {
    label: 'Visita medica',
    terms: ['visita', 'medico', 'dottore', 'ospedale'],
    children: {
      dentista: { label: 'Dentista', terms: ['dentista', 'ortodont'] },
      pediatra: { label: 'Pediatra', terms: ['pediatra'] },
      oculista: { label: 'Oculista', terms: ['oculista', 'occhio'] },
      ortopedico: { label: 'Ortopedico', terms: ['ortopedico'] },
      fisioterapia: { label: 'Fisioterapia', terms: ['fisioterapia', 'fisio'] },
    },
  },
}

/**
 * Cerca nelle foglie della tassonomia con match parziale.
 * Ritorna il label se trova un termine che compare nella frase.
 */
function fuzzyActivityMatch(lower) {
  for (const group of Object.values(ACTIVITY_TAXONOMY)) {
    // Check children first (più specifici)
    if (group.children) {
      for (const child of Object.values(group.children)) {
        for (const term of child.terms) {
          if (lower.includes(term)) return child.label
        }
      }
    }
    // Fallback al gruppo
    for (const term of group.terms) {
      if (lower.includes(term)) return group.label
    }
  }
  return null
}
