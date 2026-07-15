import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Emit a standalone build so the Docker image can run without node_modules.
  output: "standalone",
  images: {
    remotePatterns: [
      // Sample room imagery.
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "plus.unsplash.com" },
      { protocol: "https", hostname: "wyndhamfallsviewhotel.com" },
      { protocol: "https", hostname: "image-tc.galaxy.tf" },
      { protocol: "https", hostname: "cache.marriott.com" },
      { protocol: "https", hostname: "*.ssl.cf1.rackcdn.com" },
      { protocol: "https", hostname: "cdn.odehotels.com" },
      { protocol: "https", hostname: "cms.inspirato.com" },
      { protocol: "https", hostname: "media-cdn.tripadvisor.com" },
      // UploadThing-hosted room images.
      { protocol: "https", hostname: "utfs.io" },
      { protocol: "https", hostname: "*.ufs.sh" },
    ],
  },
}

export default nextConfig
