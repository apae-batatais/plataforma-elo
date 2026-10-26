import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // O banco embutido (PGlite) carrega arquivos próprios; não deve ser empacotado.
  serverExternalPackages: ['@electric-sql/pglite'],
  // Garante que os arquivos do PGlite acompanhem o servidor na hospedagem
  // (necessários no modo demonstração).
  outputFileTracingIncludes: {
    '/**': ['./node_modules/@electric-sql/pglite/dist/*.wasm', './node_modules/@electric-sql/pglite/dist/*.data'],
  },
  // Gera também uma versão autônoma do servidor, usada no teste de empacotamento.
  output: process.env.SAIDA_AUTONOMA === '1' ? 'standalone' : undefined,
};

export default nextConfig;
