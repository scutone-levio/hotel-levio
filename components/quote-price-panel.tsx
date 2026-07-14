import { formatPrice } from "@/lib/rooms"
import { pluralize } from "@/lib/utils"

type Quote = {
  nights: number
  total: number
}

type QuotePricePanelProps = {
  quotePending: boolean
  quoteError: string | null
  quote: Quote | null
  emptyMessage?: string
  className?: string
  pendingClassName?: string
  errorClassName?: string
  emptyClassName?: string
}

export function QuotePricePanel({
  quotePending,
  quoteError,
  quote,
  emptyMessage,
  className = "rounded-lg border p-3 text-sm",
  pendingClassName = "text-muted-foreground",
  errorClassName = "text-destructive",
  emptyClassName = "text-muted-foreground",
}: QuotePricePanelProps) {
  function renderMessage(
    message: string,
    messageClassName: string,
    wrapperClassName: string,
  ) {
    return (
      <div className={wrapperClassName}>
        <div className="space-y-1">
          <p className={messageClassName}>{message}</p>
        </div>
      </div>
    )
  }

  if (quotePending) {
    return renderMessage("Calculating price…", pendingClassName, className)
  }

  if (quoteError) {
    return renderMessage(quoteError, errorClassName, className)
  }

  if (!quote || quote.nights <= 0) {
    return emptyMessage
      ? renderMessage(emptyMessage, emptyClassName, className)
      : null
  }

  const nightLabel = pluralize(quote.nights, "night")

  return (
    <div className={className}>
      <div className="space-y-1">
        <div className="flex justify-between">
          <span className="text-muted-foreground">
            {quote.nights} {nightLabel}
          </span>
          <span>{formatPrice(quote.total, "CAD")}</span>
        </div>
        <div className="flex justify-between font-semibold">
          <span>Total</span>
          <span>{formatPrice(quote.total, "CAD")}</span>
        </div>
      </div>
    </div>
  )
}
