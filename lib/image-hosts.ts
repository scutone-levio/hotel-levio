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

// Matches next.config.ts remotePatterns semantics: "*." matches exactly one
// additional hostname label, not an arbitrary number of subdomain levels.
function isAllowedImageHost(hostname: string): boolean {
  return ALLOWED_IMAGE_HOSTS.some((pattern) => {
    if (!pattern.startsWith("*.")) return hostname === pattern
    const suffix = pattern.slice(1)
    if (!hostname.endsWith(suffix)) return false
    const prefix = hostname.slice(0, hostname.length - suffix.length)
    return prefix.length > 0 && !prefix.includes(".")
  })
}

export function isAllowedImageUrl(url: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (parsed.username || parsed.password) return false
  return parsed.protocol === "https:" && isAllowedImageHost(parsed.hostname)
}
