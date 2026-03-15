#!/bin/bash
# ============================================
# Fammi Questo — Setup piattaforma iOS
# Esegui questo script UNA SOLA VOLTA
# ============================================

set -e

echo "🍎 Aggiungendo piattaforma iOS a Capacitor..."

# 1. Installa il pacchetto iOS di Capacitor
npm install @capacitor/ios@^8.2.0

# 2. Aggiungi la piattaforma iOS
npx cap add ios

# 3. Build del web
echo "📦 Building web assets..."
npm run build

# 4. Sync con iOS
echo "🔄 Syncing con iOS..."
npx cap sync ios

echo ""
echo "✅ Piattaforma iOS aggiunta con successo!"
echo ""
echo "Prossimi passi:"
echo "  - Su macOS: npx cap open ios  (apre Xcode)"
echo "  - Su qualsiasi OS: git push → GitHub Actions farà il build"
echo ""
