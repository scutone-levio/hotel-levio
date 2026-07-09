import type { ReactNode } from "react"

import { CheckCircle } from "lucide-react"

type ConfirmationHeaderProps = {
  eyebrow: string
  title: string
  description: ReactNode
  icon?: ReactNode
  children?: ReactNode
}

export function ConfirmationHeader(props: Readonly<ConfirmationHeaderProps>) {
  const {
    eyebrow,
    title,
    description,
    icon = <CheckCircle className="text-primary size-14" />,
    children,
  } = props

  return (
    <div className="mb-10 text-center">
      <div className="mb-4 flex justify-center">{icon}</div>
      <span className="text-primary mb-2 block text-[0.72rem] tracking-[0.24em] uppercase">
        {eyebrow}
      </span>
      <h1 className="text-primary-foreground text-3xl tracking-tight">
        {title}
      </h1>
      <p className="text-primary-foreground/55 mt-2">{description}</p>
      {children}
    </div>
  )
}
