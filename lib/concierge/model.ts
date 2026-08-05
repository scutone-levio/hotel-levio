import type { LanguageModel } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { google } from "@ai-sdk/google"
import { groq } from "@ai-sdk/groq"
import { openai } from "@ai-sdk/openai"

import {
  getConciergeConfigError,
  getConciergeDefaultModel,
  getConciergeProvider,
} from "@/lib/concierge/config"

export function isConciergeConfigured(): boolean {
  return getConciergeConfigError() === null
}

export function getConciergeModel(): LanguageModel {
  const configError = getConciergeConfigError()
  if (configError) {
    throw new Error(configError)
  }

  const provider = getConciergeProvider()
  if (!provider) {
    throw new Error(getConciergeConfigError() ?? "Concierge LLM is not configured.")
  }

  const model =
    process.env.LLM_MODEL ?? getConciergeDefaultModel(provider)

  switch (provider) {
    case "google":
      return google(model)
    case "groq":
      return groq(model)
    case "anthropic":
      return anthropic(model)
    case "openai":
      return openai(model)
  }
}
