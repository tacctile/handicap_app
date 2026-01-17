import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    // Environment for component tests
    environment: 'jsdom',

    // Setup files for testing-library matchers
    setupFiles: ['./src/__tests__/setup.ts'],

    // Pass environment variables to test environment
    // Use process.env directly for CI compatibility
    env: {
      VITE_GEMINI_API_KEY: process.env.VITE_GEMINI_API_KEY || '',
    },

    // Enable globals for cleaner test syntax
    globals: true,

    // Include patterns
    include: ['src/**/*.{test,spec}.{ts,tsx}'],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'json', 'html'],
      reportsDirectory: './coverage',
      include: [
        'src/lib/scoring/**/*.ts',
        'src/lib/drfParser.ts',
        'src/lib/betting/**/*.ts',
      ],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        'src/__tests__/**',
      ],
      thresholds: {
        // Global thresholds
        statements: 75,
        branches: 65,
        functions: 80,
        lines: 75,
      },
    },

    // Test timeout (2 min for AI tests that make external API calls)
    testTimeout: 120000,

    // Clear mocks between tests
    clearMocks: true,

    // Don't watch by default in CI
    watch: false,
  },

  // Path aliases matching any potential vite config
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
