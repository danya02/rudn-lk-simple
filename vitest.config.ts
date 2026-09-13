import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Unit tests for the plain-TypeScript helpers under src/utils and src/api.
 *
 * Deliberately not wired into Quasar: these tests cover pure functions, so they
 * need neither a Vue renderer nor a browser. Testing components would mean
 * pulling in @quasar/quasar-app-extension-testing-unit-vitest, which is a much
 * larger commitment than anything here currently earns.
 */
export default defineConfig({
  resolve: {
    // Matches the `src/...` import alias the app code uses, so tests can import
    // modules by the same specifier the source does.
    alias: {
      src: fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
