export const CHAT_POLICY_VERSION = "2026-06-28"
export const CHAT_SYSTEM_PROMPT_VERSION = "2026-06-28.1"
export const CHAT_CONSENT_SCOPES = [
  "ai_chat_basic",
  "profile_context",
  "nutrition_history",
  "hydration_history",
  "image_analysis",
  "memory",
] as const

export type ChatConsentScopeValue = (typeof CHAT_CONSENT_SCOPES)[number]

export const CHAT_TITLE_MAX_LENGTH = 120
export const CHAT_CONVERSATION_PAGE_SIZE = 20
export const CHAT_MESSAGE_PAGE_SIZE = 50
export const CHAT_MESSAGE_MAX_LENGTH = 4000
