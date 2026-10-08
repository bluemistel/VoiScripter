const { PHASE_DEVELOPMENT_SERVER } = require('next/constants');

/** @type {import('next').NextConfig} */
const syncEnv = process.env.NEXT_PUBLIC_SYNC_ENV ||
  (process.env.NODE_ENV === 'development' ? 'dev' : 'prd');
const syncApiUrlDev = process.env.NEXT_PUBLIC_SYNC_API_URL_DEV || 'http://localhost:8787/data';
const syncApiUrlPrd = process.env.NEXT_PUBLIC_SYNC_API_URL_PRD || 'https://voiscripter-sync-prd.bluemist02.workers.dev/data';
const syncApiUrl = process.env.NEXT_PUBLIC_SYNC_API_URL ||
  (syncEnv === 'dev' ? syncApiUrlDev : syncApiUrlPrd);
const syncApiOrigin = process.env.NEXT_PUBLIC_SYNC_API_ORIGIN || new URL(syncApiUrl).origin;

const createNextConfig = (phase) => ({
  reactStrictMode: true,
  output: 'export',
  trailingSlash: false,
  // 本番ビルドは Electron が file:// で読み込むため相対パスにする。
  // 開発サーバーでは付けない（Next.js 16.4 以降、'./' だと開発用 WebSocket の待ち受けパスが
  // '/./_next/hmr' になってブラウザの接続先 '/_next/hmr' と食い違い、画面が「読み込み中」のまま止まる）
  assetPrefix: phase === PHASE_DEVELOPMENT_SERVER ? undefined : './',
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
});

module.exports = createNextConfig; 