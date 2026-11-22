import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  // Permite testar módulos .tsx (ex.: assuntos da Ajuda) sem a transformação do Next.
  oxc: { jsx: { runtime: 'automatic' } },
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
