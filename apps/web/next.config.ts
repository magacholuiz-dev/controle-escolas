import type { NextConfig } from 'next';

// The browser only ever talks to this origin: /api/* is proxied to the API, so the session cookie is
// first-party (a cross-site cookie is dropped by Safari and stricter Chrome — that was a production bug).
// NOTE: `rewrites()` is evaluated at build time, so API_URL must be set when running `next build`.
const API_URL = process.env.API_URL ?? 'http://127.0.0.1:3200';

const config: NextConfig = {
  reactStrictMode: true,
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  transpilePackages: ['@controle-escolas/contracts'],
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_URL}/api/:path*` }];
  },
};

export default config;
