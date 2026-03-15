# Push Notifications — Setup

## 1. Installa il plugin Capacitor

```bash
npm install @capacitor/local-notifications
npx cap sync android
```

## 2. Permessi Android (AndroidManifest.xml)

Aggiungi in `android/app/src/main/AndroidManifest.xml` dentro `<manifest>`:

```xml
<!-- Local Notifications -->
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
```

## 3. Icona notifica (opzionale ma consigliato)

Crea un file `ic_notification.png` (bianco su trasparente, 24x24dp) e mettilo in:
`android/app/src/main/res/drawable/ic_notification.png`

Senza questa icona, Android userà l'icona app di default.

## 4. Verifica

- Build: `npm run cap:sync`
- Apri Android Studio: `npx cap open android`
- Run su device o emulatore
- Crea un evento con orario → dovresti ricevere notifica nativa 30 min prima
- Crea un task con scadenza → dovresti ricevere notifica nativa alle 8:00 del giorno

## Architettura

```
useNotifications.js (in-app Dexie)
       │
       ├─→ showNativeNotification()     ← notifica immediata quando notify() è chiamato
       │
useCalendar.js / useTasks.js
       │
       └─→ scheduleEventReminder()      ← 30 min prima evento
           scheduleTaskReminder()        ← alle 8:00 del giorno scadenza
           cancelEventReminder()         ← quando evento eliminato
           cancelTaskReminder()          ← quando task eliminato

nativeNotifications.js                   ← bridge Capacitor (noop su web)
notificationScheduler.js                 ← logica di scheduling
```

## Note

- Su web browser il sistema degrada silenziosamente (noop).
- Il channel `family-default` è configurato con importanza HIGH e vibrazione.
- L'init avviene in App.jsx al mount, richiede permessi automaticamente.
- I reminder usano un hash deterministico dell'UUID come notification ID, così update/cancel funzionano correttamente.
