import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/similarity",
        destination: "/pool-stats",
        permanent: true,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "assets.nhle.com",
        pathname: "/logos/**",
      },
      {
        protocol: "https",
        hostname: "assets.nhle.com",
        pathname: "/mugs/**",
      },
    ],
  },
};

export default nextConfig;
