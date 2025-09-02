
import type {NextConfig} from 'next';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import path from 'path';

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
    // We need to copy the Tone.js file to the public folder for the worker
    if (!config.plugins) {
        config.plugins = [];
    }
    
    config.plugins.push(
      new CopyWebpackPlugin({
        patterns: [
          {
            from: path.join(__dirname, 'node_modules/tone/build/Tone.js'),
            to: path.join(__dirname, 'public/assets/vendor/tone/'),
          },
        ],
      })
    );
    
    return config;
  },
};

export default nextConfig;
