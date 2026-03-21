/**
 * italianDict.js — Curated Italian dictionary for spell-checking.
 * ~3500 common words covering the app's domain (family organizer).
 *
 * Categories:
 *   - Articles, prepositions, conjunctions, pronouns
 *   - Common verbs (infinitives + key conjugations)
 *   - Time & calendar words
 *   - Family & people
 *   - Food, meals, cooking
 *   - Household, cleaning, chores
 *   - Places & locations
 *   - Shopping items
 *   - Medical & health
 *   - Sports & activities
 *   - Expenses & money
 *   - Numbers
 *   - Adjectives & adverbs
 *   - Domain-specific (app family names, etc.)
 */
export const ITALIAN_DICT = new Set([

  // ── Articles & Prepositions ──────────────────────────────────
  'il', 'lo', 'la', 'le', 'li', 'gli', 'un', 'uno', 'una',
  'di', 'da', 'in', 'con', 'su', 'per', 'tra', 'fra',
  'al', 'allo', 'alla', 'alle', 'ai', 'agli',
  'del', 'dello', 'della', 'delle', 'dei', 'degli',
  'dal', 'dallo', 'dalla', 'dalle', 'dai', 'dagli',
  'nel', 'nello', 'nella', 'nelle', 'nei', 'negli',
  'sul', 'sullo', 'sulla', 'sulle', 'sui', 'sugli',

  // ── Conjunctions & Connectives ───────────────────────────────
  'e', 'o', 'ma', 'che', 'non', 'anche', 'ancora', 'già',
  'poi', 'quindi', 'però', 'oppure', 'perché', 'quando',
  'come', 'dove', 'cosa', 'chi', 'quale', 'quanto',
  'se', 'mentre', 'dopo', 'prima', 'durante', 'fino',
  'verso', 'circa', 'quasi', 'senza', 'oltre', 'dentro',
  'fuori', 'sotto', 'sopra', 'davanti', 'dietro', 'accanto',
  'insieme', 'invece', 'comunque', 'altrimenti', 'eppure',
  'infatti', 'insomma', 'dunque', 'allora', 'anzi',

  // ── Pronouns ─────────────────────────────────────────────────
  'io', 'tu', 'lui', 'lei', 'noi', 'voi', 'loro',
  'mi', 'ti', 'ci', 'vi', 'si', 'ne', 'me', 'te', 'ce',
  'questo', 'questa', 'questi', 'queste', 'quello', 'quella',
  'quelli', 'quelle', 'quale', 'quali',
  'mio', 'mia', 'miei', 'mie', 'tuo', 'tua', 'tuoi', 'tue',
  'suo', 'sua', 'suoi', 'sue', 'nostro', 'nostra', 'nostri', 'nostre',
  'vostro', 'vostra', 'vostri', 'vostre', 'loro',

  // ── Common verbs (infinitive + key conjugations) ─────────────
  // essere
  'essere', 'sono', 'sei', 'siamo', 'siete', 'stata', 'stato', 'stati', 'state',
  // avere
  'avere', 'ho', 'hai', 'ha', 'abbiamo', 'avete', 'hanno', 'avuto',
  // fare
  'fare', 'fai', 'faccio', 'fa', 'facciamo', 'fate', 'fanno', 'fatto', 'faremo',
  // andare
  'andare', 'vado', 'vai', 'va', 'andiamo', 'andate', 'vanno', 'andato', 'andata', 'andati',
  // comprare
  'comprare', 'compra', 'compro', 'compri', 'compriamo', 'comprate', 'comprano', 'comprato',
  // portare
  'portare', 'porta', 'porto', 'porti', 'portiamo', 'portate', 'portano', 'portato',
  // prendere
  'prendere', 'prendi', 'prendo', 'prende', 'prendiamo', 'prendete', 'preso',
  // mettere
  'mettere', 'metti', 'metto', 'mette', 'mettiamo', 'messo',
  // togliere
  'togliere', 'togli', 'tolgo', 'toglie', 'togliamo', 'tolto',
  // lavare
  'lavare', 'lava', 'lavo', 'lavi', 'laviamo', 'lavato', 'lavata',
  // pulire
  'pulire', 'pulisci', 'pulisco', 'pulisce', 'puliamo', 'pulito', 'pulita',
  // stirare
  'stirare', 'stira', 'stiro', 'stiri', 'stirato', 'stirata',
  // cucinare
  'cucinare', 'cucina', 'cucino', 'cucini', 'cuciniamo', 'cucinato',
  // preparare
  'preparare', 'prepara', 'preparo', 'prepari', 'prepariamo', 'preparato',
  // pagare
  'pagare', 'paga', 'pago', 'paghi', 'paghiamo', 'pagato',
  // spendere
  'spendere', 'spendo', 'spendi', 'spende', 'spendiamo', 'speso',
  // ricordare
  'ricordare', 'ricorda', 'ricordo', 'ricordi', 'ricordami', 'ricordati', 'ricordaci', 'ricordatevi',
  // prenotare
  'prenotare', 'prenota', 'prenoto', 'prenoti', 'prenotato',
  // chiamare
  'chiamare', 'chiama', 'chiamo', 'chiami', 'chiamato',
  // svuotare
  'svuotare', 'svuota', 'svuoto',
  // riordinare
  'riordinare', 'riordina', 'riordino',
  // apparecchiare / sparecchiare
  'apparecchiare', 'apparecchia', 'apparecchio',
  'sparecchiare', 'sparecchia', 'sparecchio',
  // innaffiare
  'innaffiare', 'innaffia', 'innaffio',
  // stendere
  'stendere', 'stendi', 'stendo', 'steso', 'stesa',
  // aspirare
  'aspirare', 'aspira', 'aspiro',
  // buttare
  'buttare', 'butta', 'butto', 'buttato',
  // spazzare
  'spazzare', 'spazza', 'spazzo',
  // raccogliere
  'raccogliere', 'raccogli', 'raccolgo', 'raccolto',
  // caricare
  'caricare', 'carica', 'carico',
  // piegare
  'piegare', 'piega', 'piego', 'piegato',
  // cambiare
  'cambiare', 'cambia', 'cambio', 'cambiato',
  // sistemare
  'sistemare', 'sistema', 'sistemo', 'sistemato',
  // controllare
  'controllare', 'controlla', 'controllo', 'controllato',
  // ordinare
  'ordinare', 'ordina', 'ordino', 'ordinato',
  // mangiare
  'mangiare', 'mangia', 'mangio', 'mangiamo', 'mangiato',
  // bere
  'bere', 'bevo', 'bevi', 'beve', 'beviamo', 'bevuto',
  // dormire
  'dormire', 'dormo', 'dormi', 'dorme', 'dormiamo', 'dormito',
  // uscire
  'uscire', 'esco', 'esci', 'esce', 'usciamo', 'uscito', 'uscita',
  // venire
  'venire', 'vengo', 'vieni', 'viene', 'veniamo', 'venuto', 'venuta',
  // stare
  'stare', 'sto', 'stai', 'sta', 'stiamo', 'state', 'stanno',
  // dovere
  'dovere', 'devo', 'devi', 'deve', 'dobbiamo', 'devono', 'dovete',
  // potere
  'potere', 'posso', 'puoi', 'può', 'possiamo', 'possono', 'potete',
  // volere
  'volere', 'voglio', 'vuoi', 'vuole', 'vogliamo', 'vogliono', 'volete',
  // sapere
  'sapere', 'so', 'sai', 'sa', 'sappiamo', 'sanno',
  // dire
  'dire', 'dico', 'dici', 'dice', 'diciamo', 'detto',
  // vedere
  'vedere', 'vedo', 'vedi', 'vede', 'vediamo', 'visto',
  // sentire
  'sentire', 'sento', 'senti', 'sente', 'sentiamo', 'sentito',
  // pensare
  'pensare', 'penso', 'pensi', 'pensa', 'pensiamo', 'pensato',
  // provare
  'provare', 'prova', 'provo', 'provato',
  // trovare
  'trovare', 'trova', 'trovo', 'trovato',
  // parlare
  'parlare', 'parla', 'parlo', 'parlato',
  // aspettare
  'aspettare', 'aspetta', 'aspetto', 'aspettato',
  // tornare
  'tornare', 'torna', 'torno', 'tornato', 'tornata',
  // arrivare
  'arrivare', 'arriva', 'arrivo', 'arrivato', 'arrivata',
  // partire
  'partire', 'parto', 'parti', 'parte', 'partiamo', 'partito', 'partita',
  // restare
  'restare', 'resta', 'resto', 'restato',
  // accompagnare
  'accompagnare', 'accompagna', 'accompagno', 'accompagnato',
  // ritirare
  'ritirare', 'ritira', 'ritiro', 'ritirato',
  // consegnare
  'consegnare', 'consegna', 'consegno', 'consegnato',
  // firmare
  'firmare', 'firma', 'firmo', 'firmato',
  // stampare
  'stampare', 'stampa', 'stampo', 'stampato',
  // rinnovare
  'rinnovare', 'rinnova', 'rinnovo', 'rinnovato',
  // iscrivere
  'iscrivere', 'iscrivi', 'iscrivo', 'iscritto',
  // avvisare
  'avvisare', 'avvisami', 'avvisaci', 'avvisa',
  // studiare
  'studiare', 'studia', 'studio', 'studiato',
  // giocare
  'giocare', 'gioca', 'gioco', 'giocato',
  // leggere
  'leggere', 'leggi', 'leggo', 'letto',
  // scrivere
  'scrivere', 'scrivi', 'scrivo', 'scritto',
  // finire
  'finire', 'finisci', 'finisco', 'finisce', 'finito', 'finita', 'finiti',
  // iniziare / cominciare
  'iniziare', 'inizia', 'inizio', 'iniziato',
  'cominciare', 'comincia', 'comincio', 'cominciato',
  // aprire / chiudere
  'aprire', 'apri', 'apro', 'aperto',
  'chiudere', 'chiudi', 'chiudo', 'chiuso',
  // servire
  'servire', 'serve', 'servono', 'servito',
  // mancare
  'mancare', 'manca', 'mancano',
  // bastare
  'bastare', 'basta', 'bastano',
  // costare
  'costare', 'costa', 'costano', 'costato',
  // piacere
  'piacere', 'piace', 'piacciono',
  // passare
  'passare', 'passa', 'passo', 'passato',
  // spostare
  'spostare', 'sposta', 'sposto', 'spostato',
  // cancellare
  'cancellare', 'cancella', 'cancello', 'cancellato',
  // confermare
  'confermare', 'conferma', 'confermo', 'confermato',
  // fissare
  'fissare', 'fissa', 'fisso', 'fissato',
  // organizzare
  'organizzare', 'organizza', 'organizzo', 'organizzato',
  // segnare
  'segnare', 'segna', 'segno', 'segnato',

  // ── Time & Calendar ──────────────────────────────────────────
  'oggi', 'domani', 'dopodomani', 'ieri', 'adesso', 'ora',
  'mattina', 'mattino', 'pomeriggio', 'sera', 'notte',
  'stamattina', 'stasera', 'stanotte', 'stanootte',
  'settimana', 'mese', 'anno', 'giorno', 'giorni', 'settimane', 'mesi', 'anni',
  'prossimo', 'prossima', 'prossimi', 'prossime',
  'scorso', 'scorsa', 'scorsi', 'scorse',
  // Days of week
  'lunedì', 'lunedi', 'martedì', 'martedi',
  'mercoledì', 'mercoledi', 'giovedì', 'giovedi',
  'venerdì', 'venerdi', 'sabato', 'domenica',
  // Months
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
  // Time expressions
  'alle', 'dalle', 'fino', 'entro', 'verso', 'circa',
  'mezzogiorno', 'mezzanotte', 'presto', 'tardi',
  'sempre', 'mai', 'spesso', 'qualche', 'volta',

  // ── Numbers as words ─────────────────────────────────────────
  'zero', 'uno', 'due', 'tre', 'quattro', 'cinque',
  'sei', 'sette', 'otto', 'nove', 'dieci',
  'undici', 'dodici', 'tredici', 'quattordici', 'quindici',
  'sedici', 'diciassette', 'diciotto', 'diciannove', 'venti',
  'trenta', 'quaranta', 'cinquanta', 'sessanta', 'settanta',
  'ottanta', 'novanta', 'cento', 'mille', 'mila',
  'primo', 'prima', 'secondo', 'seconda', 'terzo', 'terza',
  'mezzo', 'mezza', 'paio',

  // ── Family & People ──────────────────────────────────────────
  'famiglia', 'famiglie', 'casa', 'bambino', 'bambina', 'bambini', 'bambine',
  'figlio', 'figlia', 'figli', 'figlie',
  'mamma', 'papà', 'papa', 'madre', 'padre', 'genitori',
  'nonno', 'nonna', 'nonni', 'nonne',
  'zio', 'zia', 'zii', 'zie',
  'cugino', 'cugina', 'cugini', 'cugine',
  'fratello', 'sorella', 'fratelli', 'sorelle',
  'marito', 'moglie', 'compagno', 'compagna',
  'amico', 'amica', 'amici', 'amiche',
  'vicino', 'vicina', 'vicini',
  'ragazzo', 'ragazza', 'ragazzi', 'ragazze',
  'persona', 'persone', 'gente',
  'bimbo', 'bimba', 'bimbi',
  'neonato', 'neonata',

  // ── Family member names (app-specific) ───────────────────────
  'cristian', 'chiara', 'viola', 'asia', 'mariangela', 'roberto',

  // ── Food & Meals ─────────────────────────────────────────────
  'pasta', 'pizza', 'risotto', 'riso', 'pane', 'panino', 'panini',
  'carne', 'pesce', 'pollo', 'tacchino', 'manzo', 'maiale', 'vitello',
  'insalata', 'verdura', 'verdure', 'frutta',
  'uova', 'uovo', 'latte', 'burro', 'formaggio', 'mozzarella', 'parmigiano',
  'olio', 'aceto', 'sale', 'pepe', 'zucchero', 'farina',
  'marmellata', 'miele', 'nutella',
  'biscotti', 'cereali', 'yogurt', 'succo',
  'acqua', 'vino', 'birra', 'caffè', 'caffe',
  'gelato', 'dolce', 'torta', 'budino', 'cioccolata', 'cioccolato',
  'sugo', 'salsa', 'ragù', 'ragu', 'brodo',
  'lasagna', 'lasagne', 'gnocchi', 'polpette', 'polpetta',
  'frittata', 'arrosto', 'carbonara', 'grigliata',
  'cotoletta', 'cotolette', 'bistecca', 'hamburger',
  'minestra', 'minestrone', 'zuppa',
  'patate', 'patata', 'pomodoro', 'pomodori',
  'carota', 'carote', 'cipolla', 'cipolle',
  'zucchina', 'zucchine', 'melanzana', 'melanzane',
  'peperone', 'peperoni', 'spinaci', 'broccoli',
  'funghi', 'fungo', 'piselli', 'fagioli', 'lenticchie',
  'aglio', 'basilico', 'prezzemolo', 'rosmarino',
  'limone', 'arancia', 'arance', 'banana', 'banane',
  'mela', 'mele', 'pera', 'pere', 'fragola', 'fragole',
  'pesca', 'pesche', 'anguria', 'melone',
  'prosciutto', 'salame', 'mortadella', 'wurstel',
  'tonno', 'salmone', 'gamberetti',
  'pranzo', 'cena', 'colazione', 'merenda', 'spuntino',
  'piatto', 'piatti', 'contorno', 'antipasto', 'primo', 'secondo', 'dolce',
  'ricetta', 'ingredienti', 'ingrediente',
  'sushi', 'kebab',

  // ── Shopping items ───────────────────────────────────────────
  'spesa', 'lista', 'carrello', 'borsa', 'busta', 'sacchetto',
  'detersivo', 'sapone', 'shampoo', 'bagnoschiuma',
  'carta', 'igienica', 'scottex', 'tovaglioli',
  'spugna', 'spugne', 'straccio', 'scopa', 'aspirapolvere',
  'pannolini', 'pannolino', 'salviette',
  'dentifricio', 'spazzolino',
  'crema', 'lozione',
  'sacchetti', 'pellicola', 'alluminio', 'stagnola',
  'candela', 'candele', 'pile', 'batterie', 'lampadina', 'lampadine',
  'cibo', 'alimento', 'alimenti', 'prodotto', 'prodotti',
  'surgelati', 'surgelato', 'scatolette', 'scatoletta',
  'bevanda', 'bevande', 'bibite', 'bibita',

  // ── Household & Cleaning ─────────────────────────────────────
  'casa', 'stanza', 'camera', 'cucina', 'bagno', 'salone', 'salotto',
  'corridoio', 'ingresso', 'giardino', 'balcone', 'terrazzo', 'garage',
  'cantina', 'soffitta', 'scala', 'scale',
  'letto', 'divano', 'tavolo', 'tavola', 'sedia', 'sedie',
  'armadio', 'cassetto', 'scaffale', 'mensola',
  'lavatrice', 'lavastoviglie', 'forno', 'frigo', 'frigorifero',
  'microonde', 'lavandino', 'rubinetto',
  'porta', 'finestra', 'chiave', 'chiavi',
  'pavimento', 'muro', 'tetto', 'parete',
  'luce', 'lampada',
  'vestiti', 'vestito', 'abito', 'abiti', 'maglietta', 'maglia',
  'pantaloni', 'gonna', 'giacca', 'cappotto', 'giubbotto',
  'scarpe', 'scarpa', 'stivali', 'ciabatte', 'sandali',
  'calze', 'calzini', 'mutande', 'biancheria',
  'asciugamano', 'asciugamani', 'lenzuola', 'coperta', 'cuscino',
  'tenda', 'tende', 'tappeto', 'tappeti',
  'piatto', 'piatti', 'bicchiere', 'bicchieri',
  'pentola', 'padella', 'teglia',
  'coltello', 'forchetta', 'cucchiaio', 'posate',
  'cestino', 'pattumiera', 'spazzatura', 'immondizia', 'rifiuti',
  'riciclo', 'differenziata', 'plastica', 'vetro',

  // ── Places & Locations ───────────────────────────────────────
  'supermercato', 'mercato', 'negozio', 'centro', 'commerciale',
  'farmacia', 'ospedale', 'clinica', 'ambulatorio',
  'scuola', 'asilo', 'nido', 'elementare', 'media', 'medie',
  'superiore', 'superiori', 'università', 'liceo',
  'palestra', 'piscina', 'campo', 'stadio', 'parco', 'giardino',
  'chiesa', 'oratorio', 'parrocchia',
  'ufficio', 'lavoro', 'azienda', 'fabbrica',
  'stazione', 'aeroporto', 'porto', 'fermata',
  'banca', 'posta', 'comune', 'municipio',
  'bar', 'ristorante', 'pizzeria', 'gelateria', 'pasticceria',
  'cinema', 'teatro', 'museo', 'biblioteca',
  'hotel', 'albergo', 'pensione',
  'dentista', 'pediatra', 'oculista', 'ortopedico', 'dermatologo',
  'dottore', 'dottoressa', 'medico',
  'veterinario', 'parrucchiere', 'parrucchiera',
  'tabaccaio', 'edicola', 'cartoleria', 'ferramenta',
  'conad', 'coop', 'lidl', 'esselunga', 'eurospin', 'carrefour',
  'ikea', 'brico',
  'strada', 'via', 'piazza', 'corso', 'viale',
  'zona', 'quartiere', 'paese', 'città',

  // ── Medical & Health ─────────────────────────────────────────
  'visita', 'vaccino', 'vaccinazione', 'ecografia', 'analisi', 'esame', 'esami',
  'ricetta', 'medicina', 'medicinale', 'farmaco', 'farmaci',
  'pillola', 'compressa', 'sciroppo', 'pomata', 'antibiotico',
  'febbre', 'tosse', 'raffreddore', 'influenza', 'allergia',
  'mal', 'testa', 'pancia', 'gola', 'dente', 'denti', 'schiena',
  'dolore', 'dolori', 'fastidio',
  'malato', 'malata', 'ammalato', 'ammalata',
  'guarito', 'guarita', 'meglio', 'peggio',
  'salute', 'controllo', 'check', 'ticket',
  'assente', 'assenza',
  'fisioterapia', 'fisioterapista', 'massaggio',
  'operazione', 'intervento', 'pronto', 'soccorso',
  'sangue', 'pressione', 'cuore', 'occhi', 'occhio',

  // ── Sports & Activities ──────────────────────────────────────
  'danza', 'nuoto', 'calcio', 'basket', 'pallacanestro',
  'tennis', 'karate', 'judo', 'atletica', 'ginnastica',
  'pallavolo', 'volley', 'rugby', 'ciclismo', 'equitazione',
  'sci', 'pattinaggio', 'scherma',
  'allenamento', 'gara', 'partita', 'torneo', 'campionato',
  'saggio', 'spettacolo', 'recita', 'concerto',
  'catechismo', 'scout', 'corso',
  'lezione', 'lezioni', 'compiti', 'studio',
  'colloquio', 'pagella', 'gita',
  'interrogazione', 'verifica', 'assemblea',
  'attività', 'attivita', 'evento', 'eventi',
  'compleanno', 'festa', 'cerimonia', 'matrimonio',
  'battesimo', 'comunione', 'cresima',
  'vacanza', 'vacanze', 'ferie',

  // ── Expenses & Money ─────────────────────────────────────────
  'euro', 'soldi', 'denaro', 'contanti', 'carta', 'bancomat',
  'bolletta', 'bollette', 'rata', 'rate', 'mutuo', 'affitto',
  'abbonamento', 'abbonamenti',
  'benzina', 'diesel', 'gasolio', 'autostrada', 'pedaggio',
  'parcheggio', 'taxi', 'meccanico', 'officina',
  'assicurazione', 'bollo', 'revisione',
  'regalo', 'regali',
  'conto', 'scontrino', 'fattura', 'ricevuta',
  'sconto', 'offerta', 'promozione',
  'prezzo', 'costo', 'spesa',
  'risparmio', 'budget',

  // ── Adjectives ───────────────────────────────────────────────
  'nuovo', 'nuova', 'nuovi', 'nuove',
  'vecchio', 'vecchia', 'vecchi', 'vecchie',
  'grande', 'grandi', 'piccolo', 'piccola', 'piccoli', 'piccole',
  'buono', 'buona', 'buoni', 'buone',
  'cattivo', 'cattiva',
  'bello', 'bella', 'belli', 'belle',
  'brutto', 'brutta',
  'alto', 'alta', 'basso', 'bassa',
  'lungo', 'lunga', 'corto', 'corta',
  'largo', 'larga', 'stretto', 'stretta',
  'pieno', 'piena', 'vuoto', 'vuota',
  'aperto', 'aperta', 'chiuso', 'chiusa',
  'caldo', 'calda', 'freddo', 'fredda',
  'bianco', 'bianca', 'nero', 'nera', 'rosso', 'rossa',
  'verde', 'blu', 'giallo', 'gialla',
  'pronto', 'pronta', 'pronti', 'pronte',
  'libero', 'libera', 'occupato', 'occupata',
  'solo', 'sola', 'soli', 'sole',
  'ultimo', 'ultima', 'ultimi', 'ultime',
  'tutto', 'tutta', 'tutti', 'tutte',
  'altro', 'altra', 'altri', 'altre',
  'stesso', 'stessa', 'stessi', 'stesse',
  'ogni', 'qualche', 'nessuno', 'nessuna',
  'molto', 'molta', 'molti', 'molte',
  'poco', 'poca', 'pochi', 'poche',
  'tanto', 'tanta', 'tanti', 'tante',
  'troppo', 'troppa', 'troppi', 'troppe',
  'bravo', 'brava', 'bravi', 'brave',
  'stanco', 'stanca', 'stanchi', 'stanche',
  'malato', 'malata', 'ammalato', 'ammalata',
  'contento', 'contenta', 'felice', 'triste',
  'importante', 'urgente', 'necessario', 'necessaria',
  'possibile', 'impossibile',
  'facile', 'difficile',
  'veloce', 'lento', 'lenta',
  'pesante', 'leggero', 'leggera',
  'sporco', 'sporca', 'sporchi', 'sporche',
  'pulito', 'pulita', 'puliti', 'pulite',

  // ── Adverbs ──────────────────────────────────────────────────
  'bene', 'male', 'meglio', 'peggio',
  'molto', 'poco', 'tanto', 'troppo',
  'più', 'meno', 'abbastanza', 'abbastanza',
  'subito', 'presto', 'tardi', 'dopo', 'prima',
  'qui', 'qua', 'là', 'lì',
  'su', 'giù', 'dentro', 'fuori',
  'davvero', 'veramente', 'proprio', 'forse', 'magari',
  'sempre', 'mai', 'spesso', 'raramente',
  'solo', 'soltanto', 'solamente',
  'insieme', 'separatamente',
  'certamente', 'sicuramente', 'probabilmente',

  // ── Common expressions ───────────────────────────────────────
  'ciao', 'buongiorno', 'buonasera', 'buonanotte', 'salve',
  'grazie', 'prego', 'scusa', 'scusi', 'permesso',
  'perfetto', 'giusto', 'esatto',
  'niente', 'nulla',
  'promemoria', 'memo', 'nota', 'appunto',
  'problema', 'problemi', 'aiuto',
  'tipo', 'roba', 'cosa', 'cose',
  'volta', 'volte', 'parte', 'parti',
  'modo', 'maniera', 'verso',

  // ── Transport ────────────────────────────────────────────────
  'macchina', 'auto', 'automobile', 'moto', 'motorino',
  'bicicletta', 'bici', 'monopattino',
  'treno', 'autobus', 'pullman', 'metro', 'tram',
  'volo', 'aereo', 'nave', 'traghetto',
  'viaggio', 'tragitto', 'percorso',
  'traffico', 'incidente', 'ritardo',
  'patente', 'documenti', 'documento', 'passaporto',
  'biglietto', 'biglietti', 'prenotazione',

  // ── Technology ───────────────────────────────────────────────
  'telefono', 'cellulare', 'smartphone', 'tablet',
  'computer', 'portatile', 'caricatore', 'cavo',
  'internet', 'wifi', 'password',
  'foto', 'video', 'messaggio', 'messaggi',
  'email', 'posta',
  'app', 'applicazione',

  // ── Weather ──────────────────────────────────────────────────
  'tempo', 'pioggia', 'sole', 'vento', 'neve',
  'caldo', 'freddo', 'umido',
  'ombrello', 'giacca',

  // ── Work & School ────────────────────────────────────────────
  'riunione', 'call', 'meeting', 'conferenza', 'webinar',
  'progetto', 'scadenza', 'consegna', 'deadline',
  'quaderno', 'libro', 'libri', 'zaino',
  'matita', 'penna', 'colori', 'gomma', 'righello',
  'foglio', 'fogli', 'cartella',
  'diario', 'agenda', 'calendario',

  // ── Pets ─────────────────────────────────────────────────────
  'cane', 'gatto', 'animale', 'animali',
  'cucciolo', 'veterinario',
  'croccantini', 'crocchette', 'guinzaglio',
  'passeggiata', 'passeggiare',

  // ── Miscellaneous domain words ───────────────────────────────
  'routine', 'turno', 'turni',
  'orario', 'orari', 'programma',
  'regola', 'regole',
  'permesso', 'autorizzazione',
  'iscrizione', 'modulo', 'moduli',
  'certificato', 'certificati', 'attestato',
  'bollino', 'tessera', 'badge',
  'chiave', 'chiavi', 'telecomando',
  'pacco', 'pacchi', 'busta', 'lettera',
  'pianta', 'piante', 'fiore', 'fiori',
  'regalo', 'sorpresa', 'invito', 'inviti',
  'ospite', 'ospiti', 'visita',
  'dormire', 'pigiama', 'party', 'sleepover',
])
