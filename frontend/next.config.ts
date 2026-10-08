import type { NextConfig } from 'next';
const api = process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:5080';
const config: NextConfig = {
  output: 'standalone',
  async rewrites() { return [{ source: '/api/:path*', destination: `${api}/api/:path*` }]; },
};
export default config;
