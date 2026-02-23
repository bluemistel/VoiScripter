/** @type {import('next').NextConfig} */
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
    NEXT_PUBLIC_SYNC_API_URL: process.env.NEXT_PUBLIC_SYNC_API_URL ||
      (process.env.NODE_ENV === 'development'
        ? 'http://localhost:8787/data'
        : 'https://voiscripter-sync.bluemist02.workers.dev/data'),
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