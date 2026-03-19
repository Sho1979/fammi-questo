/**
 * multiIntent.test.js — Test per lo splitter verb-transition e il parsing multi-intent.
 *
 * Verifica che messaggi con intent multipli vengano correttamente splittati
 * e che ogni segmento produca l'azione attesa.
 */

import { describe, it, expect } from 'vitest'
import { splitSentences } from '../textUtils.js'

// ═══════════════════════════════════════════════════════════════
// SPLITTER: verb-transition splitting
// ═══════════════════════════════════════════════════════════════

describe('splitSentences — verb-transition', () => {
  it('splitta "e compra" come cambio intent', () => {
    const result = splitSentences('domani porta Viola alle 8 e compra latte e ricordami bollo')
    expect(result).toHaveLength(3)
    expect(result[0]).toContain('porta Viola')
    expect(result[1]).toContain('compra latte')
    expect(result[2]).toContain('ricordami bollo')
  })

  it('NON splitta "Luca e Giulia" (congiunzione entita, non verbo)', () => {
    const result = splitSentences('stasera vengono a cena Luca e Giulia')
    expect(result).toHaveLength(1)
    expect(result[0]).toContain('Luca e Giulia')
  })

  it('splitta "compra vino e segna 15 euro" dopo comma + verbo', () => {
    const result = splitSentences('stasera vengono a cena Luca e Giulia, compra vino e segna 15 euro')
    expect(result).toHaveLength(3)
    expect(result[0]).toContain('Luca e Giulia')
    expect(result[1]).toContain('compra vino')
    expect(result[2]).toContain('segna 15 euro')
  })

  it('splitta "e segna 12 euro" come cambio intent', () => {
    const result = splitSentences('quando esci passa in farmacia e segna 12 euro')
    expect(result).toHaveLength(2)
    expect(result[0]).toContain('farmacia')
    expect(result[1]).toContain('12 euro')
  })

  it('splitta shopping list + calendario', () => {
    const result = splitSentences('compra pane, latte, uova e porta il cane dal vet giovedì')
    expect(result).toHaveLength(2)
    expect(result[0]).toContain('pane')
    expect(result[1]).toContain('porta il cane')
  })

  it('splitta 3 intent: logistica + shopping + reminder', () => {
    const result = splitSentences('Chiara porta Asia a danza e compra il latte e ricordami la bolletta')
    expect(result).toHaveLength(3)
    expect(result[0]).toContain('porta Asia')
    expect(result[1]).toContain('compra il latte')
    expect(result[2]).toContain('ricordami la bolletta')
  })

  it('splitta expense + task', () => {
    const result = splitSentences('Ho speso 50 euro dal meccanico e prenota la revisione per venerdì')
    expect(result).toHaveLength(2)
    expect(result[0]).toContain('50 euro')
    expect(result[1]).toContain('prenota la revisione')
  })

  it('preserva orari decimali (16.30, 8.00)', () => {
    const result = splitSentences('domani alle 16.30 danza e compra il latte')
    expect(result).toHaveLength(2)
    expect(result[0]).toContain('16.30')
  })

  it('splitta su punteggiatura classica', () => {
    const result = splitSentences('compra il latte. porta Viola a scuola')
    expect(result).toHaveLength(2)
  })

  it('splitta su "e poi" (behavior originale)', () => {
    const result = splitSentences('porta Viola a danza e poi compra il latte')
    expect(result).toHaveLength(2)
  })

  it('non genera segmenti vuoti o corti', () => {
    const result = splitSentences('e compra e porta e segna')
    for (const s of result) {
      expect(s.length).toBeGreaterThan(2)
    }
  })

  // ─── Casi richiesti dall'audit di verifica ───

  it('2 azioni stesso messaggio: importo + task', () => {
    const result = splitSentences('ho speso 30 euro e prenota il dentista')
    expect(result).toHaveLength(2)
    expect(result[0]).toContain('30 euro')
    expect(result[1]).toContain('prenota')
  })

  it('lista items NON splitta su "e" tra prodotti', () => {
    const result = splitSentences('compra pane e latte e uova')
    // "latte" e "uova" non sono verbi d\'azione, non devono splittare
    expect(result).toHaveLength(1)
    expect(result[0]).toContain('pane e latte e uova')
  })

  it('negazione: "non comprare" rimane intero', () => {
    const result = splitSentences('non comprare il latte e porta Viola a scuola')
    expect(result).toHaveLength(2)
    expect(result[0]).toContain('non comprare il latte')
    expect(result[1]).toContain('porta Viola')
  })

  it('evento + shopping + reminder (3 intent)', () => {
    const result = splitSentences('domani dentista alle 10 e compra le medicine e ricordami di chiamare')
    expect(result).toHaveLength(3)
    expect(result[0]).toContain('dentista')
    expect(result[1]).toContain('compra')
    expect(result[2]).toContain('ricordami')
  })

  it('congiunzione complessa: "Marco e Chiara portano Asia e compra il pane"', () => {
    const result = splitSentences('Marco e Chiara portano Asia e compra il pane')
    // "Chiara" non e\' un verbo, non splitta. "compra" e\' un verbo, splitta.
    expect(result).toHaveLength(2)
    expect(result[0]).toContain('Marco e Chiara portano Asia')
    expect(result[1]).toContain('compra il pane')
  })

  it('frase senza "e" resta intera', () => {
    const result = splitSentences('domani mattina Viola ha il dentista alle 10')
    expect(result).toHaveLength(1)
  })

  it('importo + errand: "passa in farmacia e segna 18 euro"', () => {
    const result = splitSentences('passa in farmacia e segna 18 euro')
    expect(result).toHaveLength(2)
    expect(result[0]).toContain('farmacia')
    expect(result[1]).toContain('18 euro')
  })

  it('punteggiatura mista: punto e virgola + verbo', () => {
    const result = splitSentences('dentista alle 10; compra il latte')
    expect(result).toHaveLength(2)
  })

  it('follow-up "e poi" (connettivo esistente)', () => {
    const result = splitSentences('porta Asia a danza e poi compra il latte e poi ricordami la bolletta')
    expect(result.length).toBeGreaterThanOrEqual(3)
  })
})
