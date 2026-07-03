import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Match the app build's automatic JSX runtime so component .jsx files (which
  // don't import React) transform correctly under vitest — which does NOT load
  // vite.config.js's @vitejs/plugin-react. No-op for the JSX-less logic tests.
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/__tests__/**/*.test.{js,jsx}'],
  },
})
