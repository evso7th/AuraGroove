import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
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
   webpack(config, { isServer }) {
    // For web workers
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        "buffer": require.resolve('buffer/'),
        "events": require.resolve('events/'),
        "stream": require.resolve('stream-browserify'),
        "util": require.resolve('util/'),
      };
    }
    
    config.module.rules.push({
      test: /\.worker\.ts$/,
      loader: 'worker-loader',
      options: {
        filename: 'static/chunks/[name].[contenthash].js',
        publicPath: '/_next/',
      },
    });

    return config;
  },
};

export default nextConfig;

    