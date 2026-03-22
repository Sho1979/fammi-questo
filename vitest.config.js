import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react-swc'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  test: {
    setupFiles: ['./vitest.setup.js'],
    environment: 'node',
    include: ['src/**/*.test.{js,jsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary'],
      // 60% is the initial bridge threshold — target: 80% by Q3 2026
      thresholds: {
        lines: 60,
      },
      exclude: [
        'node_modules/**',
        'e2e/**',
        'dist/**',
        '**/*.test.{js,jsx}',
        'src/lib/brain/stressTest.js',
        'src/lib/brain/testBatch.js',
        'src/lib/brain/testMemory.js',
        // Platform/integration files — require native APIs, not unit-testable
        'src/lib/platform.js',
        'src/lib/supabase.js',
        'src/lib/sync.js',
        'src/lib/notifications.js',
        'src/hooks/useNotifications.js',
        'src/lib/brain/debugLogger.js',
        'src/lib/brain/conversationMemory.js',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
})
