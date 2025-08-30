
import type {NextConfig} from 'next';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import path from 'path';

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
  webpack: (config, { isServer, dev }) => {
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
    // Important: return the modified config
    return config;
  },
  allowedDevOrigins: [
    'https://*.cloudworkstations.dev',
    'https://*.firebase.studio',
  ],
};

export default nextConfig;
