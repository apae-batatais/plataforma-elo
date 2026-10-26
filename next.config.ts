import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // O banco local embutido (PGlite) carrega arquivos próprios; não deve ser empacotado.
  serverExternalPackages: ['@electric-sql/pglite'],
};

export default nextConfig;
