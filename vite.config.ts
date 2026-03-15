import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ─── React Compiler (R4 evaluation) ─────────────────────────────
// React Compiler richiede Babel (non SWC). Per abilitarlo:
//   1. npm install -D @vitejs/plugin-react babel-plugin-react-compiler
//   2. Sostituire '@vitejs/plugin-react-swc' con '@vitejs/plugin-react'
//   3. Decommentare la configurazione sotto e commentare react() in plugins
//
// Trade-off: Babel è ~2-3x più lento di SWC in dev mode (~300ms vs ~100ms HMR).
// React Compiler aggiunge memoizzazione automatica → elimina useMemo/useCallback.
// Per ora manteniamo SWC per dev speed; switch quando React Compiler è stabile.
//
// import reactBabel from '@vitejs/plugin-react'
// const reactCompiler = reactBabel({
//   babel: { plugins: [['babel-plugin-react-compiler', {}]] },
// })

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(), // SWC — fast dev. Sostituire con reactCompiler per auto-memoization
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Fammi Questo',
        short_name: 'Fammi Questo',
        description: "L'app sicura che organizza la tua famiglia con una frase",
        theme_color: '#6C5CE7',
        display: 'standalone',
        start_url: '/',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    // ─── Performance: chunk splitting ────────────────────────────
    // Separa le dipendenze pesanti in chunk dedicati per caching migliore
    // e per evitare di caricare tutto al primo accesso.
    rollupOptions: {
      output: {
        manualChunks: {
          // React core — cambia raramente, cachabile a lungo
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Charting — usato solo in Stats/Budget
          'vendor-charts': ['recharts'],
          // NLP — pesante, usato solo quando il Brain processa input
          'vendor-nlp': ['@nlpjs/core', '@nlpjs/nlp', '@nlpjs/lang-it'],
          // Supabase — usato solo in sync, non serve offline-first
          'vendor-supabase': ['@supabase/supabase-js'],
          // Dexie — core data layer, serve subito
          'vendor-dexie': ['dexie', 'dexie-react-hooks'],
        },
      },
    },
    // Target moderno per bundle più piccolo (Capacitor WebView è Chromium)
    target: 'es2022',
  },
})
