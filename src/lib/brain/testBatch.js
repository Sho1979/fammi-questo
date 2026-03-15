/**
 * testBatch.js — Runner di test batch per il Cervellone.
 *
 * Esegue un set di frasi di test, registra i risultati,
 * confronta con aspettative dichiarate.
 *
 * Uso:
 *   import { runTestBatch, TEST_PHRASES } from './testBatch.js'
 *   const results = await runTestBatch(members, familyId, currentMember)
 *
 * Ogni frase ha:
 * - input: la frase da testare
 * - expectedIntent: intent atteso (per valutare correttezza)
 * - expectedEntities: entità minime attese (per valutare completezza)
 * - category: gruppo di test (per filtrare)
 * - difficulty: easy | medium | hard
 *
 * Il runner NON persiste in Dexie automaticamente — persiste solo
 * se il debug è attivo (usa il flusso normale brainParse).
 * Invece restituisce un report strutturato.
 */

import { parseLocally } from './intentClassifier.js'

// ═══════════════════════════════════════════════════════════════
// DATASET DI TEST — Frasi reali famiglia italiana
// ═══════════════════════════════════════════════════════════════

export const TEST_PHRASES = [
  // ─── CALENDAR: basic ───
  { input: 'Domani Asia ha danza alle 16', expectedIntent: 'calendar', expectedEntities: ['person', 'date', 'time', 'activity'], category: 'calendar', difficulty: 'easy' },
  { input: 'Martedì Viola ha il dentista alle 10:30', expectedIntent: 'calendar', expectedEntities: ['person', 'date', 'time'], category: 'calendar', difficulty: 'easy' },
  { input: 'Sabato prossimo pranzo dai nonni', expectedIntent: 'calendar', expectedEntities: ['date'], category: 'calendar', difficulty: 'medium' },
  { input: 'Il 15 marzo riunione a scuola di Asia', expectedIntent: 'calendar', expectedEntities: ['person', 'date'], category: 'calendar', difficulty: 'medium' },
  { input: 'Stasera cena fuori alle 20', expectedIntent: 'calendar', expectedEntities: ['date', 'time'], category: 'calendar', difficulty: 'easy' },
  { input: 'Giovedì pomeriggio Viola va a nuoto', expectedIntent: 'calendar', expectedEntities: ['person', 'date', 'activity'], category: 'calendar', difficulty: 'medium' },

  // ─── CALENDAR: logistica ───
  { input: 'Chiara porta Asia alla palestra domani', expectedIntent: 'calendar', expectedEntities: ['person', 'date', 'activity', 'logistics'], category: 'logistics', difficulty: 'medium' },
  { input: 'Domani Chiara porta Asia a danza e mamma la riprende', expectedIntent: 'calendar', expectedEntities: ['person', 'date', 'logistics'], category: 'logistics', difficulty: 'hard' },
  { input: 'Lunedì porto Viola al corso di inglese alle 15', expectedIntent: 'calendar', expectedEntities: ['person', 'date', 'time', 'activity'], category: 'logistics', difficulty: 'medium' },

  // ─── TASK ───
  { input: 'Ricordami di comprare il latte', expectedIntent: 'reminder', expectedEntities: [], category: 'reminder', difficulty: 'easy' },
  { input: 'Chiara deve prenotare la visita dal pediatra', expectedIntent: 'calendar', expectedEntities: ['person'], category: 'calendar', difficulty: 'medium' },
  { input: 'Devo pagare la bolletta del gas entro venerdì', expectedIntent: 'task', expectedEntities: ['date'], category: 'task', difficulty: 'medium' },
  { input: 'Asia deve fare i compiti di matematica', expectedIntent: 'task', expectedEntities: ['person'], category: 'task', difficulty: 'easy' },
  { input: 'Preparare i vestiti per la gita di Viola', expectedIntent: 'task', expectedEntities: ['person'], category: 'task', difficulty: 'medium' },

  // ─── EXPENSE ───
  { input: 'Ho speso 45 euro al supermercato', expectedIntent: 'expense', expectedEntities: ['amount'], category: 'expense', difficulty: 'easy' },
  { input: 'Pagato 120 euro per il corso di danza di Asia', expectedIntent: 'expense', expectedEntities: ['amount', 'person', 'activity'], category: 'expense', difficulty: 'medium' },
  { input: 'Bolletta luce 89 euro', expectedIntent: 'expense', expectedEntities: ['amount'], category: 'expense', difficulty: 'easy' },
  { input: 'Spesa settimanale 135 euro', expectedIntent: 'expense', expectedEntities: ['amount'], category: 'expense', difficulty: 'easy' },

  // ─── MEAL ───
  { input: 'Stasera facciamo pasta al ragù', expectedIntent: 'meal', expectedEntities: [], category: 'meal', difficulty: 'easy' },
  { input: 'A pranzo risotto ai funghi', expectedIntent: 'meal', expectedEntities: [], category: 'meal', difficulty: 'easy' },
  { input: 'Domani sera pizza fatta in casa', expectedIntent: 'meal', expectedEntities: ['date'], category: 'meal', difficulty: 'medium' },

  // ─── SHOPPING ───
  { input: 'Comprare latte pane uova e detersivo', expectedIntent: 'shopping', expectedEntities: [], category: 'shopping', difficulty: 'easy' },
  { input: 'Serve la carta igienica e il sapone', expectedIntent: 'shopping', expectedEntities: [], category: 'shopping', difficulty: 'easy' },
  { input: 'Mettere in lista frutta verdura e yogurt', expectedIntent: 'shopping', expectedEntities: [], category: 'shopping', difficulty: 'medium' },

  // ─── ABSENCE ───
  { input: 'Asia domani non va a scuola', expectedIntent: 'absence', expectedEntities: ['person', 'date'], category: 'absence', difficulty: 'easy' },
  { input: 'Viola sta male, oggi resta a casa', expectedIntent: 'absence', expectedEntities: ['person', 'date'], category: 'absence', difficulty: 'medium' },

  // ─── REMINDER ───
  { input: 'Ricordami alle 8 di chiamare il dottore', expectedIntent: 'reminder', expectedEntities: ['time'], category: 'reminder', difficulty: 'easy' },
  { input: 'Avvisami domani mattina per la riunione', expectedIntent: 'reminder', expectedEntities: ['date'], category: 'reminder', difficulty: 'medium' },

  // ─── AMBIGUI / HARD ───
  { input: 'Viola domani', expectedIntent: null, expectedEntities: ['person', 'date'], category: 'ambiguous', difficulty: 'hard' },
  { input: 'La nonna viene a prendere le bambine', expectedIntent: 'calendar', expectedEntities: ['person'], category: 'logistics', difficulty: 'hard' },
  { input: 'Cancella la lezione di giovedì', expectedIntent: null, expectedEntities: ['date'], category: 'ambiguous', difficulty: 'hard' },
  { input: 'Spostare il dentista di Viola a settimana prossima', expectedIntent: null, expectedEntities: ['person', 'date'], category: 'ambiguous', difficulty: 'hard' },

  // ─── DUAL ACTION ───
  { input: 'Chiara devi portare Asia alla palestra domani alle 17', expectedIntent: 'calendar', expectedEntities: ['person', 'date', 'time', 'activity', 'logistics'], category: 'dual_action', difficulty: 'hard' },
  { input: 'Domani Chiara porta Viola a nuoto alle 15 e poi la riprende alle 16:30', expectedIntent: 'calendar', expectedEntities: ['person', 'date', 'time', 'activity', 'logistics'], category: 'dual_action', difficulty: 'hard' },

  // ─── FORME MISTE ───
  { input: 'Domani mattina Asia ha danza alle 10, poi pranzo dalla nonna, e devo comprare il regalo per la festa', expectedIntent: null, expectedEntities: ['person', 'date', 'time'], category: 'multi_intent', difficulty: 'hard' },
  { input: 'Ho speso 30 euro per la pizza e domani dobbiamo comprare i quaderni per Viola', expectedIntent: null, expectedEntities: ['amount', 'person', 'date'], category: 'multi_intent', difficulty: 'hard' },

  // ═══════════════════════════════════════════════════════════════
  // NUOVE FRASI — Fix recenti + edge case
  // ═══════════════════════════════════════════════════════════════

  // ─── LOGISTICA COLLETTIVA (fix: "dobbiamo andare a prendere") ───
  { input: 'Domani sera dobbiamo andare a prendere Asia in stazione a Desenzano', expectedIntent: 'calendar', expectedEntities: ['person', 'date', 'activity'], category: 'logistics_collective', difficulty: 'hard' },
  { input: 'Devo andare a prendere Viola a scuola alle 13', expectedIntent: 'calendar', expectedEntities: ['person', 'time', 'activity'], category: 'logistics_collective', difficulty: 'medium' },
  { input: 'Dobbiamo riprendere Asia alla palestra alle 18', expectedIntent: 'calendar', expectedEntities: ['person', 'time', 'activity'], category: 'logistics_collective', difficulty: 'medium' },
  { input: 'Bisogna andare a prendere Viola in piazza alle 17', expectedIntent: 'calendar', expectedEntities: ['person', 'time', 'activity'], category: 'logistics_collective', difficulty: 'medium' },
  { input: 'Andiamo a prendere le bambine a scuola domani', expectedIntent: 'calendar', expectedEntities: ['date', 'activity'], category: 'logistics_collective', difficulty: 'hard' },
  { input: 'Tocca andare a ritirare Viola al campo sportivo', expectedIntent: 'calendar', expectedEntities: ['person', 'activity'], category: 'logistics_collective', difficulty: 'hard' },

  // ─── LOCATION: stazione/aeroporto/struttura a CITTÀ (fix) ───
  { input: 'Devo andare in stazione a Brescia domani mattina', expectedIntent: 'calendar', expectedEntities: ['date'], category: 'location_pattern', difficulty: 'medium' },
  { input: 'Sabato andiamo a prendere la nonna in aeroporto a Milano', expectedIntent: 'calendar', expectedEntities: ['person', 'date', 'activity'], category: 'location_pattern', difficulty: 'hard' },
  { input: 'Lunedì Viola va in piscina a Lonato', expectedIntent: 'calendar', expectedEntities: ['person', 'date', 'activity'], category: 'location_pattern', difficulty: 'medium' },

  // ─── ATTIVITÀ + PERSONA NEL TITOLO (fix: "Allenamento Viola - Falcone") ───
  { input: 'Viola domani allenamento ore 16 Falcone', expectedIntent: 'calendar', expectedEntities: ['person', 'date', 'time', 'activity'], category: 'activity_person', difficulty: 'medium' },
  { input: 'Asia giovedì danza ore 17 alla Fenice', expectedIntent: 'calendar', expectedEntities: ['person', 'date', 'time', 'activity'], category: 'activity_person', difficulty: 'medium' },
  { input: 'Viola palestra San Marco mercoledì alle 15', expectedIntent: 'calendar', expectedEntities: ['person', 'date', 'time', 'activity'], category: 'activity_person', difficulty: 'medium' },
  { input: 'Asia nuoto alle 14 giovedì al Garda', expectedIntent: 'calendar', expectedEntities: ['person', 'date', 'time', 'activity'], category: 'activity_person', difficulty: 'medium' },

  // ─── DATE: forme complesse ───
  { input: 'Tra 3 giorni Asia ha la recita a scuola', expectedIntent: 'calendar', expectedEntities: ['person', 'date', 'activity'], category: 'calendar', difficulty: 'medium' },
  { input: 'Il mese prossimo rinnovo abbonamento palestra', expectedIntent: 'task', expectedEntities: ['date'], category: 'task', difficulty: 'medium' },
  { input: 'Dopodomani visita dal pediatra per Viola', expectedIntent: 'calendar', expectedEntities: ['person', 'date'], category: 'calendar', difficulty: 'easy' },
  { input: 'Venerdì prossimo compleanno compagna di Asia', expectedIntent: 'calendar', expectedEntities: ['person', 'date'], category: 'calendar', difficulty: 'medium' },

  // ─── ORARI: range e forme parlate ───
  { input: 'Viola ha lezione di piano dalle 15 alle 16 mercoledì', expectedIntent: 'calendar', expectedEntities: ['person', 'date', 'time', 'activity'], category: 'calendar', difficulty: 'medium' },
  { input: 'Asia ha il corso dalle 9 alle 12 sabato mattina', expectedIntent: 'calendar', expectedEntities: ['person', 'date', 'time', 'activity'], category: 'calendar', difficulty: 'medium' },
  { input: 'Stasera cena dai suoceri verso le 19:30', expectedIntent: 'calendar', expectedEntities: ['date', 'time'], category: 'calendar', difficulty: 'easy' },

  // ─── TASK: varianti ───
  { input: 'Bisogna portare il cane dal veterinario', expectedIntent: 'task', expectedEntities: [], category: 'task', difficulty: 'easy' },
  { input: 'Non dimenticare di firmare il diario di Viola', expectedIntent: 'task', expectedEntities: ['person'], category: 'task', difficulty: 'medium' },
  { input: 'Iscrivere Asia al campo estivo entro fine mese', expectedIntent: 'task', expectedEntities: ['person'], category: 'task', difficulty: 'medium' },

  // ─── EXPENSE: varianti ───
  { input: 'Spesi 25 euro per il regalo di compleanno', expectedIntent: 'expense', expectedEntities: ['amount'], category: 'expense', difficulty: 'easy' },
  { input: 'Pagata la rata del corso di nuoto di Viola 80 euro', expectedIntent: 'expense', expectedEntities: ['amount', 'person', 'activity'], category: 'expense', difficulty: 'medium' },
  { input: 'Chiara ha speso 200 euro per le scarpe delle bambine', expectedIntent: 'expense', expectedEntities: ['amount', 'person'], category: 'expense', difficulty: 'medium' },

  // ─── SHOPPING: varianti ───
  { input: 'Abbiamo finito il dentifricio e lo shampoo', expectedIntent: 'shopping', expectedEntities: [], category: 'shopping', difficulty: 'medium' },
  { input: 'Aggiungi alla lista pannolini e salviette', expectedIntent: 'shopping', expectedEntities: [], category: 'shopping', difficulty: 'easy' },

  // ─── ABSENCE: varianti ───
  { input: 'Asia ha la febbre, domani niente scuola', expectedIntent: 'absence', expectedEntities: ['person', 'date'], category: 'absence', difficulty: 'medium' },
  { input: 'Viola lunedì resta a casa per visita medica', expectedIntent: 'absence', expectedEntities: ['person', 'date'], category: 'absence', difficulty: 'medium' },

  // ─── MEAL: varianti ───
  { input: 'Domani a pranzo facciamo le lasagne', expectedIntent: 'meal', expectedEntities: ['date'], category: 'meal', difficulty: 'easy' },
  { input: 'Stasera ordiniamo sushi', expectedIntent: 'meal', expectedEntities: [], category: 'meal', difficulty: 'easy' },
  { input: 'Mercoledì sera grigliatina in giardino', expectedIntent: 'meal', expectedEntities: ['date'], category: 'meal', difficulty: 'medium' },

  // ─── REMINDER: varianti ───
  { input: 'Ricordami di portare i documenti lunedì mattina', expectedIntent: 'reminder', expectedEntities: ['date'], category: 'reminder', difficulty: 'medium' },
  { input: 'Avvisami alle 15 che devo chiamare la scuola', expectedIntent: 'reminder', expectedEntities: ['time'], category: 'reminder', difficulty: 'easy' },

  // ─── LOGISTICA COMPLESSA (driver + soggetto) ───
  { input: 'Mamma porta Asia a danza domani e nonno la riprende', expectedIntent: 'calendar', expectedEntities: ['person', 'date', 'logistics'], category: 'dual_action', difficulty: 'hard' },
  { input: 'Io porto Viola e Chiara riprende alle 17', expectedIntent: 'calendar', expectedEntities: ['person', 'time'], category: 'dual_action', difficulty: 'hard' },
  { input: 'La nonna accompagna le bambine a scuola lunedì', expectedIntent: 'calendar', expectedEntities: ['person', 'date', 'logistics'], category: 'logistics', difficulty: 'hard' },

  // ─── AMBIGUI: frasi corte o vaghe ───
  { input: 'Asia scuola', expectedIntent: null, expectedEntities: ['person'], category: 'ambiguous', difficulty: 'hard' },
  { input: 'Domani mattina presto', expectedIntent: null, expectedEntities: ['date'], category: 'ambiguous', difficulty: 'hard' },
  { input: 'Chiara mi ha detto una cosa', expectedIntent: null, expectedEntities: ['person'], category: 'ambiguous', difficulty: 'hard' },
  { input: 'Devo parlare con la maestra', expectedIntent: 'task', expectedEntities: [], category: 'ambiguous', difficulty: 'medium' },

  // ─── MULTI-INTENT: forme reali complesse ───
  { input: 'Domani porto Viola a nuoto e poi passo al supermercato, servono latte e pane', expectedIntent: null, expectedEntities: ['person', 'date', 'activity'], category: 'multi_intent', difficulty: 'hard' },
  { input: 'Stasera mangiamo pizza, ho speso 15 euro per gli ingredienti e domani Asia ha la recita', expectedIntent: null, expectedEntities: ['amount', 'person', 'date'], category: 'multi_intent', difficulty: 'hard' },

  // ─── EDGE CASE: nomi ambigui / con articoli ───
  { input: 'Il nonno viene a cena domenica', expectedIntent: 'calendar', expectedEntities: ['person', 'date'], category: 'calendar', difficulty: 'medium' },
  { input: 'La Mariangela ci porta la torta sabato', expectedIntent: 'calendar', expectedEntities: ['person', 'date'], category: 'calendar', difficulty: 'medium' },
  { input: 'Albino e Mariangela arrivano giovedì sera', expectedIntent: 'calendar', expectedEntities: ['person', 'date'], category: 'calendar', difficulty: 'medium' },

  // ─── EDGE CASE: verbi senza soggetto ───
  { input: 'Bisogna comprare un regalo per la maestra', expectedIntent: 'task', expectedEntities: [], category: 'task', difficulty: 'easy' },
  { input: 'Serve prenotare il ristorante per sabato', expectedIntent: 'task', expectedEntities: ['date'], category: 'task', difficulty: 'medium' },

  // ─── EDGE CASE: importi con virgola e centesimi ───
  { input: 'Ho pagato 12,50 euro per il parcheggio', expectedIntent: 'expense', expectedEntities: ['amount'], category: 'expense', difficulty: 'easy' },
  { input: 'Spesi 3,90 per il giornale', expectedIntent: 'expense', expectedEntities: ['amount'], category: 'expense', difficulty: 'easy' },

  // ═══════════════════════════════════════════════════════════════
  // FRASI REALI — Vita quotidiana famiglia italiana
  // ═══════════════════════════════════════════════════════════════

  // ─── SPESE: supermercato e quotidiane ───
  { input: 'Spesa al Conad 67 euro', expectedIntent: 'expense', expectedEntities: ['amount'], category: 'expense_real', difficulty: 'easy' },
  { input: 'Al Lidl ho speso 43,80 euro stamattina', expectedIntent: 'expense', expectedEntities: ['amount', 'date'], category: 'expense_real', difficulty: 'easy' },
  { input: 'Chiara ha fatto la spesa 52 euro alla Coop', expectedIntent: 'expense', expectedEntities: ['amount', 'person'], category: 'expense_real', difficulty: 'medium' },
  { input: 'Benzina 60 euro', expectedIntent: 'expense', expectedEntities: ['amount'], category: 'expense_real', difficulty: 'easy' },
  { input: 'Fatto il pieno 75 euro gasolio', expectedIntent: 'expense', expectedEntities: ['amount'], category: 'expense_real', difficulty: 'medium' },
  { input: 'Autostrada andata e ritorno 18,40 euro', expectedIntent: 'expense', expectedEntities: ['amount'], category: 'expense_real', difficulty: 'medium' },

  // ─── SPESE: bollette e rate ───
  { input: 'Bolletta Enel 124 euro arrivata oggi', expectedIntent: 'expense', expectedEntities: ['amount'], category: 'expense_real', difficulty: 'easy' },
  { input: 'Pagato affitto 650 euro', expectedIntent: 'expense', expectedEntities: ['amount'], category: 'expense_real', difficulty: 'easy' },
  { input: 'Rata mutuo 480 euro addebitata', expectedIntent: 'expense', expectedEntities: ['amount'], category: 'expense_real', difficulty: 'easy' },
  { input: 'Abbonamento Netflix 15,99 euro', expectedIntent: 'expense', expectedEntities: ['amount'], category: 'expense_real', difficulty: 'easy' },
  { input: 'Assicurazione auto 320 euro da pagare entro fine mese', expectedIntent: 'expense', expectedEntities: ['amount'], category: 'expense_real', difficulty: 'medium' },

  // ─── SPESE: figli e scuola ───
  { input: 'Libri scolastici di Viola 156 euro', expectedIntent: 'expense', expectedEntities: ['amount', 'person'], category: 'expense_real', difficulty: 'medium' },
  { input: 'Quota mensa Asia 85 euro per questo mese', expectedIntent: 'expense', expectedEntities: ['amount', 'person'], category: 'expense_real', difficulty: 'medium' },
  { input: 'Zaino nuovo per Viola 45 euro', expectedIntent: 'expense', expectedEntities: ['amount', 'person'], category: 'expense_real', difficulty: 'medium' },
  { input: 'Gita scolastica di Asia 30 euro da dare alla maestra', expectedIntent: 'expense', expectedEntities: ['amount', 'person'], category: 'expense_real', difficulty: 'medium' },

  // ─── SPESE: impreviste e salute ───
  { input: 'Farmacia 23 euro per le medicine di Viola', expectedIntent: 'expense', expectedEntities: ['amount', 'person'], category: 'expense_real', difficulty: 'medium' },
  { input: 'Visita dal dentista 90 euro ticket', expectedIntent: 'expense', expectedEntities: ['amount'], category: 'expense_real', difficulty: 'easy' },
  { input: 'Meccanico 350 euro per la revisione', expectedIntent: 'expense', expectedEntities: ['amount'], category: 'expense_real', difficulty: 'medium' },
  { input: 'Idraulico 180 euro per la perdita del bagno', expectedIntent: 'expense', expectedEntities: ['amount'], category: 'expense_real', difficulty: 'medium' },

  // ─── LISTA SPESA: parlata e naturale ───
  { input: 'Manca il latte e le uova', expectedIntent: 'shopping', expectedEntities: [], category: 'shopping_real', difficulty: 'easy' },
  { input: 'Dobbiamo prendere il pane e i crackers', expectedIntent: 'shopping', expectedEntities: [], category: 'shopping_real', difficulty: 'easy' },
  { input: 'Finita la pasta e il riso', expectedIntent: 'shopping', expectedEntities: [], category: 'shopping_real', difficulty: 'easy' },
  { input: 'Ci serve il detersivo per la lavatrice', expectedIntent: 'shopping', expectedEntities: [], category: 'shopping_real', difficulty: 'easy' },
  { input: 'Domani mattina prendi il pane fresco', expectedIntent: 'shopping', expectedEntities: ['date'], category: 'shopping_real', difficulty: 'medium' },
  { input: 'Ricordati di comprare le merendine per le bambine', expectedIntent: 'shopping', expectedEntities: [], category: 'shopping_real', difficulty: 'medium' },
  { input: 'Servono pannolini taglia 4 e salviette umidificate', expectedIntent: 'shopping', expectedEntities: [], category: 'shopping_real', difficulty: 'easy' },
  { input: 'Prendi anche la frutta e la verdura per la settimana', expectedIntent: 'shopping', expectedEntities: [], category: 'shopping_real', difficulty: 'medium' },
  { input: 'Siamo senza caffè e zucchero', expectedIntent: 'shopping', expectedEntities: [], category: 'shopping_real', difficulty: 'easy' },
  { input: 'Serve comprare il tonno i pomodori pelati e la mozzarella per la pizza', expectedIntent: 'shopping', expectedEntities: [], category: 'shopping_real', difficulty: 'medium' },

  // ─── CUCINA: cosa mangiamo ───
  { input: 'Stasera facciamo le polpette al sugo', expectedIntent: 'meal', expectedEntities: [], category: 'meal_real', difficulty: 'easy' },
  { input: 'Domani sera grigliata con gli amici', expectedIntent: 'calendar', expectedEntities: ['date'], category: 'meal_real', difficulty: 'medium' },
  { input: 'A pranzo si mangia pesce e insalata', expectedIntent: 'meal', expectedEntities: [], category: 'meal_real', difficulty: 'easy' },
  { input: 'Oggi cucino la carbonara', expectedIntent: 'meal', expectedEntities: [], category: 'meal_real', difficulty: 'easy' },
  { input: 'Stasera pizza surgelata che non ho voglia di cucinare', expectedIntent: 'meal', expectedEntities: [], category: 'meal_real', difficulty: 'easy' },
  { input: 'Domani scongelo il ragù e facciamo le lasagne', expectedIntent: 'meal', expectedEntities: ['date'], category: 'meal_real', difficulty: 'medium' },
  { input: 'Per cena arrosto di pollo con patate', expectedIntent: 'meal', expectedEntities: [], category: 'meal_real', difficulty: 'easy' },
  { input: 'Ordiniamo le pizze da asporto stasera', expectedIntent: 'meal', expectedEntities: [], category: 'meal_real', difficulty: 'easy' },
  { input: 'Sabato sera cena al ristorante per il compleanno di Chiara', expectedIntent: 'calendar', expectedEntities: ['person', 'date'], category: 'meal_real', difficulty: 'hard' },
  { input: 'Mercoledì sera cucina Chiara che io lavoro fino a tardi', expectedIntent: 'meal', expectedEntities: ['person', 'date'], category: 'meal_real', difficulty: 'hard' },

  // ─── LOGISTICA CAOTICA: frasi lunghe e reali ───
  { input: 'Domani mattina devo portare Asia a scuola poi andare al lavoro e alle 16 Chiara la riprende', expectedIntent: 'calendar', expectedEntities: ['person', 'date', 'logistics'], category: 'logistics_chaos', difficulty: 'hard' },
  { input: 'Venerdì la nonna tiene le bambine perché noi andiamo a cena fuori', expectedIntent: 'calendar', expectedEntities: ['person', 'date'], category: 'logistics_chaos', difficulty: 'hard' },
  { input: 'Martedì pomeriggio Viola ha pallavolo e Asia ha danza quindi serve fare due viaggi', expectedIntent: 'calendar', expectedEntities: ['person', 'date', 'activity'], category: 'logistics_chaos', difficulty: 'hard' },
  { input: 'La mamma di una compagna porta Asia a casa dopo la festa', expectedIntent: 'calendar', expectedEntities: ['person'], category: 'logistics_chaos', difficulty: 'hard' },
  { input: 'Domani porto le bambine a scuola io perché Chiara ha la visita alle 9', expectedIntent: 'calendar', expectedEntities: ['person', 'date'], category: 'logistics_chaos', difficulty: 'hard' },
  { input: 'Sabato mattina Viola ha la gara di nuoto a Verona e dobbiamo partire presto', expectedIntent: 'calendar', expectedEntities: ['person', 'date', 'activity'], category: 'logistics_chaos', difficulty: 'hard' },

  // ─── SCUOLA E COMPITI ───
  { input: 'Asia deve studiare scienze per la verifica di lunedì', expectedIntent: 'task', expectedEntities: ['person', 'date'], category: 'school', difficulty: 'medium' },
  { input: 'Viola ha la verifica di matematica giovedì', expectedIntent: 'calendar', expectedEntities: ['person', 'date'], category: 'school', difficulty: 'easy' },
  { input: 'Devo firmare la giustificazione di Asia', expectedIntent: 'task', expectedEntities: ['person'], category: 'school', difficulty: 'easy' },
  { input: 'Colloquio con la maestra di Viola mercoledì alle 17', expectedIntent: 'calendar', expectedEntities: ['person', 'date', 'time'], category: 'school', difficulty: 'medium' },
  { input: 'Pagella di Asia da ritirare entro venerdì', expectedIntent: 'task', expectedEntities: ['person', 'date'], category: 'school', difficulty: 'medium' },
  { input: 'Riunione dei genitori giovedì sera alle 20:30', expectedIntent: 'calendar', expectedEntities: ['date', 'time'], category: 'school', difficulty: 'easy' },

  // ─── SALUTE FAMIGLIA ───
  { input: 'Asia ha l\'appuntamento dal pediatra lunedì alle 10', expectedIntent: 'calendar', expectedEntities: ['person', 'date', 'time'], category: 'health', difficulty: 'easy' },
  { input: 'Devo prenotare la visita oculistica di Viola', expectedIntent: 'task', expectedEntities: ['person'], category: 'health', difficulty: 'medium' },
  { input: 'Chiara va dal dentista domani pomeriggio', expectedIntent: 'calendar', expectedEntities: ['person', 'date'], category: 'health', difficulty: 'easy' },
  { input: 'Prendere le medicine di Viola dalla farmacia', expectedIntent: 'task', expectedEntities: ['person'], category: 'health', difficulty: 'medium' },
  { input: 'Viola ha il vaccino il 20 marzo', expectedIntent: 'calendar', expectedEntities: ['person', 'date'], category: 'health', difficulty: 'easy' },

  // ─── CASA E MANUTENZIONE ───
  { input: 'Chiamare l\'idraulico per il rubinetto che perde', expectedIntent: 'task', expectedEntities: [], category: 'house', difficulty: 'easy' },
  { input: 'Sabato mattina facciamo le pulizie di primavera', expectedIntent: 'task', expectedEntities: ['date'], category: 'house', difficulty: 'medium' },
  { input: 'Portare la macchina dal meccanico per il tagliando', expectedIntent: 'task', expectedEntities: [], category: 'house', difficulty: 'easy' },
  { input: 'Lavare le tende questa settimana', expectedIntent: 'task', expectedEntities: [], category: 'house', difficulty: 'easy' },
  { input: 'Arriva il tecnico della caldaia martedì mattina', expectedIntent: 'calendar', expectedEntities: ['date'], category: 'house', difficulty: 'medium' },

  // ─── FRASI CORTE / VOCALI / INFORMALI ───
  { input: 'Latte pane uova', expectedIntent: 'shopping', expectedEntities: [], category: 'informal', difficulty: 'easy' },
  { input: 'Stasera pizza', expectedIntent: 'meal', expectedEntities: [], category: 'informal', difficulty: 'easy' },
  { input: 'Viola danza domani', expectedIntent: 'calendar', expectedEntities: ['person', 'date', 'activity'], category: 'informal', difficulty: 'medium' },
  { input: '45 euro benzina', expectedIntent: 'expense', expectedEntities: ['amount'], category: 'informal', difficulty: 'easy' },
  { input: 'Asia scuola domani alle 8', expectedIntent: 'calendar', expectedEntities: ['person', 'date', 'time'], category: 'informal', difficulty: 'medium' },
  { input: 'Nonna domenica', expectedIntent: 'calendar', expectedEntities: ['person', 'date'], category: 'informal', difficulty: 'hard' },
  { input: 'Dentista Viola 15 marzo', expectedIntent: 'calendar', expectedEntities: ['person', 'date'], category: 'informal', difficulty: 'medium' },

  // ─── COMUNICAZIONE FAMILIARE ───
  { input: 'Di\' a Chiara che domani non torno a pranzo', expectedIntent: null, expectedEntities: ['person', 'date'], category: 'communication', difficulty: 'hard' },
  { input: 'Avvisa la nonna che domenica non veniamo', expectedIntent: null, expectedEntities: ['person', 'date'], category: 'communication', difficulty: 'hard' },
  { input: 'Chiedi a Chiara se può riprendere Viola domani', expectedIntent: null, expectedEntities: ['person', 'date'], category: 'communication', difficulty: 'hard' },

  // ─── WEEKEND E TEMPO LIBERO ───
  { input: 'Domenica andiamo al lago con i bambini', expectedIntent: 'calendar', expectedEntities: ['date'], category: 'leisure', difficulty: 'medium' },
  { input: 'Sabato pomeriggio festa di compleanno di un amico di Asia', expectedIntent: 'calendar', expectedEntities: ['person', 'date'], category: 'leisure', difficulty: 'medium' },
  { input: 'Prenotare il cinema per sabato sera', expectedIntent: 'task', expectedEntities: ['date'], category: 'leisure', difficulty: 'medium' },
  { input: 'Domenica pranzo al ristorante con i nonni', expectedIntent: 'calendar', expectedEntities: ['date'], category: 'leisure', difficulty: 'medium' },

  // ─── FRASI COMPOSTE VITA REALE ───
  { input: 'Stamattina ho portato Viola a scuola e poi ho fatto la spesa 48 euro', expectedIntent: null, expectedEntities: ['person', 'date', 'amount'], category: 'composite_real', difficulty: 'hard' },
  { input: 'Domani mattina dentista di Asia alle 9 e poi pranzo dai nonni', expectedIntent: null, expectedEntities: ['person', 'date', 'time'], category: 'composite_real', difficulty: 'hard' },
  { input: 'Stasera mangiamo la pasta al forno che è avanzata e domani Viola ha il saggio', expectedIntent: null, expectedEntities: ['person', 'date'], category: 'composite_real', difficulty: 'hard' },
  { input: 'Ho pagato 120 euro per il corso di nuoto di Viola e devo ancora pagare quello di Asia', expectedIntent: null, expectedEntities: ['amount', 'person'], category: 'composite_real', difficulty: 'hard' },

  // ─── EDGE CASE: negazioni e cambi programma ───
  { input: 'Domani Viola non ha allenamento', expectedIntent: 'absence', expectedEntities: ['person', 'date'], category: 'edge_negation', difficulty: 'medium' },
  { input: 'La lezione di piano è stata spostata a giovedì', expectedIntent: null, expectedEntities: ['date'], category: 'edge_negation', difficulty: 'hard' },
  { input: 'Hanno cancellato la gita di venerdì', expectedIntent: null, expectedEntities: ['date'], category: 'edge_negation', difficulty: 'hard' },
  { input: 'Asia oggi non va a danza perché sta poco bene', expectedIntent: 'absence', expectedEntities: ['person', 'date'], category: 'edge_negation', difficulty: 'medium' },

  // ═══════════════════════════════════════════════════════════════
  // FRASI ESPANSE — Vocabolario reale italiano (negozi, piatti, sport, ecc.)
  // ═══════════════════════════════════════════════════════════════

  // ─── SPESE: nomi reali di supermercati e negozi italiani ───
  { input: 'Spesa all\'Esselunga 93 euro', expectedIntent: 'expense', expectedEntities: ['amount'], category: 'expense_stores', difficulty: 'easy' },
  { input: 'Eurospin stamattina 38,50 euro', expectedIntent: 'expense', expectedEntities: ['amount', 'date'], category: 'expense_stores', difficulty: 'easy' },
  { input: 'Pam 27 euro solo per la colazione', expectedIntent: 'expense', expectedEntities: ['amount'], category: 'expense_stores', difficulty: 'easy' },
  { input: 'Despar 41 euro per la cena di stasera', expectedIntent: 'expense', expectedEntities: ['amount'], category: 'expense_stores', difficulty: 'easy' },
  { input: 'Tigotà 22 euro per detersivi e shampoo', expectedIntent: 'expense', expectedEntities: ['amount'], category: 'expense_stores', difficulty: 'easy' },
  { input: 'Decathlon 65 euro scarpe da ginnastica per Viola', expectedIntent: 'expense', expectedEntities: ['amount', 'person'], category: 'expense_stores', difficulty: 'medium' },
  { input: 'OVS 35 euro maglietta e pantaloni per Asia', expectedIntent: 'expense', expectedEntities: ['amount', 'person'], category: 'expense_stores', difficulty: 'medium' },
  { input: 'Ikea 120 euro scaffale per cameretta', expectedIntent: 'expense', expectedEntities: ['amount'], category: 'expense_stores', difficulty: 'easy' },

  // ─── CUCINA: piatti italiani reali ───
  { input: 'Stasera facciamo la parmigiana di melanzane', expectedIntent: 'meal', expectedEntities: [], category: 'meal_italian', difficulty: 'easy' },
  { input: 'Domani prepariamo il minestrone con il pesto', expectedIntent: 'meal', expectedEntities: ['date'], category: 'meal_italian', difficulty: 'easy' },
  { input: 'A pranzo pasta e fagioli', expectedIntent: 'meal', expectedEntities: [], category: 'meal_italian', difficulty: 'easy' },
  { input: 'Per cena cotoletta alla milanese con patatine', expectedIntent: 'meal', expectedEntities: [], category: 'meal_italian', difficulty: 'easy' },
  { input: 'Facciamo le crepes per merenda delle bambine', expectedIntent: 'meal', expectedEntities: [], category: 'meal_italian', difficulty: 'medium' },
  { input: 'Stasera ordiniamo cinese', expectedIntent: 'meal', expectedEntities: [], category: 'meal_italian', difficulty: 'easy' },
  { input: 'Domani sera hamburger fatti in casa', expectedIntent: 'meal', expectedEntities: ['date'], category: 'meal_italian', difficulty: 'medium' },

  // ─── SPORT E ATTIVITA': varianti reali ───
  { input: 'Viola ha pallavolo martedì e giovedì alle 17', expectedIntent: 'calendar', expectedEntities: ['person', 'date', 'time'], category: 'sport_real', difficulty: 'medium' },
  { input: 'Asia inizia karate lunedì prossimo', expectedIntent: 'calendar', expectedEntities: ['person', 'date'], category: 'sport_real', difficulty: 'medium' },
  { input: 'Sabato mattina torneo di minibasket di Viola', expectedIntent: 'calendar', expectedEntities: ['person', 'date'], category: 'sport_real', difficulty: 'medium' },
  { input: 'Iscrizione piscina estiva per le bambine entro marzo', expectedIntent: 'task', expectedEntities: [], category: 'sport_real', difficulty: 'medium' },
  { input: 'Devo comprare il body per la ginnastica di Asia', expectedIntent: 'shopping', expectedEntities: ['person'], category: 'sport_real', difficulty: 'medium' },
  { input: 'Allenamento di calcetto Cristian mercoledì sera', expectedIntent: 'calendar', expectedEntities: ['person', 'date'], category: 'sport_real', difficulty: 'medium' },

  // ─── LISTA SPESA: prodotti specifici italiani ───
  { input: 'Manca il parmigiano e il prosciutto cotto', expectedIntent: 'shopping', expectedEntities: [], category: 'shopping_italian', difficulty: 'easy' },
  { input: 'Comprare la passata di pomodoro e il basilico', expectedIntent: 'shopping', expectedEntities: [], category: 'shopping_italian', difficulty: 'easy' },
  { input: 'Servono le fette biscottate e la nutella', expectedIntent: 'shopping', expectedEntities: [], category: 'shopping_italian', difficulty: 'easy' },
  { input: 'Prendere il grana padano e la ricotta', expectedIntent: 'shopping', expectedEntities: [], category: 'shopping_italian', difficulty: 'easy' },
  { input: 'Finiti i biscotti e i cereali delle bambine', expectedIntent: 'shopping', expectedEntities: [], category: 'shopping_italian', difficulty: 'easy' },
  { input: 'Serve la mozzarella di bufala per la caprese', expectedIntent: 'shopping', expectedEntities: [], category: 'shopping_italian', difficulty: 'easy' },
  { input: 'Comprare i wurstel e il ketchup per il barbecue', expectedIntent: 'shopping', expectedEntities: [], category: 'shopping_italian', difficulty: 'medium' },

  // ─── LOGISTICA: orari reali e catene di azioni ───
  { input: 'Chiara esce dal lavoro alle 18 e va a prendere Viola a danza', expectedIntent: 'calendar', expectedEntities: ['person', 'time', 'logistics'], category: 'logistics_real', difficulty: 'hard' },
  { input: 'Il nonno porta Asia a catechismo sabato mattina', expectedIntent: 'calendar', expectedEntities: ['person', 'date', 'logistics'], category: 'logistics_real', difficulty: 'hard' },
  { input: 'Devo passare a prendere Asia dopo la festa alle 22', expectedIntent: 'calendar', expectedEntities: ['person', 'time'], category: 'logistics_real', difficulty: 'hard' },
  { input: 'Chiara porta le bambine dalla nonna venerdì pomeriggio', expectedIntent: 'calendar', expectedEntities: ['person', 'date', 'logistics'], category: 'logistics_real', difficulty: 'hard' },

  // ─── CALENDARIO: eventi ricorrenti e festività ───
  { input: 'Compleanno di Viola il 23 aprile', expectedIntent: 'calendar', expectedEntities: ['person', 'date'], category: 'calendar_events', difficulty: 'easy' },
  { input: 'Anniversario di matrimonio il 5 giugno', expectedIntent: 'calendar', expectedEntities: ['date'], category: 'calendar_events', difficulty: 'easy' },
  { input: 'Festa della scuola di Asia venerdì prossimo', expectedIntent: 'calendar', expectedEntities: ['person', 'date'], category: 'calendar_events', difficulty: 'medium' },
  { input: 'Recita di Natale delle bambine il 20 dicembre', expectedIntent: 'calendar', expectedEntities: ['date'], category: 'calendar_events', difficulty: 'medium' },
  { input: 'Saggio di danza di Asia sabato alle 18', expectedIntent: 'calendar', expectedEntities: ['person', 'date', 'time'], category: 'calendar_events', difficulty: 'easy' },

  // ─── TASK: gestione casa e burocrazia ───
  { input: 'Rinnovare la carta d\'identità di Viola', expectedIntent: 'task', expectedEntities: ['person'], category: 'task_admin', difficulty: 'medium' },
  { input: 'Portare i vestiti in lavanderia', expectedIntent: 'task', expectedEntities: [], category: 'task_admin', difficulty: 'easy' },
  { input: 'Fissare appuntamento per il passaporto di Asia', expectedIntent: 'task', expectedEntities: ['person'], category: 'task_admin', difficulty: 'medium' },
  { input: 'Devo chiamare la segreteria della scuola', expectedIntent: 'task', expectedEntities: [], category: 'task_admin', difficulty: 'easy' },
  { input: 'Preparare lo zaino per la gita di Viola', expectedIntent: 'task', expectedEntities: ['person'], category: 'task_admin', difficulty: 'medium' },
  { input: 'Controllare i compiti di Asia prima di cena', expectedIntent: 'task', expectedEntities: ['person'], category: 'task_admin', difficulty: 'medium' },

  // ─── REMINDER: con contesto temporale specifico ───
  { input: 'Ricordami di chiamare il dentista lunedì mattina', expectedIntent: 'reminder', expectedEntities: ['date'], category: 'reminder_time', difficulty: 'medium' },
  { input: 'Avvisami alle 14 che devo andare a prendere le medicine', expectedIntent: 'reminder', expectedEntities: ['time'], category: 'reminder_time', difficulty: 'easy' },
  { input: 'Ricordami domani di pagare la mensa di Asia', expectedIntent: 'reminder', expectedEntities: ['date', 'person'], category: 'reminder_time', difficulty: 'medium' },

  // ─── ABSENCE: varianti con motivazioni ───
  { input: 'Viola domani non va a scuola per mal di pancia', expectedIntent: 'absence', expectedEntities: ['person', 'date'], category: 'absence_reasons', difficulty: 'medium' },
  { input: 'Asia non ha nuoto questa settimana', expectedIntent: 'absence', expectedEntities: ['person'], category: 'absence_reasons', difficulty: 'medium' },
  { input: 'Niente pallavolo per Viola giovedì', expectedIntent: 'absence', expectedEntities: ['person', 'date'], category: 'absence_reasons', difficulty: 'medium' },

  // ─── SOCIALE: cene fuori, eventi con amici ───
  { input: 'Sabato sera aperitivo con i colleghi di Chiara', expectedIntent: 'calendar', expectedEntities: ['person', 'date'], category: 'social', difficulty: 'medium' },
  { input: 'Domenica pranzo al lago con la famiglia', expectedIntent: 'calendar', expectedEntities: ['date'], category: 'social', difficulty: 'medium' },
  { input: 'Cena dalla zia Maria venerdì sera', expectedIntent: 'calendar', expectedEntities: ['date'], category: 'social', difficulty: 'easy' },
  { input: 'Invitati a pranzo dai vicini domenica', expectedIntent: 'calendar', expectedEntities: ['date'], category: 'social', difficulty: 'medium' },

  // ─── FRASI BREVISSIME / VOCALI ───
  { input: 'Pediatra Asia lunedì', expectedIntent: 'calendar', expectedEntities: ['person', 'date'], category: 'ultra_short', difficulty: 'hard' },
  { input: 'Spesa 40 euro', expectedIntent: 'expense', expectedEntities: ['amount'], category: 'ultra_short', difficulty: 'easy' },
  { input: 'Pannolini e latte', expectedIntent: null, expectedEntities: [], category: 'ultra_short', difficulty: 'hard' },
  { input: 'Pizza stasera', expectedIntent: 'meal', expectedEntities: [], category: 'ultra_short', difficulty: 'easy' },
  { input: 'Chiara dentista domani', expectedIntent: 'calendar', expectedEntities: ['person', 'date'], category: 'ultra_short', difficulty: 'medium' },

  // ─── EDGE: frasi trabocchetto ───
  { input: 'Asia ha preso 8 in matematica', expectedIntent: null, expectedEntities: ['person'], category: 'edge_tricky', difficulty: 'hard' },
  { input: 'Il cane ha mangiato le scarpe di Viola', expectedIntent: null, expectedEntities: [], category: 'edge_tricky', difficulty: 'hard' },
  { input: 'Chiara dice che la maestra vuole parlare con noi', expectedIntent: null, expectedEntities: ['person'], category: 'edge_tricky', difficulty: 'hard' },
  { input: 'Non so cosa cucinare stasera', expectedIntent: null, expectedEntities: [], category: 'edge_tricky', difficulty: 'hard' },

  // ═══════════════════════════════════════════════════════════════
  // FRASI EXTRA — Colpo di grazia: 250+ frasi
  // ═══════════════════════════════════════════════════════════════

  // ─── MEDICINA E SALUTE ───
  { input: 'Comprare il Nurofen per Viola alla farmacia', expectedIntent: 'shopping', expectedEntities: ['person'], category: 'health_extra', difficulty: 'medium' },
  { input: 'Viola deve prendere l\'antibiotico alle 8 e alle 20', expectedIntent: 'calendar', expectedEntities: ['person', 'time'], category: 'health_extra', difficulty: 'medium' },
  { input: 'Prenotare visita allergologica per Asia', expectedIntent: 'task', expectedEntities: ['person'], category: 'health_extra', difficulty: 'medium' },

  // ─── COMPITI E SCUOLA ───
  { input: 'Asia deve portare il cartellone per la presentazione di scienze', expectedIntent: 'task', expectedEntities: ['person'], category: 'school_extra', difficulty: 'medium' },
  { input: 'Consegnare i soldi della gita di Viola entro giovedì', expectedIntent: 'task', expectedEntities: ['person', 'date'], category: 'school_extra', difficulty: 'medium' },
  { input: 'Viola ha il corso di inglese martedì dalle 14 alle 15', expectedIntent: 'calendar', expectedEntities: ['person', 'date', 'time', 'activity'], category: 'school_extra', difficulty: 'medium' },

  // ─── COMPLEANNI E FESTE ───
  { input: 'Festa di compleanno di Asia sabato al parco giochi', expectedIntent: 'calendar', expectedEntities: ['person', 'date'], category: 'party_extra', difficulty: 'medium' },
  { input: 'Comprare il regalo per la compagna di Viola', expectedIntent: 'shopping', expectedEntities: ['person'], category: 'party_extra', difficulty: 'medium' },
  { input: 'Preparare la torta per il compleanno di Asia venerdì', expectedIntent: 'task', expectedEntities: ['person', 'date'], category: 'party_extra', difficulty: 'medium' },

  // ─── SPESE EXTRA ───
  { input: 'Pagata la pizza 32 euro ieri sera', expectedIntent: 'expense', expectedEntities: ['amount'], category: 'expense_extra', difficulty: 'easy' },
  { input: 'Chiara ha preso le scarpe per Asia 55 euro', expectedIntent: 'expense', expectedEntities: ['amount', 'person'], category: 'expense_extra', difficulty: 'medium' },
  { input: 'Bolletta gas 97 euro bimestre', expectedIntent: 'expense', expectedEntities: ['amount'], category: 'expense_extra', difficulty: 'easy' },

  // ─── CUCINA EXTRA ───
  { input: 'Stasera prepariamo i tortellini in brodo', expectedIntent: 'meal', expectedEntities: [], category: 'meal_extra', difficulty: 'easy' },
  { input: 'Domani cuciniamo le tagliatelle al ragù', expectedIntent: 'meal', expectedEntities: ['date'], category: 'meal_extra', difficulty: 'easy' },

  // ─── ABSENCE EXTRA ───
  { input: 'Asia è malata, non va a scuola domani', expectedIntent: 'absence', expectedEntities: ['person', 'date'], category: 'absence_extra', difficulty: 'medium' },
  { input: 'Niente danza per Asia questa settimana', expectedIntent: 'absence', expectedEntities: ['person'], category: 'absence_extra', difficulty: 'medium' },

  // ─── LOGISTICA EXTRA ───
  { input: 'La nonna viene a prendere Viola alle 16 a scuola', expectedIntent: 'calendar', expectedEntities: ['person', 'time', 'logistics'], category: 'logistics_extra', difficulty: 'hard' },
  { input: 'Cristian porta Asia al compleanno e la riprende alle 19', expectedIntent: 'calendar', expectedEntities: ['person', 'time', 'logistics'], category: 'logistics_extra', difficulty: 'hard' },

  // ─── REMINDER EXTRA ───
  { input: 'Ricordami venerdì di ritirare il certificato medico', expectedIntent: 'reminder', expectedEntities: ['date'], category: 'reminder_extra', difficulty: 'medium' },

  // ─── ULTRA SHORT EXTRA ───
  { input: 'Piscina Viola domani', expectedIntent: 'calendar', expectedEntities: ['person', 'date', 'activity'], category: 'ultra_short_extra', difficulty: 'medium' },
  { input: 'Febbre Asia', expectedIntent: 'absence', expectedEntities: ['person'], category: 'ultra_short_extra', difficulty: 'hard' },

  // ═══════════════════════════════════════════════════════════════
  // FRASI SPORCHE — Rumore reale: errori, vocali, incomplete, ambigue
  // Come parla una madre stanca o un padre che detta al volo
  // ═══════════════════════════════════════════════════════════════

  // ─── ERRORI ORTOGRAFICI: come scriverebbe su WhatsApp ───
  { input: 'Domani asia a dansa alle 16', expectedIntent: 'calendar', expectedEntities: ['person', 'date', 'time', 'activity'], category: 'dirty_typo', difficulty: 'hard' },
  { input: 'Ho speso 45 euri al supermecato', expectedIntent: 'expense', expectedEntities: ['amount'], category: 'dirty_typo', difficulty: 'hard' },
  { input: 'Violla ha il dentistta domani', expectedIntent: 'calendar', expectedEntities: ['person', 'date'], category: 'dirty_typo', difficulty: 'hard' },
  { input: 'Comprrare latte e panne', expectedIntent: 'shopping', expectedEntities: [], category: 'dirty_typo', difficulty: 'hard' },
  { input: 'Ricordammi di chiamare il dottorre', expectedIntent: 'reminder', expectedEntities: [], category: 'dirty_typo', difficulty: 'hard' },
  { input: 'Bolleta luce 89 euro', expectedIntent: 'expense', expectedEntities: ['amount'], category: 'dirty_typo', difficulty: 'hard' },
  { input: 'Staserra facciamo la carbonarra', expectedIntent: 'meal', expectedEntities: [], category: 'dirty_typo', difficulty: 'hard' },
  { input: 'Chiarra porta asia a palestra', expectedIntent: 'calendar', expectedEntities: ['person', 'activity', 'logistics'], category: 'dirty_typo', difficulty: 'hard' },

  // ─── VOCALI TRASCRITTE MALE: speech-to-text storpiato ───
  { input: 'Domani a sia ha danza alle sedici', expectedIntent: 'calendar', expectedEntities: ['person', 'date', 'time', 'activity'], category: 'dirty_voice', difficulty: 'hard' },
  { input: 'Ho speso quarantacinque euro al supermercato', expectedIntent: 'expense', expectedEntities: ['amount'], category: 'dirty_voice', difficulty: 'hard' },
  { input: 'Metti in lista la frutta la verdura e lo yogurt', expectedIntent: 'shopping', expectedEntities: [], category: 'dirty_voice', difficulty: 'hard' },
  { input: 'Ricordami alle otto di chiamare il dottore', expectedIntent: 'reminder', expectedEntities: ['time'], category: 'dirty_voice', difficulty: 'hard' },
  { input: 'viola sta male oggi niente scuola', expectedIntent: 'absence', expectedEntities: ['person', 'date'], category: 'dirty_voice', difficulty: 'hard' },
  { input: 'stasera ordiniamo le pizze punto', expectedIntent: 'meal', expectedEntities: [], category: 'dirty_voice', difficulty: 'hard' },
  { input: 'Chiara deve andare a prendere viola alle cinque', expectedIntent: 'calendar', expectedEntities: ['person', 'time', 'logistics'], category: 'dirty_voice', difficulty: 'hard' },
  { input: 'Speso trentadue euro per la pizza ieri', expectedIntent: 'expense', expectedEntities: ['amount'], category: 'dirty_voice', difficulty: 'hard' },

  // ─── FRASI INCOMPLETE: manca verbo, soggetto o contesto ───
  { input: 'Asia domani 16 danza', expectedIntent: 'calendar', expectedEntities: ['person', 'date', 'time', 'activity'], category: 'dirty_incomplete', difficulty: 'hard' },
  { input: 'Viola lunedì dentista', expectedIntent: 'calendar', expectedEntities: ['person', 'date'], category: 'dirty_incomplete', difficulty: 'hard' },
  { input: '67 euro conad', expectedIntent: 'expense', expectedEntities: ['amount'], category: 'dirty_incomplete', difficulty: 'hard' },
  { input: 'Latte uova pane burro', expectedIntent: 'shopping', expectedEntities: [], category: 'dirty_incomplete', difficulty: 'hard' },
  { input: 'Pasta al forno stasera', expectedIntent: 'meal', expectedEntities: [], category: 'dirty_incomplete', difficulty: 'hard' },
  { input: 'Nonna domenica pranzo', expectedIntent: 'calendar', expectedEntities: ['person', 'date'], category: 'dirty_incomplete', difficulty: 'hard' },
  { input: 'Portare Viola scuola domani', expectedIntent: 'calendar', expectedEntities: ['person', 'date', 'logistics'], category: 'dirty_incomplete', difficulty: 'hard' },
  { input: 'Febbre alta asia no scuola', expectedIntent: 'absence', expectedEntities: ['person'], category: 'dirty_incomplete', difficulty: 'hard' },

  // ─── PERSONE IMPLICITE: "io", "lei", "i nonni", "portala" ───
  { input: 'Domani la porto a scuola io', expectedIntent: 'calendar', expectedEntities: ['date'], category: 'dirty_implicit', difficulty: 'hard' },
  { input: 'Portala a danza alle 16', expectedIntent: 'calendar', expectedEntities: ['time', 'activity'], category: 'dirty_implicit', difficulty: 'hard' },
  { input: 'I nonni vengono a pranzo domenica', expectedIntent: 'calendar', expectedEntities: ['person', 'date'], category: 'dirty_implicit', difficulty: 'hard' },
  { input: 'Lei ha la febbre oggi niente scuola', expectedIntent: 'absence', expectedEntities: ['date'], category: 'dirty_implicit', difficulty: 'hard' },
  { input: 'Riprendila alle 17 alla palestra', expectedIntent: 'calendar', expectedEntities: ['time'], category: 'dirty_implicit', difficulty: 'hard' },
  { input: 'Fallo tu il bagno alle bambine stasera', expectedIntent: null, expectedEntities: [], category: 'dirty_implicit', difficulty: 'hard' },

  // ─── MAIUSCOLE/MINUSCOLE MISTE E PUNTEGGIATURA ASSENTE ───
  { input: 'DOMANI ASIA DANZA ORE 16', expectedIntent: 'calendar', expectedEntities: ['person', 'date', 'time', 'activity'], category: 'dirty_caps', difficulty: 'hard' },
  { input: 'ho speso 45euro supermercato', expectedIntent: 'expense', expectedEntities: ['amount'], category: 'dirty_caps', difficulty: 'hard' },
  { input: 'viola dentista domani ore 10 30', expectedIntent: 'calendar', expectedEntities: ['person', 'date', 'time'], category: 'dirty_caps', difficulty: 'hard' },
  { input: 'comprare latte pane uova detersivo sapone', expectedIntent: 'shopping', expectedEntities: [], category: 'dirty_caps', difficulty: 'hard' },

  // ─── DOPPIE INTENZIONI NASCOSTE ───
  { input: 'Porto Viola a nuoto e poi passo a fare la spesa', expectedIntent: null, expectedEntities: ['person', 'activity'], category: 'dirty_multi', difficulty: 'hard' },
  { input: 'Ho speso 30 euro e domani serve comprare il latte', expectedIntent: null, expectedEntities: ['amount', 'date'], category: 'dirty_multi', difficulty: 'hard' },
  { input: 'Stasera pizza e ricordami di chiamare il pediatra domani', expectedIntent: null, expectedEntities: ['date'], category: 'dirty_multi', difficulty: 'hard' },
  { input: 'Asia ha febbre non va a scuola e devo comprare il Nurofen', expectedIntent: null, expectedEntities: ['person'], category: 'dirty_multi', difficulty: 'hard' },

  // ─── FRASI CON RUMORE VOCALE: "ehm", "cioè", ripetizioni ───
  { input: 'Ehm domani asia cioè danza alle 4', expectedIntent: 'calendar', expectedEntities: ['person', 'date', 'time', 'activity'], category: 'dirty_filler', difficulty: 'hard' },
  { input: 'Allora ho speso tipo 45 euro al super', expectedIntent: 'expense', expectedEntities: ['amount'], category: 'dirty_filler', difficulty: 'hard' },
  { input: 'Praticamente viola domani ha il dentista ecco', expectedIntent: 'calendar', expectedEntities: ['person', 'date'], category: 'dirty_filler', difficulty: 'hard' },
  { input: 'Ma sì stasera facciamo la pasta insomma', expectedIntent: 'meal', expectedEntities: [], category: 'dirty_filler', difficulty: 'hard' },

  // ─── DIALETTALISMI E ABBREVIAZIONI ───
  { input: 'Doman la porta mi a scuola', expectedIntent: 'calendar', expectedEntities: ['date'], category: 'dirty_dialect', difficulty: 'hard' },
  { input: 'La Viola la ga el dentista', expectedIntent: 'calendar', expectedEntities: ['person'], category: 'dirty_dialect', difficulty: 'hard' },
  { input: 'Ciara va a tor su la Asia', expectedIntent: 'calendar', expectedEntities: ['person', 'logistics'], category: 'dirty_dialect', difficulty: 'hard' },
  { input: 'Gh è da comprar el lat e i öf', expectedIntent: 'shopping', expectedEntities: [], category: 'dirty_dialect', difficulty: 'hard' },
]

// ═══════════════════════════════════════════════════════════════
// RUNNER
// ═══════════════════════════════════════════════════════════════

/**
 * Esegue il batch di test e restituisce un report strutturato.
 *
 * @param {Array} members - membri della famiglia
 * @param {string} familyId
 * @param {object} currentMember
 * @param {Array} [phrases] - frasi custom (default: TEST_PHRASES)
 * @returns {object} report con risultati e score
 */
export async function runTestBatch(members, familyId, currentMember, phrases = TEST_PHRASES) {
  const results = []
  const t0 = performance.now()

  for (const phrase of phrases) {
    const tStart = performance.now()
    let result
    try {
      result = await parseLocally(phrase.input, members, familyId, currentMember, null)
    } catch (err) {
      result = { error: err.message }
    }
    const tEnd = performance.now()

    // Valuta correttezza intent
    const firstAction = result?.actions?.[0]
    let actualIntent = firstAction?.type || result?.type || null
    // Le assenze generano type:'calendar' con isAbsence:true — mappalo a 'absence'
    if (firstAction?.isAbsence) actualIntent = 'absence'
    const intentCorrect = phrase.expectedIntent === null
      ? true  // frasi ambigue: non valutiamo l'intent
      : actualIntent === phrase.expectedIntent

    // Valuta completezza entità
    const actualEntities = extractFoundEntityKeys(result)
    const missingEntities = phrase.expectedEntities.filter(e => !actualEntities.includes(e))
    const entityScore = phrase.expectedEntities.length > 0
      ? (phrase.expectedEntities.length - missingEntities.length) / phrase.expectedEntities.length
      : 1.0

    results.push({
      input: phrase.input,
      category: phrase.category,
      difficulty: phrase.difficulty,
      expectedIntent: phrase.expectedIntent,
      actualIntent,
      intentCorrect,
      confidence: result?.confidence || 0,
      expectedEntities: phrase.expectedEntities,
      actualEntities,
      missingEntities,
      entityScore,
      actionCount: result?.actions?.length || 0,
      hasError: !!result?.error,
      error: result?.error || null,
      durationMs: Math.round(tEnd - tStart),
    })
  }

  const totalMs = Math.round(performance.now() - t0)

  // ─── Score aggregati ───
  const total = results.length
  const intentHits = results.filter(r => r.intentCorrect).length
  const avgConfidence = results.reduce((s, r) => s + r.confidence, 0) / total
  const avgEntityScore = results.reduce((s, r) => s + r.entityScore, 0) / total
  const errorCount = results.filter(r => r.hasError).length

  // Score per categoria
  const byCategory = {}
  for (const r of results) {
    if (!byCategory[r.category]) {
      byCategory[r.category] = { total: 0, intentHits: 0, entityScoreSum: 0, confSum: 0 }
    }
    byCategory[r.category].total++
    if (r.intentCorrect) byCategory[r.category].intentHits++
    byCategory[r.category].entityScoreSum += r.entityScore
    byCategory[r.category].confSum += r.confidence
  }
  const categoryScores = {}
  for (const [cat, data] of Object.entries(byCategory)) {
    categoryScores[cat] = {
      total: data.total,
      intentAccuracy: Math.round((data.intentHits / data.total) * 100),
      avgEntityScore: Math.round((data.entityScoreSum / data.total) * 100),
      avgConfidence: Math.round((data.confSum / data.total) * 100),
    }
  }

  // Score per difficoltà
  const byDifficulty = {}
  for (const r of results) {
    if (!byDifficulty[r.difficulty]) {
      byDifficulty[r.difficulty] = { total: 0, intentHits: 0, confSum: 0 }
    }
    byDifficulty[r.difficulty].total++
    if (r.intentCorrect) byDifficulty[r.difficulty].intentHits++
    byDifficulty[r.difficulty].confSum += r.confidence
  }
  const difficultyScores = {}
  for (const [diff, data] of Object.entries(byDifficulty)) {
    difficultyScores[diff] = {
      total: data.total,
      intentAccuracy: Math.round((data.intentHits / data.total) * 100),
      avgConfidence: Math.round((data.confSum / data.total) * 100),
    }
  }

  // Top errori
  const failures = results.filter(r => !r.intentCorrect || r.entityScore < 0.5)

  return {
    timestamp: new Date().toISOString(),
    totalPhrases: total,
    totalMs,
    avgMs: Math.round(totalMs / total),
    // Score globali
    intentAccuracy: Math.round((intentHits / total) * 100),
    avgConfidence: Math.round(avgConfidence * 100),
    avgEntityScore: Math.round(avgEntityScore * 100),
    errorCount,
    // Breakdown
    categoryScores,
    difficultyScores,
    // Dettagli
    results,
    failures,
  }
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

/** Estrai le chiavi di entità trovate dal risultato del parse */
function extractFoundEntityKeys(result) {
  if (!result) return []
  const keys = []
  const actions = result.actions || []

  for (const a of actions) {
    if (a.assignedTo || a.assignedMemberId || a.person) keys.push('person')
    if (a.date || a.startDate) keys.push('date')
    if (a.time || a.startTime || a.startDate?.includes('T')) keys.push('time')
    if (a.amount) keys.push('amount')
    if (a.activity || a.location) keys.push('activity')
    if (a.logistics || a.dropBy || a.pickupBy || a.accompaniedBy) keys.push('logistics')
  }

  // Da entities raw se disponibili
  if (result.entities) {
    if (result.entities.people?.length > 0) keys.push('person')
    if (result.entities.date) keys.push('date')
    if (result.entities.time) keys.push('time')
    if (result.entities.amount) keys.push('amount')
    if (result.entities.activity) keys.push('activity')
    if (result.entities.location) keys.push('activity')
    if (result.entities.logistics) keys.push('logistics')
  }

  return [...new Set(keys)]
}

/**
 * Confronta due run di test batch.
 * Utile per misurare se un fix ha migliorato qualcosa.
 */
export function compareTestRuns(before, after) {
  if (!before || !after) return null

  return {
    intentDelta: after.intentAccuracy - before.intentAccuracy,
    confidenceDelta: after.avgConfidence - before.avgConfidence,
    entityDelta: after.avgEntityScore - before.avgEntityScore,
    speedDelta: after.avgMs - before.avgMs,
    // Frasi che erano rotte e ora funzionano
    fixed: after.results.filter((r, i) => {
      const b = before.results[i]
      return b && !b.intentCorrect && r.intentCorrect
    }).map(r => r.input),
    // Frasi che funzionavano e ora sono rotte
    broken: after.results.filter((r, i) => {
      const b = before.results[i]
      return b && b.intentCorrect && !r.intentCorrect
    }).map(r => r.input),
  }
}
