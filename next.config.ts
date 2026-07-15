import type { NextConfig } from "next"

import { ALLOWED_IMAGE_HOSTS } from "./lib/image-hosts"

const nextConfig: NextConfig = {
  // Emit a standalone build so the Docker image can run without node_modules.
  output: "standalone",
  images: {
    remotePatterns: ALLOWED_IMAGE_HOSTS.map((hostname) => ({
      protocol: "https" as const,
      hostname,
    })),
  },
}

export default nextConfig
