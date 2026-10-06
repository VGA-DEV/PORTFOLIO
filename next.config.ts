import type { NextConfig } from 'next';

// Static export: the host only serves static files (see CLAUDE.md, section 4).
const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
