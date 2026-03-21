/**
 * stressTest.js — Stress test massivo per il Cervellone.
 *
 * Inietta centinaia di frasi (normali, ambigue, composte, con errori,
 * interferenze, lingue miste, numeri sbagliati) nel parser locale
 * e genera un report dettagliato.
 *
 * Uso:
 *   import { runStressTest, STRESS_PHRASES } from './stressTest.js'
 *   const report = await runStressTest(members, familyId, currentMember, {
 *     onProgress: (i, total, phrase) => console.log(`${i}/${total}`),
 *     includeL3: false,  // true = testa anche il fallback AI (costa token!)
 *   })
 */

import { parseLocally } from './intentClassifier.js'
import { TEST_PHRASES } from './testBatch.js'

// ═══════════════════════════════════════════════════════════════
// STRESS PHRASES — Frasi estreme, ambigue, composte, con errori
// ═══════════════════════════════════════════════════════════════

export const STRESS_PHRASES = [

  // ─── MULTI-AZIONE: frase con 2-3 intenti combinati ───
  { input: 'Portare Viola dal dentista domani alle 10, dare 100 euro alla dottoressa e comprare le medicine in farmacia', expectedIntent: 'multi', category: 'multi_action', difficulty: 'hard' },
  { input: 'Domani mattina portare Asia a scuola poi andare al supermercato e comprare latte pane e uova', expectedIntent: 'multi', category: 'multi_action', difficulty: 'hard' },
  { input: 'Stasera pizza, domani visita medica di Viola e ricordami di pagare la bolletta', expectedIntent: 'multi', category: 'multi_action', difficulty: 'hard' },
  { input: 'Mercoledi Asia ha danza alle 16 e Viola ha nuoto alle 17 chi le porta?', expectedIntent: 'calendar', category: 'multi_action', difficulty: 'hard' },
  { input: 'Compra il latte e prepara la cena per stasera, domani ho la riunione a scuola', expectedIntent: 'multi', category: 'multi_action', difficulty: 'hard' },
  { input: 'Metti in lista la spesa: pane burro marmellata e poi segna sul calendario che venerdi abbiamo cena dai nonni', expectedIntent: 'multi', category: 'multi_action', difficulty: 'hard' },
  { input: 'Paga 50 euro per la lezione di piano di Asia e fissa la prossima per giovedi alle 15', expectedIntent: 'multi', category: 'multi_action', difficulty: 'hard' },

  // ─── SPESE: vari formati importi ───
  { input: 'Ho speso 45 euro al supermercato', expectedIntent: 'expense', category: 'expense', difficulty: 'easy' },
  { input: 'Dare 100 euro alla dottoressa', expectedIntent: 'expense', category: 'expense', difficulty: 'medium' },
  { input: 'Pagare 250€ per il corso di nuoto', expectedIntent: 'expense', category: 'expense', difficulty: 'easy' },
  { input: 'Spesi 12,50 per il parcheggio', expectedIntent: 'expense', category: 'expense', difficulty: 'medium' },
  { input: 'Costa 3.99 il gelato', expectedIntent: 'expense', category: 'expense', difficulty: 'medium' },
  { input: 'Centocinquanta euro per le scarpe di Viola', expectedIntent: 'expense', category: 'expense', difficulty: 'hard' },
  { input: 'Spesa totale 87 euro e 30 centesimi', expectedIntent: 'expense', category: 'expense', difficulty: 'hard' },
  { input: 'Ho pagato la bolletta della luce trecentoventi euro', expectedIntent: 'expense', category: 'expense', difficulty: 'hard' },
  { input: 'Devo dare 20 euro a Marco per la pizza', expectedIntent: 'expense', category: 'expense', difficulty: 'medium' },
  { input: 'Il meccanico vuole 400 euro per la revisione', expectedIntent: 'expense', category: 'expense', difficulty: 'medium' },

  // ─── LOGISTICA: chi porta, chi prende, chi riprende ───
  { input: 'Io porto Viola a danza e tu la riprendi', expectedIntent: 'calendar', category: 'logistics', difficulty: 'hard' },
  { input: 'Chi porta Asia a scuola domani mattina?', expectedIntent: 'calendar', category: 'logistics', difficulty: 'hard' },
  { input: 'Mamma porta e papa riprende', expectedIntent: 'calendar', category: 'logistics', difficulty: 'hard' },
  { input: 'Portare alla visita medica viola e poi dobbiamo dare 100 euro alla dottoressa', expectedIntent: 'multi', category: 'logistics', difficulty: 'hard' },
  { input: 'La nonna porta i bambini al parco', expectedIntent: 'calendar', category: 'logistics', difficulty: 'medium' },
  { input: 'Dopo scuola chi va a prendere Viola?', expectedIntent: 'calendar', category: 'logistics', difficulty: 'hard' },

  // ─── DATE: formati diversi, relativi, ambigui ───
  { input: 'Il 25 dicembre pranzo di Natale', expectedIntent: 'calendar', category: 'date_format', difficulty: 'easy' },
  { input: 'Dopodomani visita dal pediatra', expectedIntent: 'calendar', category: 'date_format', difficulty: 'medium' },
  { input: 'Fra tre giorni ho il colloquio', expectedIntent: 'calendar', category: 'date_format', difficulty: 'medium' },
  { input: 'La prossima settimana riunione di classe', expectedIntent: 'calendar', category: 'date_format', difficulty: 'medium' },
  { input: 'Il primo del mese pago l affitto', expectedIntent: 'expense', category: 'date_format', difficulty: 'hard' },
  { input: 'A fine mese scade l assicurazione', expectedIntent: 'calendar', category: 'date_format', difficulty: 'hard' },
  { input: 'Tra due settimane compleanno di Asia', expectedIntent: 'calendar', category: 'date_format', difficulty: 'medium' },
  { input: 'Lunedi prossimo no martedi anzi mercoledi', expectedIntent: 'calendar', category: 'date_format', difficulty: 'hard' },
  { input: '23/04 visita oculistica', expectedIntent: 'calendar', category: 'date_format', difficulty: 'medium' },
  { input: 'Stasera alle otto cena fuori', expectedIntent: 'calendar', category: 'date_format', difficulty: 'easy' },

  // ─── ERRORI DI TRASCRIZIONE: come sbaglia il riconoscimento vocale ───
  { input: 'domani asia addanza alle sedici', expectedIntent: 'calendar', category: 'typo', difficulty: 'medium' },
  { input: 'conpra il latte e le uova', expectedIntent: 'shopping', category: 'typo', difficulty: 'easy' },
  { input: 'visita medica di violo', expectedIntent: 'calendar', category: 'typo', difficulty: 'hard' },
  { input: 'portare azia a suola', expectedIntent: 'calendar', category: 'typo', difficulty: 'hard' },
  { input: 'ho spesso venti euro', expectedIntent: 'expense', category: 'typo', difficulty: 'medium' },
  { input: 'domanica pranzo dai noni', expectedIntent: 'calendar', category: 'typo', difficulty: 'hard' },
  { input: 'preparare la cena stasear', expectedIntent: 'task', category: 'typo', difficulty: 'medium' },
  { input: 'ricrdami di pagare la boletta', expectedIntent: 'reminder', category: 'typo', difficulty: 'hard' },

  // ─── FRASI INCOMPLETE / FRAMMENTATE ───
  { input: 'Domani', expectedIntent: 'unknown', category: 'incomplete', difficulty: 'hard' },
  { input: 'Alle tre', expectedIntent: 'unknown', category: 'incomplete', difficulty: 'hard' },
  { input: 'Viola', expectedIntent: 'unknown', category: 'incomplete', difficulty: 'hard' },
  { input: 'Pane', expectedIntent: 'shopping', category: 'incomplete', difficulty: 'easy' },
  { input: '50 euro', expectedIntent: 'expense', category: 'incomplete', difficulty: 'medium' },
  { input: 'Comprare', expectedIntent: 'shopping', category: 'incomplete', difficulty: 'medium' },
  { input: 'Portare domani', expectedIntent: 'unknown', category: 'incomplete', difficulty: 'hard' },
  { input: 'La visita', expectedIntent: 'unknown', category: 'incomplete', difficulty: 'hard' },

  // ─── INTERFERENZE / NONSENSE / RUMORE ───
  { input: '', expectedIntent: 'none', category: 'noise', difficulty: 'easy' },
  { input: '   ', expectedIntent: 'none', category: 'noise', difficulty: 'easy' },
  { input: 'aaaaaaaa', expectedIntent: 'unknown', category: 'noise', difficulty: 'easy' },
  { input: 'hm si ok va bene dai', expectedIntent: 'unknown', category: 'noise', difficulty: 'medium' },
  { input: 'non lo so fammi pensare', expectedIntent: 'unknown', category: 'noise', difficulty: 'medium' },
  { input: 'ciao come stai oggi', expectedIntent: 'unknown', category: 'noise', difficulty: 'easy' },
  { input: 'che ore sono', expectedIntent: 'unknown', category: 'noise', difficulty: 'easy' },
  { input: 'bella giornata oggi vero', expectedIntent: 'unknown', category: 'noise', difficulty: 'easy' },
  { input: 'mamma mia che freddo', expectedIntent: 'unknown', category: 'noise', difficulty: 'medium' },
  { input: 'si no forse boh', expectedIntent: 'unknown', category: 'noise', difficulty: 'easy' },
  { input: '123456789', expectedIntent: 'unknown', category: 'noise', difficulty: 'easy' },
  { input: '!@#$%^&*()', expectedIntent: 'none', category: 'noise', difficulty: 'easy' },

  // ─── LINGUE MISTE (italiano + inglese + dialetto) ───
  { input: 'Domani meeting alle 14 con il boss', expectedIntent: 'calendar', category: 'mixed_lang', difficulty: 'medium' },
  { input: 'Compra il milk e il bread', expectedIntent: 'shopping', category: 'mixed_lang', difficulty: 'hard' },
  { input: 'La deadline e venerdi', expectedIntent: 'calendar', category: 'mixed_lang', difficulty: 'medium' },
  { input: 'Fai il check up dal doctor', expectedIntent: 'calendar', category: 'mixed_lang', difficulty: 'hard' },
  { input: 'Ho speso fifty euro per lo shopping', expectedIntent: 'expense', category: 'mixed_lang', difficulty: 'hard' },

  // ─── FRASI MOLTO LUNGHE E COMPLESSE ───
  { input: 'Allora senti domani mattina io devo portare Viola dal dentista poi nel pomeriggio Asia ha danza alle 16 e qualcuno deve andarla a riprendere alle 17 e mezza e poi la sera dobbiamo andare a cena dai nonni quindi bisogna comprare il dolce e il vino', expectedIntent: 'multi', category: 'complex', difficulty: 'hard' },
  { input: 'Questa settimana e piena abbiamo il dentista lunedi la riunione a scuola martedi il corso di nuoto mercoledi e giovedi e il compleanno di Marco sabato dove servono 50 euro per il regalo', expectedIntent: 'multi', category: 'complex', difficulty: 'hard' },
  { input: 'Per la gita scolastica di Asia che e il 20 aprile servono 35 euro per il pullman piu 15 euro per il pranzo al sacco e bisogna preparare lo zaino con la giacca impermeabile', expectedIntent: 'multi', category: 'complex', difficulty: 'hard' },

  // ─── TASK: vari formati e assegnazioni ───
  { input: 'Viola deve fare i compiti di matematica', expectedIntent: 'task', category: 'task', difficulty: 'easy' },
  { input: 'Pulire la cucina dopo cena', expectedIntent: 'task', category: 'task', difficulty: 'easy' },
  { input: 'Riordinare la cameretta entro domani', expectedIntent: 'task', category: 'task', difficulty: 'easy' },
  { input: 'Stendere il bucato', expectedIntent: 'task', category: 'task', difficulty: 'easy' },
  { input: 'Ricordati di annaffiare le piante', expectedIntent: 'reminder', category: 'task', difficulty: 'easy' },
  { input: 'Asia deve studiare storia per la verifica di giovedi', expectedIntent: 'task', category: 'task', difficulty: 'medium' },
  { input: 'Papa deve portare la macchina dal meccanico', expectedIntent: 'task', category: 'task', difficulty: 'medium' },
  { input: 'Preparare gli zaini per domani', expectedIntent: 'task', category: 'task', difficulty: 'easy' },

  // ─── SHOPPING: liste varie ───
  { input: 'Compra pane latte uova e formaggio', expectedIntent: 'shopping', category: 'shopping', difficulty: 'easy' },
  { input: 'Ci serve la carta igienica', expectedIntent: 'shopping', category: 'shopping', difficulty: 'easy' },
  { input: 'Aggiungi alla lista della spesa: detersivo, sapone, shampoo', expectedIntent: 'shopping', category: 'shopping', difficulty: 'easy' },
  { input: 'Prendi 2 litri di latte e mezzo chilo di prosciutto', expectedIntent: 'shopping', category: 'shopping', difficulty: 'medium' },
  { input: 'Manca il sale in cucina', expectedIntent: 'shopping', category: 'shopping', difficulty: 'medium' },
  { input: 'Servono i pannolini taglia 4', expectedIntent: 'shopping', category: 'shopping', difficulty: 'medium' },
  { input: 'Comprare le medicine di Viola in farmacia', expectedIntent: 'shopping', category: 'shopping', difficulty: 'medium' },
  { input: 'Pane integrale non quello bianco', expectedIntent: 'shopping', category: 'shopping', difficulty: 'medium' },

  // ─── MEAL PLANNING ───
  { input: 'Stasera facciamo la carbonara', expectedIntent: 'meal', category: 'meal', difficulty: 'easy' },
  { input: 'Domani a pranzo pasta al pomodoro', expectedIntent: 'meal', category: 'meal', difficulty: 'easy' },
  { input: 'Per cena ordiniamo la pizza', expectedIntent: 'meal', category: 'meal', difficulty: 'easy' },
  { input: 'Colazione con pancake domani mattina', expectedIntent: 'meal', category: 'meal', difficulty: 'medium' },
  { input: 'Mercoledi prepariamo il risotto ai funghi', expectedIntent: 'meal', category: 'meal', difficulty: 'medium' },
  { input: 'Menu della settimana: lunedi pasta martedi pollo mercoledi pesce', expectedIntent: 'meal', category: 'meal', difficulty: 'hard' },

  // ─── REMINDER ───
  { input: 'Ricordami di chiamare il dottore alle 9', expectedIntent: 'reminder', category: 'reminder', difficulty: 'easy' },
  { input: 'Non dimenticare di pagare la palestra', expectedIntent: 'reminder', category: 'reminder', difficulty: 'easy' },
  { input: 'Avvisami quando arriva il pacco', expectedIntent: 'reminder', category: 'reminder', difficulty: 'medium' },
  { input: 'Devo ricordarmi di rinnovare la patente', expectedIntent: 'reminder', category: 'reminder', difficulty: 'easy' },

  // ─── FRASI AMBIGUE: intent non chiaro ───
  { input: 'La pizza', expectedIntent: 'unknown', category: 'ambiguous', difficulty: 'hard' },
  { input: 'Viola domani', expectedIntent: 'unknown', category: 'ambiguous', difficulty: 'hard' },
  { input: 'Alle tre il dottore', expectedIntent: 'calendar', category: 'ambiguous', difficulty: 'hard' },
  { input: 'Servono soldi per la scuola', expectedIntent: 'expense', category: 'ambiguous', difficulty: 'hard' },
  { input: 'Il meccanico', expectedIntent: 'unknown', category: 'ambiguous', difficulty: 'hard' },
  { input: 'Dobbiamo fare qualcosa per il compleanno', expectedIntent: 'unknown', category: 'ambiguous', difficulty: 'hard' },

  // ─── EDGE CASES: numeri, orari ambigui ───
  { input: 'Alle 3 di notte sveglia per il volo', expectedIntent: 'calendar', category: 'edge', difficulty: 'hard' },
  { input: 'Duemilaventisei', expectedIntent: 'unknown', category: 'edge', difficulty: 'hard' },
  { input: 'Zero euro di budget questo mese', expectedIntent: 'expense', category: 'edge', difficulty: 'hard' },
  { input: 'Dalle 8 alle 13 scuola poi dalle 15 alle 17 compiti', expectedIntent: 'multi', category: 'edge', difficulty: 'hard' },
  { input: 'Un milione di cose da fare', expectedIntent: 'unknown', category: 'edge', difficulty: 'medium' },
  { input: 'Mezzanotte', expectedIntent: 'unknown', category: 'edge', difficulty: 'hard' },

  // ─── RIPETIZIONI / CORREZIONI ───
  { input: 'No aspetta non domani martedi', expectedIntent: 'unknown', category: 'correction', difficulty: 'hard' },
  { input: 'Cancella quello che ho detto prima', expectedIntent: 'unknown', category: 'correction', difficulty: 'hard' },
  { input: 'Anzi no cambia orario alle 15 non alle 14', expectedIntent: 'unknown', category: 'correction', difficulty: 'hard' },
  { input: 'Sbagliato non Viola ma Asia', expectedIntent: 'unknown', category: 'correction', difficulty: 'hard' },

  // ─── DIALETTO / SLANG ───
  { input: 'Stasera se magna fuori', expectedIntent: 'meal', category: 'dialect', difficulty: 'hard' },
  { input: 'Domani tocca a me portare i pupi', expectedIntent: 'calendar', category: 'dialect', difficulty: 'hard' },
  { input: 'Vado a pigliare la bimba a scuola', expectedIntent: 'calendar', category: 'dialect', difficulty: 'hard' },
  { input: 'Ci vuole la schiscetta per domani', expectedIntent: 'task', category: 'dialect', difficulty: 'hard' },

  // ═══════════════════════════════════════════════════════════════
  // BATCH 2: 200+ FRASI AGGIUNTIVE — Scenari reali famiglia italiana
  // ═══════════════════════════════════════════════════════════════

  // ─── MATTINA TIPO: routine mattutina ───
  { input: 'Domani sveglia alle 6 per tutti', expectedIntent: 'calendar', category: 'morning_routine', difficulty: 'medium' },
  { input: 'Preparare colazione per i bambini', expectedIntent: 'task', category: 'morning_routine', difficulty: 'easy' },
  { input: 'Asia deve prepararsi per la scuola', expectedIntent: 'task', category: 'morning_routine', difficulty: 'easy' },
  { input: 'Chi porta i bambini a scuola domani mattina', expectedIntent: 'calendar', category: 'morning_routine', difficulty: 'hard' },
  { input: 'Viola ha il compito di italiano da finire prima di uscire', expectedIntent: 'task', category: 'morning_routine', difficulty: 'medium' },
  { input: 'Mettere la merenda nello zaino di Asia', expectedIntent: 'task', category: 'morning_routine', difficulty: 'easy' },

  // ─── POMERIGGIO: attivita extrascolastiche ───
  { input: 'Asia ha danza alle 16 e nuoto alle 18', expectedIntent: 'calendar', category: 'afternoon', difficulty: 'hard' },
  { input: 'Viola ha ripetizioni di matematica alle 15', expectedIntent: 'calendar', category: 'afternoon', difficulty: 'easy' },
  { input: 'Oggi niente compiti facciamo merenda al parco', expectedIntent: 'calendar', category: 'afternoon', difficulty: 'medium' },
  { input: 'Portare Asia al corso di inglese alle 17', expectedIntent: 'calendar', category: 'afternoon', difficulty: 'easy' },
  { input: 'Dopo scuola Viola va a casa di Sofia a studiare', expectedIntent: 'calendar', category: 'afternoon', difficulty: 'medium' },
  { input: 'Prendere Viola a danza alle 17 e portarla a casa', expectedIntent: 'calendar', category: 'afternoon', difficulty: 'medium' },

  // ─── SERA: cena e organizzazione ───
  { input: 'Stasera cena alle 19 e 30 tutti insieme', expectedIntent: 'calendar', category: 'evening', difficulty: 'easy' },
  { input: 'Preparare le cartelle per domani', expectedIntent: 'task', category: 'evening', difficulty: 'easy' },
  { input: 'Domani sera pizza da asporto che ne dite', expectedIntent: 'meal', category: 'evening', difficulty: 'easy' },
  { input: 'Stasera film in famiglia dopo cena', expectedIntent: 'calendar', category: 'evening', difficulty: 'medium' },
  { input: 'Fare il bagno ai bambini prima delle 20', expectedIntent: 'task', category: 'evening', difficulty: 'easy' },
  { input: 'Letto alle 21 per tutti domani scuola', expectedIntent: 'task', category: 'evening', difficulty: 'medium' },

  // ─── WEEKEND: attivita familiari ───
  { input: 'Sabato andiamo al parco avventura', expectedIntent: 'calendar', category: 'weekend', difficulty: 'easy' },
  { input: 'Domenica pranzo dalla nonna alle 12 e 30', expectedIntent: 'calendar', category: 'weekend', difficulty: 'easy' },
  { input: 'Sabato mattina pulizie di casa tutti insieme', expectedIntent: 'task', category: 'weekend', difficulty: 'medium' },
  { input: 'Domenica pomeriggio cinema con i bambini', expectedIntent: 'calendar', category: 'weekend', difficulty: 'easy' },
  { input: 'Sabato prossimo festa di compleanno di Marco alle 15', expectedIntent: 'calendar', category: 'weekend', difficulty: 'easy' },
  { input: 'Il weekend facciamo una gita al lago', expectedIntent: 'calendar', category: 'weekend', difficulty: 'medium' },
  { input: 'Sabato mattina mercato e poi pranzo fuori', expectedIntent: 'multi', category: 'weekend', difficulty: 'hard' },
  { input: 'Domenica lasciate dormire che e festa', expectedIntent: 'task', category: 'weekend', difficulty: 'hard' },

  // ─── SCUOLA: comunicazioni scolastiche ───
  { input: 'Lunedi riunione genitori alle 17 nella classe di Asia', expectedIntent: 'calendar', category: 'school_comm', difficulty: 'medium' },
  { input: 'Viola ha la verifica di scienze giovedi', expectedIntent: 'calendar', category: 'school_comm', difficulty: 'easy' },
  { input: 'Portare i soldi per la gita entro venerdi', expectedIntent: 'task', category: 'school_comm', difficulty: 'medium' },
  { input: 'Asia deve fare il tema per lunedi', expectedIntent: 'task', category: 'school_comm', difficulty: 'easy' },
  { input: 'La maestra ha chiesto di portare i colori a tempera', expectedIntent: 'task', category: 'school_comm', difficulty: 'medium' },
  { input: 'Colloqui con i professori di Viola il 25 marzo', expectedIntent: 'calendar', category: 'school_comm', difficulty: 'medium' },
  { input: 'Pagare la quota mensa di marzo 85 euro', expectedIntent: 'expense', category: 'school_comm', difficulty: 'medium' },
  { input: 'Firmato il diario di Viola per la giustificazione', expectedIntent: 'task', category: 'school_comm', difficulty: 'hard' },

  // ─── SALUTE: visite mediche e farmaci ───
  { input: 'Prenotare visita dal pediatra per Asia', expectedIntent: 'calendar', category: 'health_visit', difficulty: 'easy' },
  { input: 'Viola deve prendere l antibiotico alle 8 e alle 20', expectedIntent: 'task', category: 'health_visit', difficulty: 'medium' },
  { input: 'Ritirare le analisi del sangue di Viola in ospedale', expectedIntent: 'task', category: 'health_visit', difficulty: 'medium' },
  { input: 'Appuntamento oculista Asia 15 aprile ore 10', expectedIntent: 'calendar', category: 'health_visit', difficulty: 'easy' },
  { input: 'Comprare il Nurofen per i bambini in farmacia', expectedIntent: 'shopping', category: 'health_visit', difficulty: 'medium' },
  { input: 'Vaccino antinfluenzale per tutta la famiglia', expectedIntent: 'calendar', category: 'health_visit', difficulty: 'medium' },
  { input: 'Pagato 45 euro per la visita oculistica', expectedIntent: 'expense', category: 'health_visit', difficulty: 'easy' },

  // ─── SPESA DETTAGLIATA: lista con quantita ───
  { input: 'Compra 3 litri di latte parzialmente scremato', expectedIntent: 'shopping', category: 'shopping_qty', difficulty: 'medium' },
  { input: 'Servono 6 uova e mezzo chilo di farina', expectedIntent: 'shopping', category: 'shopping_qty', difficulty: 'medium' },
  { input: 'Prendi due confezioni di biscotti e un pacco di pasta', expectedIntent: 'shopping', category: 'shopping_qty', difficulty: 'medium' },
  { input: 'Mancano carta igienica detersivo e sapone per i piatti', expectedIntent: 'shopping', category: 'shopping_qty', difficulty: 'easy' },
  { input: 'Compra il pane ma quello integrale non quello bianco', expectedIntent: 'shopping', category: 'shopping_qty', difficulty: 'medium' },
  { input: 'Lista spesa: pomodori zucchine melanzane peperoni cipolla aglio', expectedIntent: 'shopping', category: 'shopping_qty', difficulty: 'easy' },
  { input: 'Prendi il latte senza lattosio per Viola', expectedIntent: 'shopping', category: 'shopping_qty', difficulty: 'medium' },
  { input: 'Servono i pannolini taglia 5 e le salviette umidificate', expectedIntent: 'shopping', category: 'shopping_qty', difficulty: 'medium' },

  // ─── SPESE CON IMPORTI IN LETTERE ───
  { input: 'Ho speso centocinquanta euro per le scarpe di Viola', expectedIntent: 'expense', category: 'expense_letters', difficulty: 'hard' },
  { input: 'Pagato trecentoventi euro la bolletta della luce', expectedIntent: 'expense', category: 'expense_letters', difficulty: 'hard' },
  { input: 'Il dentista costa ottanta euro a visita', expectedIntent: 'expense', category: 'expense_letters', difficulty: 'hard' },
  { input: 'Dare cinquanta euro alla baby sitter', expectedIntent: 'expense', category: 'expense_letters', difficulty: 'hard' },
  { input: 'La pizza e costata quarantacinque euro per tutti', expectedIntent: 'expense', category: 'expense_letters', difficulty: 'hard' },
  { input: 'Servono duecento euro per il corso di nuoto', expectedIntent: 'expense', category: 'expense_letters', difficulty: 'hard' },
  { input: 'Speso trentadue euro al supermercato', expectedIntent: 'expense', category: 'expense_letters', difficulty: 'hard' },
  { input: 'Mille euro di affitto pagati', expectedIntent: 'expense', category: 'expense_letters', difficulty: 'hard' },

  // ─── ASSENZE: tutti i modi per dire "non viene" ───
  { input: 'Asia domani non va a scuola ha mal di pancia', expectedIntent: 'absence', category: 'absence_explicit', difficulty: 'medium' },
  { input: 'Viola sta male non esce oggi', expectedIntent: 'absence', category: 'absence_explicit', difficulty: 'medium' },
  { input: 'Niente pallavolo per Viola ha la febbre', expectedIntent: 'absence', category: 'absence_explicit', difficulty: 'medium' },
  { input: 'Asia resta a casa domani ha il raffreddore', expectedIntent: 'absence', category: 'absence_explicit', difficulty: 'medium' },
  { input: 'Oggi niente scuola per Viola visita medica', expectedIntent: 'absence', category: 'absence_explicit', difficulty: 'medium' },
  { input: 'Asia non ha danza questa settimana la maestra e malata', expectedIntent: 'absence', category: 'absence_explicit', difficulty: 'hard' },
  { input: 'Domani Viola non va a nuoto si e fatta male al piede', expectedIntent: 'absence', category: 'absence_explicit', difficulty: 'medium' },
  { input: 'Asia ha 38 di febbre niente scuola', expectedIntent: 'absence', category: 'absence_explicit', difficulty: 'medium' },

  // ─── COMANDI VOCALI REALI: come parla una mamma/papa ───
  { input: 'Eh senti domani dobbiamo andare dal dentista con Viola', expectedIntent: 'calendar', category: 'real_voice', difficulty: 'medium' },
  { input: 'Allora vediamo un po cosa c e da fare questa settimana', expectedIntent: 'unknown', category: 'real_voice', difficulty: 'hard' },
  { input: 'Si praticamente dobbiamo comprare il regalo per il compleanno di Marco', expectedIntent: 'calendar', category: 'real_voice', difficulty: 'medium' },
  { input: 'Ah dimenticavo la mamma ha detto che viene a pranzo domenica', expectedIntent: 'calendar', category: 'real_voice', difficulty: 'medium' },
  { input: 'Ma quindi chi la porta a danza domani perche io non posso', expectedIntent: 'calendar', category: 'real_voice', difficulty: 'hard' },
  { input: 'Ok allora segnamo che giovedi sera andiamo a cena dai Rossi', expectedIntent: 'calendar', category: 'real_voice', difficulty: 'medium' },
  { input: 'Aspetta che mi ricordo si Viola ha il saggio di danza il 20', expectedIntent: 'calendar', category: 'real_voice', difficulty: 'hard' },
  { input: 'No ma io oggi ho speso un sacco al supermercato tipo 120 euro', expectedIntent: 'expense', category: 'real_voice', difficulty: 'medium' },

  // ─── COMPITI E STUDIO ───
  { input: 'Asia deve studiare le tabelline', expectedIntent: 'task', category: 'homework', difficulty: 'easy' },
  { input: 'Viola deve finire la ricerca di geografia', expectedIntent: 'task', category: 'homework', difficulty: 'easy' },
  { input: 'Aiutare Asia con i problemi di matematica stasera', expectedIntent: 'task', category: 'homework', difficulty: 'easy' },
  { input: 'Controllare che Viola abbia fatto tutti i compiti', expectedIntent: 'task', category: 'homework', difficulty: 'easy' },
  { input: 'Stampare la scheda di storia per Asia', expectedIntent: 'task', category: 'homework', difficulty: 'easy' },
  { input: 'Comprare il quaderno a righe per Viola', expectedIntent: 'shopping', category: 'homework', difficulty: 'easy' },

  // ─── CASA: faccende domestiche dettagliate ───
  { input: 'Passare l aspirapolvere in tutte le stanze', expectedIntent: 'task', category: 'housework', difficulty: 'easy' },
  { input: 'Lavare i piatti della cena', expectedIntent: 'task', category: 'housework', difficulty: 'easy' },
  { input: 'Stendere il bucato sul balcone', expectedIntent: 'task', category: 'housework', difficulty: 'easy' },
  { input: 'Cambiare le lenzuola dei letti', expectedIntent: 'task', category: 'housework', difficulty: 'easy' },
  { input: 'Buttare la spazzatura prima che passi il camion', expectedIntent: 'task', category: 'housework', difficulty: 'easy' },
  { input: 'Stirare le camicie per lunedi', expectedIntent: 'task', category: 'housework', difficulty: 'easy' },
  { input: 'Ordinare la cameretta di Viola e un disastro', expectedIntent: 'task', category: 'housework', difficulty: 'easy' },
  { input: 'Scongelare la carne per domani sera', expectedIntent: 'task', category: 'housework', difficulty: 'easy' },

  // ─── CUCINA: ricette e pasti specifici ───
  { input: 'Stasera prepariamo le polpette al sugo', expectedIntent: 'meal', category: 'meal_specific', difficulty: 'easy' },
  { input: 'Domani a pranzo riso in bianco che Viola ha mal di pancia', expectedIntent: 'meal', category: 'meal_specific', difficulty: 'medium' },
  { input: 'Per merenda facciamo la torta di mele', expectedIntent: 'meal', category: 'meal_specific', difficulty: 'medium' },
  { input: 'Venerdi sera sushi a domicilio', expectedIntent: 'meal', category: 'meal_specific', difficulty: 'easy' },
  { input: 'Colazione con i cornetti domani mattina', expectedIntent: 'meal', category: 'meal_specific', difficulty: 'easy' },
  { input: 'Menu della settimana lunedi pasta martedi pollo mercoledi pesce giovedi pizza venerdi hamburger', expectedIntent: 'meal', category: 'meal_specific', difficulty: 'hard' },

  // ─── BOLLETTE E PAGAMENTI RICORRENTI ───
  { input: 'Pagare la bolletta del gas entro il 25', expectedIntent: 'expense', category: 'bills', difficulty: 'medium' },
  { input: 'L assicurazione della macchina scade il mese prossimo', expectedIntent: 'calendar', category: 'bills', difficulty: 'medium' },
  { input: 'Ricordami di pagare l affitto il primo del mese', expectedIntent: 'reminder', category: 'bills', difficulty: 'easy' },
  { input: 'Rata del mutuo 650 euro il 5 di ogni mese', expectedIntent: 'expense', category: 'bills', difficulty: 'medium' },
  { input: 'Rinnovare l abbonamento della palestra 40 euro al mese', expectedIntent: 'expense', category: 'bills', difficulty: 'medium' },
  { input: 'Bollo auto da pagare entro fine mese', expectedIntent: 'task', category: 'bills', difficulty: 'medium' },

  // ─── LOGISTICA COMPLESSA: chi dove quando ───
  { input: 'Io porto Asia a scuola e tu vai a prendere Viola a danza', expectedIntent: 'multi', category: 'logistics_complex', difficulty: 'hard' },
  { input: 'La nonna prende i bambini a scuola e li tiene fino alle 18', expectedIntent: 'calendar', category: 'logistics_complex', difficulty: 'hard' },
  { input: 'Cristian porta e Chiara riprende chi e d accordo', expectedIntent: 'calendar', category: 'logistics_complex', difficulty: 'hard' },
  { input: 'Domani la mamma di Sofia porta Asia a danza con la sua macchina', expectedIntent: 'calendar', category: 'logistics_complex', difficulty: 'hard' },
  { input: 'Papa porta tutti a scuola poi va al lavoro', expectedIntent: 'calendar', category: 'logistics_complex', difficulty: 'medium' },
  { input: 'Viola torna a casa da sola oggi che e grande', expectedIntent: 'calendar', category: 'logistics_complex', difficulty: 'hard' },

  // ─── EVENTI SPECIALI: feste, cerimonie ───
  { input: 'Compleanno di Asia il 15 aprile preparare la festa', expectedIntent: 'calendar', category: 'special_events', difficulty: 'medium' },
  { input: 'Comunione di Marco il 10 maggio comprare il regalo', expectedIntent: 'multi', category: 'special_events', difficulty: 'hard' },
  { input: 'Recita di Natale di Viola il 20 dicembre alle 17', expectedIntent: 'calendar', category: 'special_events', difficulty: 'easy' },
  { input: 'Festa di fine anno scolastico il 7 giugno', expectedIntent: 'calendar', category: 'special_events', difficulty: 'easy' },
  { input: 'Organizzare la festa di compleanno di Viola 10 bambini invitati', expectedIntent: 'calendar', category: 'special_events', difficulty: 'medium' },
  { input: 'Prenotare il ristorante per l anniversario sabato', expectedIntent: 'task', category: 'special_events', difficulty: 'medium' },

  // ─── EMERGENZE E IMPREVISTI ───
  { input: 'La macchina non parte dobbiamo chiamare il meccanico', expectedIntent: 'task', category: 'emergency', difficulty: 'medium' },
  { input: 'Si e rotto il tubo dell acqua serve l idraulico urgente', expectedIntent: 'task', category: 'emergency', difficulty: 'medium' },
  { input: 'Asia e caduta a scuola la stanno portando al pronto soccorso', expectedIntent: 'calendar', category: 'emergency', difficulty: 'hard' },
  { input: 'Mancata la luce in tutta la casa', expectedIntent: 'task', category: 'emergency', difficulty: 'hard' },
  { input: 'La lavatrice perde acqua chiamare il tecnico', expectedIntent: 'task', category: 'emergency', difficulty: 'medium' },

  // ─── ANIMALI DOMESTICI ───
  { input: 'Portare il cane dal veterinario domani', expectedIntent: 'calendar', category: 'pets', difficulty: 'easy' },
  { input: 'Comprare le crocchette per il gatto', expectedIntent: 'shopping', category: 'pets', difficulty: 'easy' },
  { input: 'Chi porta fuori il cane stasera', expectedIntent: 'task', category: 'pets', difficulty: 'medium' },
  { input: 'Vaccino del cane il 20 marzo alle 11', expectedIntent: 'calendar', category: 'pets', difficulty: 'easy' },
  { input: 'Manca il cibo per il pesce rosso', expectedIntent: 'shopping', category: 'pets', difficulty: 'easy' },

  // ─── TRASPORTI E SPOSTAMENTI ───
  { input: 'Prenotare il treno per Milano venerdi mattina', expectedIntent: 'task', category: 'transport', difficulty: 'medium' },
  { input: 'Portare la macchina a fare il tagliando', expectedIntent: 'task', category: 'transport', difficulty: 'medium' },
  { input: 'Fare benzina prima del viaggio', expectedIntent: 'task', category: 'transport', difficulty: 'easy' },
  { input: 'Il treno parte alle 8 e 15 da Brescia', expectedIntent: 'calendar', category: 'transport', difficulty: 'easy' },
  { input: 'Rinnovare la patente scade il mese prossimo', expectedIntent: 'task', category: 'transport', difficulty: 'medium' },

  // ─── PREMI E GAMIFICATION ───
  { input: 'Asia ha guadagnato 10 punti per aver fatto i compiti', expectedIntent: 'task', category: 'gamification', difficulty: 'hard' },
  { input: 'Viola vuole riscattare il premio gelato', expectedIntent: 'task', category: 'gamification', difficulty: 'hard' },
  { input: 'Dare 5 punti a Asia per aver riordinato la camera', expectedIntent: 'task', category: 'gamification', difficulty: 'hard' },

  // ─── FRASI CON NUMERI MISTI (cifre + lettere) ───
  { input: 'Compra 2 chili di mele e tre etti di prosciutto', expectedIntent: 'shopping', category: 'mixed_numbers', difficulty: 'medium' },
  { input: 'La visita costa 80 euro piu venti euro di ticket', expectedIntent: 'expense', category: 'mixed_numbers', difficulty: 'hard' },
  { input: 'Portare 15 euro per la gita piu cinque per il pranzo', expectedIntent: 'expense', category: 'mixed_numbers', difficulty: 'hard' },

  // ─── ORARI AMBIGUI E FORMATI DIVERSI ───
  { input: 'Appuntamento alle tre e mezza del pomeriggio', expectedIntent: 'calendar', category: 'time_formats', difficulty: 'medium' },
  { input: 'Visita medica ore 9 e 45', expectedIntent: 'calendar', category: 'time_formats', difficulty: 'easy' },
  { input: 'Verso le 4 andiamo al parco', expectedIntent: 'calendar', category: 'time_formats', difficulty: 'medium' },
  { input: 'Alle otto meno un quarto cena pronta', expectedIntent: 'calendar', category: 'time_formats', difficulty: 'hard' },
  { input: 'Tra mezz ora uscire di casa', expectedIntent: 'task', category: 'time_formats', difficulty: 'hard' },
  { input: 'Entro le 13 pranzo pronto', expectedIntent: 'meal', category: 'time_formats', difficulty: 'medium' },

  // ─── CONFERME E RISPOSTE ───
  { input: 'Si va bene conferma tutto', expectedIntent: 'unknown', category: 'confirmations', difficulty: 'easy' },
  { input: 'No cancella non voglio', expectedIntent: 'unknown', category: 'confirmations', difficulty: 'easy' },
  { input: 'Perfetto cosi grazie', expectedIntent: 'unknown', category: 'confirmations', difficulty: 'easy' },
  { input: 'Modifica la data a giovedi', expectedIntent: 'unknown', category: 'confirmations', difficulty: 'hard' },

  // ─── COMUNICAZIONI INTER-FAMILIARI ───
  { input: 'Avvisa la nonna che domenica non veniamo a pranzo', expectedIntent: 'reminder', category: 'family_comm', difficulty: 'hard' },
  { input: 'Chiamare la pediatra per prendere appuntamento', expectedIntent: 'task', category: 'family_comm', difficulty: 'easy' },
  { input: 'Mandare un messaggio alla maestra per giustificare Asia', expectedIntent: 'task', category: 'family_comm', difficulty: 'medium' },
  { input: 'Chiedere alla mamma di Giulia se puo portare Viola', expectedIntent: 'task', category: 'family_comm', difficulty: 'medium' },
  { input: 'Confermare la prenotazione del ristorante per sabato', expectedIntent: 'task', category: 'family_comm', difficulty: 'medium' },

  // ─── STRESS VOCALE: parole attaccate, ripetizioni ───
  { input: 'domaniasiahadanzaallesedici', expectedIntent: 'unknown', category: 'voice_stress', difficulty: 'hard' },
  { input: 'compra compra compra il latte', expectedIntent: 'shopping', category: 'voice_stress', difficulty: 'easy' },
  { input: 'ehm cioe praticamente domani cioe vado dal dottore', expectedIntent: 'calendar', category: 'voice_stress', difficulty: 'hard' },
  { input: 'no no no aspetta si domani alle 10 la visita', expectedIntent: 'calendar', category: 'voice_stress', difficulty: 'hard' },
  { input: 'mmm fammi pensare si ok compra le uova', expectedIntent: 'shopping', category: 'voice_stress', difficulty: 'medium' },
  { input: 'tipo verso le 3 o le 4 andiamo al parco', expectedIntent: 'calendar', category: 'voice_stress', difficulty: 'hard' },

  // ─── CASI LIMITE: frasi che confondono il parser ───
  { input: 'Viola porta fortuna', expectedIntent: 'unknown', category: 'confusing', difficulty: 'hard' },
  { input: 'Asia e un bel nome', expectedIntent: 'unknown', category: 'confusing', difficulty: 'hard' },
  { input: 'Il dottore ha detto che sta bene', expectedIntent: 'unknown', category: 'confusing', difficulty: 'hard' },
  { input: 'La pizza era buona ieri sera', expectedIntent: 'unknown', category: 'confusing', difficulty: 'hard' },
  { input: 'Quanto costa il corso di nuoto', expectedIntent: 'unknown', category: 'confusing', difficulty: 'hard' },
  { input: 'Mi piace la carbonara', expectedIntent: 'unknown', category: 'confusing', difficulty: 'hard' },
  { input: 'Bella la scuola nuova di Viola', expectedIntent: 'unknown', category: 'confusing', difficulty: 'hard' },
  { input: 'Ho fame', expectedIntent: 'unknown', category: 'confusing', difficulty: 'hard' },

  // ─── FRASI LUNGHISSIME: paragrafetti reali ───
  { input: 'Senti allora domani mattina io porto Asia a scuola poi passo dal meccanico a ritirare la macchina poi devo andare al supermercato perche non abbiamo niente in frigo e nel pomeriggio Viola ha danza alle 16 e qualcuno deve andarla a prendere alle 17 e mezza', expectedIntent: 'multi', category: 'very_long', difficulty: 'hard' },
  { input: 'La settimana prossima e piena lunedi dentista di Viola martedi riunione a scuola mercoledi e giovedi allenamento di Asia venerdi cena con gli amici e sabato compleanno di Marco dove servono 30 euro per il regalo', expectedIntent: 'multi', category: 'very_long', difficulty: 'hard' },
  { input: 'Oggi ho speso un sacco prima 45 euro al supermercato poi 15 euro in farmacia per le medicine di Viola e infine 8 euro di benzina tutto sommato circa 68 euro', expectedIntent: 'expense', category: 'very_long', difficulty: 'hard' },

  // ─── NEGAZIONI E MODIFICHE ───
  { input: 'Non comprare il latte lo abbiamo gia', expectedIntent: 'unknown', category: 'negation', difficulty: 'hard' },
  { input: 'Domani non andiamo dai nonni hanno disdetto', expectedIntent: 'unknown', category: 'negation', difficulty: 'hard' },
  { input: 'L appuntamento dal dentista e stato spostato', expectedIntent: 'unknown', category: 'negation', difficulty: 'hard' },
  { input: 'Non serve piu la baby sitter per sabato', expectedIntent: 'unknown', category: 'negation', difficulty: 'hard' },
  { input: 'Hanno cancellato la lezione di danza di domani', expectedIntent: 'absence', category: 'negation', difficulty: 'hard' },
  { input: 'Non devo piu pagare la quota perche e gratis', expectedIntent: 'unknown', category: 'negation', difficulty: 'hard' },

  // ─── METEO E CONDIZIONI ───
  { input: 'Se piove domani niente parco', expectedIntent: 'unknown', category: 'conditional', difficulty: 'hard' },
  { input: 'Se non piove sabato andiamo in bicicletta', expectedIntent: 'unknown', category: 'conditional', difficulty: 'hard' },
  { input: 'In caso di pioggia la partita viene rinviata', expectedIntent: 'unknown', category: 'conditional', difficulty: 'hard' },

  // ─── PUNTI VENDITA SPECIFICI ITALIANI ───
  { input: 'Andiamo alla Coop a fare la spesa', expectedIntent: 'shopping', category: 'stores_it', difficulty: 'medium' },
  { input: 'Passare da Tigota per il detersivo', expectedIntent: 'shopping', category: 'stores_it', difficulty: 'medium' },
  { input: 'Domani mattina Lidl che ci sono le offerte', expectedIntent: 'shopping', category: 'stores_it', difficulty: 'medium' },
  { input: 'Compra la cartella nuova da Cartolibreria', expectedIntent: 'shopping', category: 'stores_it', difficulty: 'medium' },
  { input: 'Passare in edicola a prendere il giornale', expectedIntent: 'task', category: 'stores_it', difficulty: 'medium' },

  // ═══════════════════════════════════════════════════════════════
  // BATCH 3: FRASI REALI DALL'UTENTE — Scenari autentici
  // ═══════════════════════════════════════════════════════════════

  // ─── FRASI REALI CRISTIAN: input vocale autentico ───
  { input: 'il 31 marzo ho una riunione delle 8 alle 10 e anche la mamma non c e la mattina', expectedIntent: 'multi', category: 'real_cristian', difficulty: 'hard' },
  { input: 'abbiamo prenotato per le ferie dal 15 giugno al 30 giugno a bellaria sono 100 euro', expectedIntent: 'multi', category: 'real_cristian', difficulty: 'hard' },
  { input: 'francesco e sara tra 2 venerdi vengono a cena da noi', expectedIntent: 'calendar', category: 'real_cristian', difficulty: 'hard' },
  { input: 'chiara ricordati di prendere il regalo', expectedIntent: 'reminder', category: 'real_cristian', difficulty: 'easy' },
  { input: 'viola fai il bigliettino per sofia', expectedIntent: 'task', category: 'real_cristian', difficulty: 'easy' },

  // ─── VARIANTI DELLE FRASI REALI: come le direbbe qualcun altro ───
  { input: 'Ho una riunione il 31 marzo dalle 8 alle 10', expectedIntent: 'calendar', category: 'real_variants', difficulty: 'medium' },
  { input: 'La mamma il 31 marzo mattina non c e', expectedIntent: 'absence', category: 'real_variants', difficulty: 'hard' },
  { input: 'Prenotato le vacanze dal 15 al 30 giugno a Bellaria 100 euro', expectedIntent: 'multi', category: 'real_variants', difficulty: 'hard' },
  { input: 'Ferie a Bellaria dal 15 giugno per due settimane', expectedIntent: 'calendar', category: 'real_variants', difficulty: 'medium' },
  { input: 'Vacanze costano cento euro', expectedIntent: 'expense', category: 'real_variants', difficulty: 'medium' },
  { input: 'Francesco e Sara vengono a cena venerdi tra due settimane', expectedIntent: 'calendar', category: 'real_variants', difficulty: 'hard' },
  { input: 'Tra due venerdi abbiamo ospiti a cena', expectedIntent: 'calendar', category: 'real_variants', difficulty: 'hard' },
  { input: 'Chiara prendi il regalo per la cena con Francesco', expectedIntent: 'task', category: 'real_variants', difficulty: 'medium' },
  { input: 'Viola prepara il biglietto di auguri per Sofia', expectedIntent: 'task', category: 'real_variants', difficulty: 'easy' },
  { input: 'Ricordati di prendere un regalo per sabato sera', expectedIntent: 'reminder', category: 'real_variants', difficulty: 'easy' },

  // ─── FERIE E VACANZE: scenari tipici ───
  { input: 'Prenotare il villaggio a Rimini per agosto', expectedIntent: 'task', category: 'vacanze', difficulty: 'medium' },
  { input: 'Le ferie costano 1200 euro tutto compreso', expectedIntent: 'expense', category: 'vacanze', difficulty: 'medium' },
  { input: 'Preparare le valigie per la partenza di sabato', expectedIntent: 'task', category: 'vacanze', difficulty: 'easy' },
  { input: 'Portare il costume e le ciabatte per la piscina', expectedIntent: 'task', category: 'vacanze', difficulty: 'easy' },
  { input: 'Comprare la crema solare e il doposole', expectedIntent: 'shopping', category: 'vacanze', difficulty: 'easy' },
  { input: 'Chiudere il gas e l acqua prima di partire', expectedIntent: 'task', category: 'vacanze', difficulty: 'medium' },
  { input: 'La nonna guarda il gatto mentre siamo in vacanza', expectedIntent: 'calendar', category: 'vacanze', difficulty: 'medium' },
  { input: 'Pagato 300 euro di caparra per l hotel', expectedIntent: 'expense', category: 'vacanze', difficulty: 'easy' },

  // ─── OSPITI A CENA: organizzazione serata ───
  { input: 'Sabato sera vengono i Bianchi a cena', expectedIntent: 'calendar', category: 'dinner_guests', difficulty: 'medium' },
  { input: 'Preparare antipasto primo e dolce per sabato', expectedIntent: 'task', category: 'dinner_guests', difficulty: 'medium' },
  { input: 'Comprare il vino rosso e il prosecco per la cena', expectedIntent: 'shopping', category: 'dinner_guests', difficulty: 'easy' },
  { input: 'Pulire bene la casa prima che arrivino gli ospiti', expectedIntent: 'task', category: 'dinner_guests', difficulty: 'easy' },
  { input: 'Marco e Lucia portano il dolce noi facciamo il resto', expectedIntent: 'calendar', category: 'dinner_guests', difficulty: 'hard' },
  { input: 'Mettere la tovaglia bella e le candele per sabato sera', expectedIntent: 'task', category: 'dinner_guests', difficulty: 'easy' },

  // ─── RANGE DI DATE: dal... al... ───
  { input: 'Settimana bianca dal 1 al 8 febbraio', expectedIntent: 'calendar', category: 'date_range', difficulty: 'hard' },
  { input: 'Campo estivo di Asia dal 10 al 21 giugno', expectedIntent: 'calendar', category: 'date_range', difficulty: 'hard' },
  { input: 'La scuola chiude dal 10 giugno al 12 settembre', expectedIntent: 'calendar', category: 'date_range', difficulty: 'hard' },
  { input: 'Corso di nuoto da settembre a dicembre', expectedIntent: 'calendar', category: 'date_range', difficulty: 'hard' },
  { input: 'Assicurazione valida dal primo gennaio al 31 dicembre', expectedIntent: 'calendar', category: 'date_range', difficulty: 'hard' },

  // ─── RANGE DI ORARI: dalle... alle... ───
  { input: 'Riunione dalle 8 alle 10 di mattina', expectedIntent: 'calendar', category: 'time_range', difficulty: 'medium' },
  { input: 'Allenamento dalle 16 alle 17 e 30', expectedIntent: 'calendar', category: 'time_range', difficulty: 'medium' },
  { input: 'Corso di inglese dalle 14 alle 15', expectedIntent: 'calendar', category: 'time_range', difficulty: 'easy' },
  { input: 'Scuola dalle 8 e 30 alle 16', expectedIntent: 'calendar', category: 'time_range', difficulty: 'medium' },
  { input: 'Baby sitter dalle 18 alle 22', expectedIntent: 'calendar', category: 'time_range', difficulty: 'medium' },

  // ─── PERSONE ESTERNE: non familiari ───
  { input: 'Marco e Giulia vengono a trovarci domenica', expectedIntent: 'calendar', category: 'external_people', difficulty: 'medium' },
  { input: 'La baby sitter arriva alle 17', expectedIntent: 'calendar', category: 'external_people', difficulty: 'easy' },
  { input: 'L idraulico viene lunedi mattina', expectedIntent: 'calendar', category: 'external_people', difficulty: 'easy' },
  { input: 'La signora delle pulizie non viene questa settimana', expectedIntent: 'absence', category: 'external_people', difficulty: 'hard' },
  { input: 'Il corriere passa domani con il pacco', expectedIntent: 'calendar', category: 'external_people', difficulty: 'medium' },

  // ─── COMANDI MULTIPLI IN SEQUENZA: come un flusso di coscienza ───
  { input: 'Asia studia matematica Viola fa i compiti di italiano e Chiara prepara la cena', expectedIntent: 'multi', category: 'sequential_cmds', difficulty: 'hard' },
  { input: 'Lunedi dentista martedi riunione mercoledi palestra', expectedIntent: 'multi', category: 'sequential_cmds', difficulty: 'hard' },
  { input: 'Compra pane latte uova e prendi anche il detersivo per i piatti', expectedIntent: 'shopping', category: 'sequential_cmds', difficulty: 'medium' },
  { input: 'Prima porto Asia poi passo al supermercato e infine vado dal meccanico', expectedIntent: 'multi', category: 'sequential_cmds', difficulty: 'hard' },
  { input: 'Pagare la luce pagare il gas pagare l acqua tutte entro venerdi', expectedIntent: 'expense', category: 'sequential_cmds', difficulty: 'hard' },

  // ─── QUANTITA E MISURE ITALIANE ───
  { input: 'Prendi un etto di prosciutto crudo', expectedIntent: 'shopping', category: 'italian_measures', difficulty: 'medium' },
  { input: 'Compra mezzo chilo di pane', expectedIntent: 'shopping', category: 'italian_measures', difficulty: 'medium' },
  { input: 'Servono due litri di latte fresco', expectedIntent: 'shopping', category: 'italian_measures', difficulty: 'medium' },
  { input: 'Prendi un chilo di arance e mezzo di mele', expectedIntent: 'shopping', category: 'italian_measures', difficulty: 'medium' },
  { input: 'Tre etti di mortadella e due di formaggio', expectedIntent: 'shopping', category: 'italian_measures', difficulty: 'medium' },

  // ─── ESPRESSIONI ITALIANE COLLOQUIALI ───
  { input: 'Dai che e tardi muovetevi', expectedIntent: 'unknown', category: 'colloquial', difficulty: 'hard' },
  { input: 'Basta litigare fate i bravi', expectedIntent: 'unknown', category: 'colloquial', difficulty: 'hard' },
  { input: 'Chi ha lasciato i piatti nel lavandino', expectedIntent: 'task', category: 'colloquial', difficulty: 'hard' },
  { input: 'Viola smettila di stare al telefono e fai i compiti', expectedIntent: 'task', category: 'colloquial', difficulty: 'hard' },
  { input: 'Ragazzi a tavola e pronto', expectedIntent: 'unknown', category: 'colloquial', difficulty: 'hard' },
  { input: 'Asia hai dato da mangiare al cane', expectedIntent: 'task', category: 'colloquial', difficulty: 'hard' },

  // ─── SPORT E ATTIVITA SPECIFICHE ITALIANE ───
  { input: 'Iscrizione al corso di calcetto 150 euro', expectedIntent: 'expense', category: 'sport_specific', difficulty: 'medium' },
  { input: 'Partita di calcio di Asia sabato alle 10 al campo sportivo', expectedIntent: 'calendar', category: 'sport_specific', difficulty: 'easy' },
  { input: 'Saggio di danza di Viola il 15 giugno al teatro', expectedIntent: 'calendar', category: 'sport_specific', difficulty: 'easy' },
  { input: 'Torneo di nuoto regionale sabato e domenica', expectedIntent: 'calendar', category: 'sport_specific', difficulty: 'medium' },
  { input: 'Comprare le scarpette nuove da calcio per Asia', expectedIntent: 'shopping', category: 'sport_specific', difficulty: 'easy' },

  // ─── CATECHISMO E ATTIVITA RELIGIOSE ───
  { input: 'Viola ha catechismo sabato alle 15', expectedIntent: 'calendar', category: 'religious', difficulty: 'easy' },
  { input: 'La prima comunione di Asia e il 12 maggio', expectedIntent: 'calendar', category: 'religious', difficulty: 'easy' },
  { input: 'Comprare il vestito bianco per la comunione', expectedIntent: 'shopping', category: 'religious', difficulty: 'medium' },
  { input: 'Prenotare il ristorante per il pranzo della comunione 30 persone', expectedIntent: 'calendar', category: 'religious', difficulty: 'medium' },

  // ─── COMPLEANNI E REGALI ───
  { input: 'Il compleanno di Asia e fra 3 settimane', expectedIntent: 'calendar', category: 'birthdays', difficulty: 'medium' },
  { input: 'Comprare la torta al cioccolato per il compleanno di Viola', expectedIntent: 'calendar', category: 'birthdays', difficulty: 'easy' },
  { input: 'Invitare 15 bambini alla festa di Asia', expectedIntent: 'task', category: 'birthdays', difficulty: 'medium' },
  { input: 'Ordinare i palloncini e i piatti per la festa', expectedIntent: 'shopping', category: 'birthdays', difficulty: 'easy' },
  { input: 'Il regalo per Sofia costa 25 euro', expectedIntent: 'expense', category: 'birthdays', difficulty: 'easy' },
  { input: 'Speso ottanta euro per i regali dei compagni di classe', expectedIntent: 'expense', category: 'birthdays', difficulty: 'medium' },

  // ─── CONFLICT DETECTION: "non posso" → cerca conflitto e delega ───
  // Queste frasi dovranno triggerare il conflict detector (futuro)
  // Per ora le testiamo come "unknown" perché il sistema non le gestisce ancora
  { input: 'Domani non posso portare Viola a danza', expectedIntent: 'unknown', category: 'conflict', difficulty: 'hard' },
  { input: 'Non riesco a prendere Asia a scuola domani', expectedIntent: 'unknown', category: 'conflict', difficulty: 'hard' },
  { input: 'Io domani non ci sono chi porta i bambini', expectedIntent: 'unknown', category: 'conflict', difficulty: 'hard' },
  { input: 'Non posso andare alla riunione di martedi', expectedIntent: 'unknown', category: 'conflict', difficulty: 'hard' },
  { input: 'Scambiamoci domani tu porti Asia e io prendo Viola', expectedIntent: 'multi', category: 'conflict', difficulty: 'hard' },
  { input: 'Ho un impegno alle 16 chi porta Viola a danza', expectedIntent: 'calendar', category: 'conflict', difficulty: 'hard' },
  { input: 'La macchina e dal meccanico come portiamo i bambini', expectedIntent: 'unknown', category: 'conflict', difficulty: 'hard' },
  { input: 'Chiara non puo domani pomeriggio serve qualcun altro', expectedIntent: 'unknown', category: 'conflict', difficulty: 'hard' },
  { input: 'Domani mattina ho la riunione e anche Chiara lavora chi porta Asia', expectedIntent: 'multi', category: 'conflict', difficulty: 'hard' },
  { input: 'Sembra destino ma domani non posso portare Viola', expectedIntent: 'unknown', category: 'conflict', difficulty: 'hard' },

  // ─── DOCUMENTI E BUROCRAZIA ───
  { input: 'Rinnovare il passaporto di Asia', expectedIntent: 'task', category: 'bureaucracy', difficulty: 'medium' },
  { input: 'Portare la carta d identita per l iscrizione a scuola', expectedIntent: 'task', category: 'bureaucracy', difficulty: 'medium' },
  { input: 'Scadenza ISEE entro il 15 del mese', expectedIntent: 'calendar', category: 'bureaucracy', difficulty: 'medium' },
  { input: 'Prenotare appuntamento al comune per i documenti', expectedIntent: 'calendar', category: 'bureaucracy', difficulty: 'medium' },
  { input: 'Pagare il bollo auto 200 euro', expectedIntent: 'expense', category: 'bureaucracy', difficulty: 'easy' },
]

// ═══════════════════════════════════════════════════════════════
// RUNNER
// ═══════════════════════════════════════════════════════════════

/**
 * Esegue lo stress test completo.
 * @param {Array} members - Membri della famiglia
 * @param {string} familyId
 * @param {Object} currentMember
 * @param {Object} opts - { onProgress, includeL3, batchSize }
 * @returns {Object} Report completo
 */
export async function runStressTest(members, familyId, currentMember, opts = {}) {
  const { onProgress, includeL3 = false, batchSize = 10 } = opts

  const allPhrases = [...TEST_PHRASES, ...STRESS_PHRASES]
  const total = allPhrases.length
  const results = []
  const startTime = Date.now()

  const stats = {
    total: 0,
    parsed: 0,          // L0+L1+L2 ha trovato un intent
    correctIntent: 0,   // Intent trovato == expectedIntent
    wrongIntent: 0,     // Intent trovato != expectedIntent
    noIntent: 0,        // Nessun intent trovato (confidence bassa)
    needsAI: 0,         // Servirebbe L3
    errors: 0,          // Eccezioni/crash
    multiAction: 0,     // Frasi con 2+ azioni
    byCategory: {},
    byDifficulty: { easy: { ok: 0, fail: 0 }, medium: { ok: 0, fail: 0 }, hard: { ok: 0, fail: 0 } },
    confidenceDistribution: { high: 0, medium: 0, low: 0, none: 0 },
    avgConfidence: 0,
    avgTimeMs: 0,
    slowest: { input: '', timeMs: 0 },
    fastest: { input: '', timeMs: Infinity },
    crashes: [],
  }

  for (let i = 0; i < total; i++) {
    const phrase = allPhrases[i]

    if (onProgress) onProgress(i + 1, total, phrase.input)

    // Skip empty input
    if (!phrase.input?.trim()) {
      results.push({ ...phrase, skipped: true, reason: 'empty input' })
      stats.total++
      stats.noIntent++
      continue
    }

    const t0 = performance.now()
    let result = null
    let error = null

    try {
      result = await parseLocally(
        phrase.input,
        members,
        familyId,
        currentMember,
        null // no debug trace (speed)
      )
    } catch (err) {
      error = err.message || String(err)
      stats.errors++
      stats.crashes.push({ input: phrase.input, error })
    }

    const elapsed = performance.now() - t0
    stats.total++

    // Classify result
    const confidence = result?.confidence || 0
    const actions = result?.actions || []
    const detectedIntent = actions.length > 0 ? actions[0].type : 'none'
    const isMulti = actions.length > 1

    // Evaluate correctness
    let isCorrect = false
    if (phrase.expectedIntent === 'multi') {
      isCorrect = actions.length >= 2
    } else if (phrase.expectedIntent === 'none' || phrase.expectedIntent === 'unknown') {
      isCorrect = confidence < 0.55 || actions.length === 0 || detectedIntent === 'note'
    } else if (phrase.expectedIntent === 'absence') {
      // Absence è implementato come calendar con isAbsence/category=assenza
      isCorrect = actions.some(a => a.isAbsence || a.category === 'assenza')
    } else if (phrase.expectedIntent === 'reminder') {
      // Reminder e task sono simili — accetta entrambi
      isCorrect = detectedIntent === 'reminder' || detectedIntent === 'task'
    } else {
      isCorrect = detectedIntent === phrase.expectedIntent
    }

    // Conta accuracy reale basata su isCorrect
    if (isCorrect) {
      stats.correctIntent++
    } else {
      stats.wrongIntent++
    }

    // Conta parsed vs needsAI separatamente
    if (result?.ok && confidence >= 0.55) {
      stats.parsed++
    } else {
      stats.noIntent++
      stats.needsAI++
    }

    if (isMulti) stats.multiAction++

    // Confidence distribution
    if (confidence >= 0.80) stats.confidenceDistribution.high++
    else if (confidence >= 0.55) stats.confidenceDistribution.medium++
    else if (confidence > 0) stats.confidenceDistribution.low++
    else stats.confidenceDistribution.none++

    // By category
    const cat = phrase.category || 'other'
    if (!stats.byCategory[cat]) stats.byCategory[cat] = { ok: 0, fail: 0, total: 0 }
    stats.byCategory[cat].total++
    if (isCorrect) stats.byCategory[cat].ok++
    else stats.byCategory[cat].fail++

    // By difficulty
    const diff = phrase.difficulty || 'medium'
    if (stats.byDifficulty[diff]) {
      if (isCorrect) stats.byDifficulty[diff].ok++
      else stats.byDifficulty[diff].fail++
    }

    // Timing
    stats.avgConfidence += confidence
    stats.avgTimeMs += elapsed
    if (elapsed > stats.slowest.timeMs) stats.slowest = { input: phrase.input, timeMs: elapsed }
    if (elapsed < stats.fastest.timeMs) stats.fastest = { input: phrase.input, timeMs: elapsed }

    results.push({
      input: phrase.input,
      expectedIntent: phrase.expectedIntent,
      detectedIntent,
      confidence,
      isCorrect,
      isMulti,
      actionsCount: actions.length,
      actions: actions.map(a => ({ type: a.type, title: a.title, date: a.date, amount: a.amount })),
      timeMs: Math.round(elapsed * 100) / 100,
      error,
      category: cat,
      difficulty: diff,
    })

    // Yield every batchSize to avoid blocking UI
    if (i % batchSize === 0) {
      await new Promise(r => setTimeout(r, 0))
    }
  }

  // Finalize stats
  stats.avgConfidence = stats.total > 0 ? Math.round((stats.avgConfidence / stats.total) * 100) / 100 : 0
  stats.avgTimeMs = stats.total > 0 ? Math.round((stats.avgTimeMs / stats.total) * 100) / 100 : 0
  stats.slowest.timeMs = Math.round(stats.slowest.timeMs * 100) / 100
  stats.fastest.timeMs = stats.fastest.timeMs === Infinity ? 0 : Math.round(stats.fastest.timeMs * 100) / 100
  stats.accuracy = stats.total > 0 ? Math.round((stats.correctIntent / stats.total) * 10000) / 100 : 0
  stats.totalTimeMs = Date.now() - startTime

  // Failed phrases for review
  const failures = results.filter(r => !r.isCorrect && !r.skipped)

  return {
    stats,
    failures,
    results,
    summary: buildSummary(stats, failures),
  }
}

function buildSummary(stats, failures) {
  const lines = [
    `══════════════════════════════════════════`,
    `  STRESS TEST REPORT — Cervellone NLP`,
    `══════════════════════════════════════════`,
    ``,
    `TOTALE FRASI: ${stats.total}`,
    `ACCURACY: ${stats.accuracy}% (${stats.correctIntent}/${stats.total})`,
    ``,
    `  Parsate correttamente: ${stats.correctIntent}`,
    `  Intent sbagliato:      ${stats.wrongIntent}`,
    `  Nessun intent (→ AI):  ${stats.needsAI}`,
    `  Multi-azione:          ${stats.multiAction}`,
    `  Crash/errori:          ${stats.errors}`,
    ``,
    `CONFIDENCE:`,
    `  Alta (≥0.80):  ${stats.confidenceDistribution.high}`,
    `  Media (≥0.55): ${stats.confidenceDistribution.medium}`,
    `  Bassa (<0.55): ${stats.confidenceDistribution.low}`,
    `  Nessuna:       ${stats.confidenceDistribution.none}`,
    `  Media:         ${stats.avgConfidence}`,
    ``,
    `PERFORMANCE:`,
    `  Tempo medio:   ${stats.avgTimeMs} ms/frase`,
    `  Piu lenta:     ${stats.slowest.timeMs} ms — "${stats.slowest.input.slice(0, 50)}"`,
    `  Piu veloce:    ${stats.fastest.timeMs} ms — "${stats.fastest.input.slice(0, 50)}"`,
    `  Tempo totale:  ${stats.totalTimeMs} ms`,
    ``,
    `PER DIFFICOLTA:`,
    `  Easy:   ${stats.byDifficulty.easy.ok}/${stats.byDifficulty.easy.ok + stats.byDifficulty.easy.fail} OK`,
    `  Medium: ${stats.byDifficulty.medium.ok}/${stats.byDifficulty.medium.ok + stats.byDifficulty.medium.fail} OK`,
    `  Hard:   ${stats.byDifficulty.hard.ok}/${stats.byDifficulty.hard.ok + stats.byDifficulty.hard.fail} OK`,
    ``,
    `PER CATEGORIA:`,
  ]

  for (const [cat, data] of Object.entries(stats.byCategory).sort((a, b) => b[1].total - a[1].total)) {
    const pct = data.total > 0 ? Math.round((data.ok / data.total) * 100) : 0
    lines.push(`  ${cat.padEnd(20)} ${data.ok}/${data.total} (${pct}%)`)
  }

  if (failures.length > 0) {
    lines.push(``)
    lines.push(`FALLIMENTI (top 20):`)
    for (const f of failures.slice(0, 20)) {
      lines.push(`  ✗ "${f.input.slice(0, 60)}"`)
      lines.push(`    Atteso: ${f.expectedIntent} | Trovato: ${f.detectedIntent} (conf: ${f.confidence})`)
    }
  }

  if (stats.crashes.length > 0) {
    lines.push(``)
    lines.push(`CRASH:`)
    for (const c of stats.crashes) {
      lines.push(`  ✗ "${c.input.slice(0, 60)}" → ${c.error}`)
    }
  }

  return lines.join('\n')
}
