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