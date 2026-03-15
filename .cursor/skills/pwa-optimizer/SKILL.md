# PWA Optimizer — Fammi Questo

## Description
Configura e ottimizza le funzionalità Progressive Web App per Fammi Questo: Service Worker, manifest, offline support, installabilità, e performance.

## When to Use
Usa quando devi: configurare il Service Worker, aggiungere supporto offline, ottimizzare performance PWA, configurare manifest.json, gestire caching strategies. Trigger: "PWA", "service worker", "offline", "installabile", "manifest".

## Instructions

### Service Worker Strategy
Fammi Questo usa una strategia **Cache-First** per asset statici e **Network-First** per dati:
- **Cache-First**: CSS, JS, immagini, font (Workbox `CacheFirst`)
- **Network-First**: API calls a Supabase (Workbox `NetworkFirst`)
- **Stale-While-Revalidate**: Pagine HTML (Workbox `StaleWhileRevalidate`)

### Manifest.json Template
```json
{
  "name": "Fammi Questo",
  "short_name": "FammiQuesto",
  "description": "Gestisci spese, calendario e attività della tua famiglia",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#f9fafb",
  "theme_color": "#2563eb",
  "orientation": "portrait-primary",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "categories": ["finance", "productivity"]
}
```

### Vite PWA Plugin Config
```typescript
// vite.config.ts
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt'],
      manifest: { /* come sopra */ },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'supabase-cache', expiration: { maxEntries: 50 } }
          }
        ]
      }
    })
  ]
});
```

### Performance Checklist
- [ ] Lighthouse PWA score >= 90
- [ ] First Contentful Paint < 1.5s
- [ ] Time to Interactive < 3s
- [ ] Bundle size < 200KB gzipped (senza vendor)
- [ ] Offline mode funzionante (tutte le feature locali)
- [ ] Install prompt su Android e iOS
