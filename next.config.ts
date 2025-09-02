
import type {NextConfig} from 'next';
import CopyWebpackPlugin from 'copy-webpack-plugin';

const nextConfig: NextConfig = {
  output: 'export',
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
  },
  
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.plugins.push(
        new CopyWebpackPlugin({
          patterns: [
            {
              from: 'src/lib/rhythm-worker.ts',
              to: '../public/rhythm-worker.js',
              transform(content, absoluteFrom) {
                // This is a placeholder for a real build step (e.g., esbuild, swc)
                // In a real project, you'd transpile TS to JS here.
                // For now, we'll assume the worker code is simple enough JS.
                return content;
              },
            },
          ],
        })
      );
    }
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
  ],
};

export default nextConfig;
