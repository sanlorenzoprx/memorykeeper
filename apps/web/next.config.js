const { i18n } = require('./next-i18next.config.js');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  i18n,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN || 'your-r2-domain.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

module.exports = nextConfig;