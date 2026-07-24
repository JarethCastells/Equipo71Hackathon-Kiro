import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Excluir pruebas del backend (tienen su propio vitest.config.ts en /server)
    exclude: ['server/**', '**/node_modules/**', '**/dist/**'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
