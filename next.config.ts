import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Emit a standalone build so the Docker image can run without node_modules.
  output: "standalone",
  images: {
    remotePatterns: [
      // Sample room imagery.
      { protocol: "https", hostname: "images.unsplash.com" },
      // UploadThing-hosted room images.
      { protocol: "https", hostname: "utfs.io" },
      { protocol: "https", hostname: "*.ufs.sh" },
    ],
  },
}

export default nextConfig
