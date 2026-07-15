/**
 * Single source of truth for hosts allowed to serve room/subcategory imagery.
 * Consumed by next.config.ts (next/image remotePatterns) and by the admin
 * write path (lib/image-hosts.ts's isAllowedImageUrl) so persisted URLs can
 * never point somewhere next/image would refuse to render — or somewhere
 * scripts/check-images.ts would end up fetching on the server's behalf.
 */
export const ALLOWED_IMAGE_HOSTS = [
  // Sample room imagery.
  "images.unsplash.com",
  "plus.unsplash.com",
  "wyndhamfallsviewhotel.com",
  "image-tc.galaxy.tf",
  "cache.marriott.com",
  "*.ssl.cf1.rackcdn.com",
  "cdn.odehotels.com",
  "cms.inspirato.com",
  "media-cdn.tripadvisor.com",
  // UploadThing-hosted room images.
  "utfs.io",
  "*.ufs.sh",
] as const

function isAllowedImageHost(hostname: string): boolean {
  return ALLOWED_IMAGE_HOSTS.some((pattern) =>
    pattern.startsWith("*.")
      ? hostname.endsWith(pattern.slice(1))
      : hostname === pattern,
  )
}

export function isAllowedImageUrl(url: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  return parsed.protocol === "https:" && isAllowedImageHost(parsed.hostname)
}
