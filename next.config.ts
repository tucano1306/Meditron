import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Optimizaciones de rendimiento
  compress: true,
  poweredByHeader: false,
  
  // Optimizar imports de paquetes grandes
  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns'],
  },
  
  // Headers de cache para assets estáticos
  async headers() {
    return [
      {
        source: '/:all*(svg|jpg|png|webp|ico)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
