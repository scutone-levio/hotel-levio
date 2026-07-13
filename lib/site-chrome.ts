import type { CSSProperties } from "react"

/** Shared header/footer chrome (navy band + gold border). */
export const siteHeaderClassName = "border-b border-[#c69456]/20 bg-[#081a27]"
export const siteFooterClassName = "border-t border-[#c69456]/20 bg-[#081a27]"

/** Uppercase nav links on the dark chrome band. */
export const siteNavLinkClassName =
  "border-b border-transparent pb-0.5 text-[0.74rem] tracking-[0.14em] text-[#f3ecda]/80 uppercase transition-colors hover:border-[#c69456] hover:text-[#f3ecda]"

/** Matching styles for header nav buttons (e.g. Sign out). */
export const siteNavActionClassName = siteNavLinkClassName

/** Cart icon theme when rendered on the navy header. */
export const cartIconTheme = {
  "--foreground": "#f3ecda",
  "--muted": "rgba(198, 148, 86, 0.16)",
  "--primary": "#c69456",
  "--primary-foreground": "#081a27",
} as CSSProperties
