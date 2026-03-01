/** @type {import('next').NextConfig} */
const syncEnv = process.env.NEXT_PUBLIC_SYNC_ENV ||
  (process.env.NODE_ENV === 'development' ? 'dev' : 'prd');
const syncApiUrlDev = process.env.NEXT_PUBLIC_SYNC_API_URL_DEV || 'http://localhost:8787/data';
const syncApiUrlPrd = process.env.NEXT_PUBLIC_SYNC_API_URL_PRD || 'https://voiscripter-sync-prd.bluemist02.workers.dev/data';
const syncApiUrl = process.env.NEXT_PUBLIC_SYNC_API_URL ||
  (syncEnv === 'dev' ? syncApiUrlDev : syncApiUrlPrd);
const syncApiOrigin = process.env.NEXT_PUBLIC_SYNC_API_ORIGIN || new URL(syncApiUrl).origin;

const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  trailingSlash: false,
  assetPrefix: './',
  basePath: '',
  images: {
    unoptimized: true
  },
  env: {
    NEXT_PUBLIC_SYNC_ENV: syncEnv,
    NEXT_PUBLIC_SYNC_API_URL_DEV: syncApiUrlDev,
    NEXT_PUBLIC_SYNC_API_URL_PRD: syncApiUrlPrd,
    NEXT_PUBLIC_SYNC_API_URL: syncApiUrl,
    NEXT_PUBLIC_SYNC_API_ORIGIN: syncApiOrigin,
  },
  // React DevToolsのメッセージを非表示にする
  webpack: (config, { dev, isServer }) => {
    if (!dev && !isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
    }
    return config;
  },
  // Turbopack設定（Next.js 16でTurbopackがデフォルトのため追加）
  turbopack: {},
};

module.exports = nextConfig; 