import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The app's real tests run inside the platform, and a UI journey drives a real browser client against a real
    // server — seconds each, not milliseconds. The default 5s timeout would fail a passing app.
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
