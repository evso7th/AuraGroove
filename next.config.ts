
import type {NextConfig} from 'next';

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
  allowedDevOrigins: [
    'https://*.cloudworkstations.dev',
    'https://*.firebase.studio',
    'https://6000-firebase-studio-1754718606110.cluster-3gc7bglotjgwuxlqpiut7yyqt4.cloudworkstations.dev',
    'https://9000-firebase-studio-1754718606110.cluster-3gc7bglotjgwuxlqpiut7yyqt4.cloudworkstations.dev',
  ],
};

export default nextConfig;
