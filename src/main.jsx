/**
 * STEP 6.6 — Entry point.
 *
 * Aggiunge classi platform al <html> per CSS condizionale:
 *   plt-ios, plt-android, plt-web, plt-native
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { platform, isNative } from './lib/platform.js'
import './index.css'
import App from './App.jsx'

// Applica classi piattaforma all'elemento <html>
// Usate dal CSS per regole condizionali (safe area, touch feedback, ecc.)
const html = document.documentElement
html.classList.add(`plt-${platform}`)
if (isNative) html.classList.add('plt-native')

// iOS: imposta viewport-fit=cover per safe areas
if (platform === 'ios') {
  const viewport = document.querySelector('meta[name="viewport"]')
  if (viewport && !viewport.content.includes('viewport-fit=cover')) {
    viewport.content += ', viewport-fit=cover'
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
