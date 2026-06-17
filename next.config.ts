import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['ffmpeg-static', 'sharp'],
};

export default nextConfig;
