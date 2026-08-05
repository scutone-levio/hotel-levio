export type ConciergeLlmProvider = "google" | "groq" | "openai" | "anthropic"

export const CONCIERGE_PROVIDER_CONFIG = {
  google: {
    label: "Google Gemini",
    apiKeyEnv: "GOOGLE_GENERATIVE_AI_API_KEY",
    defaultModel: "gemini-3-flash-preview",
    signupUrl: "https://aistudio.google.com/apikey",
  },
  groq: {
    label: "Groq",
    apiKeyEnv: "GROQ_API_KEY",
    defaultModel: "llama-3.3-70b-versatile",
    signupUrl: "https://console.groq.com/keys",
  },
  openai: {
    label: "OpenAI",
    apiKeyEnv: "OPENAI_API_KEY",
    defaultModel: "gpt-4o-mini",
    signupUrl: "https://platform.openai.com/api-keys",
  },
  anthropic: {
    label: "Anthropic",
    apiKeyEnv: "ANTHROPIC_API_KEY",
    defaultModel: "claude-haiku-4-5",
    signupUrl: "https://console.anthropic.com/settings/keys",
  },
} as const satisfies Record<
  ConciergeLlmProvider,
  {
    label: string
    apiKeyEnv: string
    defaultModel: string
    signupUrl: string
  }
>

const PLACEHOLDER_PATTERNS = [
  /^sk-?x+$/i,
  /^replace-me/i,
  /^your-/i,
  /xxxxxxxx/i,
]

export function isValidApiKey(value: string | undefined): boolean {
  const trimmed = value?.trim()
  if (!trimmed) return false
  return !PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(trimmed))
}

export function getConciergeProvider(): ConciergeLlmProvider | null {
  const provider = process.env.LLM_PROVIDER ?? "google"
  if (Object.hasOwn(CONCIERGE_PROVIDER_CONFIG, provider)) {
    return provider as ConciergeLlmProvider
  }
  return null
}

export function getConciergeDefaultModel(
  provider: ConciergeLlmProvider,
): string {
  return CONCIERGE_PROVIDER_CONFIG[provider].defaultModel
}

export function getConciergeConfigError(): string | null {
  const provider = getConciergeProvider()

  if (!provider) {
    const raw = process.env.LLM_PROVIDER ?? "google"
    return `Unsupported LLM_PROVIDER "${raw}". Use "google", "groq", "openai", or "anthropic".`
  }

  const { apiKeyEnv, signupUrl } = CONCIERGE_PROVIDER_CONFIG[provider]
  const apiKey = process.env[apiKeyEnv]

  if (!isValidApiKey(apiKey)) {
    const raw = apiKey?.trim()
    if (!raw) {
      return `${apiKeyEnv} is empty in .env. Get a free key at ${signupUrl}, then restart npm run dev.`
    }
    return `${apiKeyEnv} in .env looks like a placeholder. Replace it with a real key, then restart npm run dev.`
  }

  return null
}
