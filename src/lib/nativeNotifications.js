/**
 * Native Local Notifications — bridge tra il sistema in-app e le notifiche OS.
 *
 * Usa @capacitor/local-notifications per mostrare notifiche native Android/iOS
 * quando l'app è in background o il dispositivo è bloccato.
 *
 * Strategia:
 * - Le notifiche in-app (Dexie) restano il sistema primario
 * - Questo modulo aggiunge il layer nativo: quando viene creata una notifica
 *   in-app, opzionalmente si schedula anche la notifica OS
 * - Su web (browser), degrada silenziosamente (noop)
 *
 * NOTA: richiede `npm install @capacitor/local-notifications` + `npx cap sync`
 */

let LocalNotifications = null
let isNativeAvailable = false

/**
 * Inizializza il plugin. Chiamare una volta all'avvio dell'app (es. in App.jsx).
 * Non lancia errori se il plugin non è installato o siamo su web.
 */
export async function initNativeNotifications() {
  try {
    const mod = await import('@capacitor/local-notifications')
    LocalNotifications = mod.LocalNotifications

    // Verifica permessi
    const perm = await LocalNotifications.checkPermissions()
    if (perm.display === 'prompt' || perm.display === 'prompt-with-rationale') {
      const req = await LocalNotifications.requestPermissions()
      isNativeAvailable = req.display === 'granted'
    } else {
      isNativeAvailable = perm.display === 'granted'
    }

    if (isNativeAvailable) {
      // Crea il canale Android per le notifiche famiglia
      try {
        await LocalNotifications.createChannel({
          id: 'family-default',
          name: 'Fammi Questo',
          description: 'Notifiche attività, eventi e spesa',
          importance: 4, // HIGH
          visibility: 1, // PUBLIC
          vibration: true,
        })
      } catch {
        // createChannel non supportato su iOS/web — ok
      }

      console.log('[NativeNotif] Inizializzato, permessi granted')
    } else {
      console.log('[NativeNotif] Permessi non concessi')
    }
  } catch {
    // Plugin non installato o siamo su web — degrada silenziosamente
    console.log('[NativeNotif] Plugin non disponibile (web o non installato)')
    isNativeAvailable = false
  }
}

/**
 * Mostra una notifica nativa immediata.
 *
 * @param {{ title: string, body: string, id?: number, extra?: object }} opts
 */
export async function showNativeNotification({ title, body, id, extra }) {
  if (!isNativeAvailable || !LocalNotifications) return

  try {
    await LocalNotifications.schedule({
      notifications: [{
        title,
        body,
        id: id || Date.now() % 2147483647, // int32 range per Android
        channelId: 'family-default',
        smallIcon: 'ic_notification', // deve esistere in android/res/drawable
        largeIcon: 'ic_launcher',
        extra: extra || {},
      }],
    })
  } catch (err) {
    console.warn('[NativeNotif] Errore schedule:', err)
  }
}

/**
 * Schedula una notifica nativa per una data/ora futura.
 * Utile per reminder di eventi calendario o scadenze task.
 *
 * @param {{ title: string, body: string, at: Date, id?: number, extra?: object }} opts
 */
export async function scheduleNativeNotification({ title, body, at, id, extra }) {
  if (!isNativeAvailable || !LocalNotifications) return

  // Non schedulare nel passato
  if (at.getTime() <= Date.now()) return

  try {
    await LocalNotifications.schedule({
      notifications: [{
        title,
        body,
        id: id || Date.now() % 2147483647,
        channelId: 'family-default',
        schedule: { at },
        smallIcon: 'ic_notification',
        largeIcon: 'ic_launcher',
        extra: extra || {},
      }],
    })
  } catch (err) {
    console.warn('[NativeNotif] Errore schedule futuro:', err)
  }
}

/**
 * Cancella una notifica schedulata per id.
 * @param {number} notifId
 */
export async function cancelNativeNotification(notifId) {
  if (!isNativeAvailable || !LocalNotifications) return
  try {
    await LocalNotifications.cancel({ notifications: [{ id: notifId }] })
  } catch (err) {
    console.warn('[NativeNotif] Errore cancel:', err)
  }
}

/**
 * Cancella tutte le notifiche pending.
 */
export async function cancelAllNativeNotifications() {
  if (!isNativeAvailable || !LocalNotifications) return
  try {
    const pending = await LocalNotifications.getPending()
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel(pending)
    }
  } catch (err) {
    console.warn('[NativeNotif] Errore cancelAll:', err)
  }
}

/**
 * Registra un listener per tap su notifica (deep-link nell'app).
 * @param {(notification: object) => void} callback
 */
export function onNativeNotificationTap(callback) {
  if (!isNativeAvailable || !LocalNotifications) return () => {}

  const listener = LocalNotifications.addListener(
    'localNotificationActionPerformed',
    (event) => {
      callback(event.notification)
    }
  )

  // Ritorna la funzione di cleanup
  return () => listener.then(l => l.remove())
}

/**
 * Helper: è disponibile il sistema nativo?
 */
export function isNativeNotifAvailable() {
  return isNativeAvailable
}
