import { defineConfig } from 'vitest/config';
import { orbisOffline } from './scripts/offline-plugin';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte(), orbisOffline()],
  test: { include: ['tests/unit/**/*.test.ts'] },
});
