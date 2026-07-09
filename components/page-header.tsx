import type { ReactNode } from "react"

export function PageHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string
  title: ReactNode
  subtitle?: ReactNode
}) {
  return (
    <div className="mb-8">
      {eyebrow && (
        <span className="mb-2 block text-[0.72rem] tracking-[0.24em] text-primary uppercase">
          {eyebrow}
        </span>
      )}
      <h1 className="text-[1.9rem] text-primary-foreground sm:text-[2.4rem]">{title}</h1>
      {subtitle && <p className="mt-2 text-primary-foreground/55">{subtitle}</p>}
    </div>
  )
}
