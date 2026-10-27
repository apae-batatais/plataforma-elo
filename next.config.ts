import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Bibliotecas que rodam só no servidor (camada de aplicação).
  serverExternalPackages: ['google-auth-library', 'exceljs'],
  experimental: {
    // Importação da planilha da folha (.xlsx) pelo navegador.
    serverActions: { bodySizeLimit: '5mb' },
  },
};

export default nextConfig;
