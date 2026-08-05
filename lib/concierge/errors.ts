export function formatConciergeStreamError(error: unknown): string {
  let message = "Unknown error"
  if (error instanceof Error) {
    message = error.message
  } else if (typeof error === "string") {
    message = error
  }

  if (/quota|insufficient_quota|billing|resource_exhausted|rate limit/i.test(message)) {
    return "The LLM API quota or rate limit was exceeded. Try again later or switch LLM_PROVIDER in .env."
  }

  if (/invalid_api_key|incorrect api key|authentication|api key not valid/i.test(message)) {
    return "Invalid LLM API key. Check your provider key in .env and restart the dev server."
  }

  return "The concierge could not complete your request. Please try again."
}

export function formatChatClientError(error: Error | undefined): string | null {
  if (!error?.message) return null

  const message = error.message.trim()
  if (!message) return null

  if (message.includes("<!DOCTYPE") || message.includes("<html")) {
    return "Could not reach the concierge service. Please refresh and try again."
  }

  if (/quota|insufficient_quota|billing|resource_exhausted|rate limit/i.test(message)) {
    return "The LLM API quota or rate limit was exceeded. Try again later or switch LLM_PROVIDER in .env."
  }

  if (message.length > 240) {
    return `${message.slice(0, 240)}…`
  }

  return message
}
