import { execSync } from 'node:child_process';
import type { NextConfig } from 'next';
import pacote from './package.json' with { type: 'json' };

/** Início do código da publicação (commit), para mostrar no rodapé junto da versão. */
function commitAtual(): string {
  const doAmbiente = process.env.GITHUB_SHA ?? process.env.COMMIT_REF;
  if (doAmbiente) return doAmbiente.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
}

const nextConfig: NextConfig = {
  // Bibliotecas que rodam só no servidor (camada de aplicação).
  serverExternalPackages: ['google-auth-library', 'exceljs'],
  experimental: {
    // Importação da planilha da folha (.xlsx) pelo navegador.
    serverActions: { bodySizeLimit: '5mb' },
  },
  env: {
    NEXT_PUBLIC_VERSAO: pacote.version,
    NEXT_PUBLIC_COMMIT: commitAtual(),
  },
};

export default nextConfig;
