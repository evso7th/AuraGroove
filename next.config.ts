
import type {NextConfig} from 'next';
const CopyWebpackPlugin = require('copy-webpack-plugin');
const path = require('path');

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  webpack: (config, { isServer }) => {
    config.plugins.push(
        new CopyWebpackPlugin({
            patterns: [
                {
                    from: path.join(__dirname, 'src/lib/synth.worklet.ts'),
                    to: path.join(__dirname, 'public/workers/synth.worklet.js'),
                },
            ],
        })
    );
    return config;
  },
  async headers() {
    return [
      {
        source: '/assets/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
        ],
      },
    ]
  },
  allowedDevOrigins: [
    'https://*.cloudworkstations.dev',
    'https://*.firebase.studio',
    'https://6000-firebase-studio-1754718606110.cluster-3gc7bglotjgwuxlqpiut7yyqt4.cloudworkstations.dev',
    'https://9000-firebase-studio-1754718606110.cluster-3gc7bglotjgwuxlqpiut7yyqt4.cloudworkstations.dev',
  ],
};

export default nextConfig;
