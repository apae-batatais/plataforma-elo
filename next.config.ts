import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // A biblioteca do Google roda só no servidor (camada de aplicação).
  serverExternalPackages: ['google-auth-library'],
};

export default nextConfig;
