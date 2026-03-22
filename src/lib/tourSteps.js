/**
 * tourSteps.js — Step definitions for the guided spotlight tour.
 * Each step targets an element with data-tour="<target>" attribute.
 */

export function getDashboardTourSteps() {
  return [
    {
      target: 'greeting-card',
      title: 'Benvenuto! 👋',
      body: 'Questa è la tua Home. Qui vedi il saluto, la data e un riepilogo rapido della giornata.',
      placement: 'bottom',
    },
    {
      target: 'brain-input',
      title: 'Il Cervellone 🧠',
      body: 'Scrivi comandi in linguaggio naturale! Prova: "Ho speso 5€ al bar" oppure "Domani dentista alle 10".',
      placement: 'bottom',
    },
    {
      target: 'events-today',
      title: 'Eventi di oggi 📅',
      body: 'Qui vedi gli impegni della giornata: sport, scuola, visite mediche e tutto il resto.',
      placement: 'top',
    },
    {
      target: 'tasks-today',
      title: 'Task da fare ✅',
      body: 'I compiti assegnati ai membri della famiglia. Puoi completarli con un tap!',
      placement: 'top',
    },
    {
      target: 'nav-bar',
      title: 'Navigazione 🧭',
      body: 'Usa la barra in basso per esplorare: Calendario, Task, Dispensa, Spese e altro.',
      placement: 'top',
    },
  ]
}
