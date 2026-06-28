# 02 — Feature Specification

## 1. Chat

### Message composer

- Accept Thai and English plain text
- Trim surrounding whitespace; reject empty messages
- Apply explicit server-side size limits
- Disable duplicate submission while the same message is pending
- Support Enter to send and Shift+Enter for a new line
- Provide Stop while streaming
- Never render model HTML directly

### Streaming

- Show incremental assistant text
- Persist a user message before or atomically with starting generation
- Mark the assistant message as `streaming`, `complete`, `stopped`, or `error`
- On disconnect, do not save fabricated completion text
- Retry creates a new generation attempt linked to the original user message
- Avoid duplicate messages when the client reconnects or retries a request

### Message actions

- Copy the visible response
- Retry the latest eligible assistant response
- Show a concise error with a retry action
- Allow feedback metadata without exposing it to other users
- Deletion rules must be explicit; prefer deleting a conversation over silently removing middle turns in v1

### Markdown

Allow headings, paragraphs, lists, emphasis, code, links, and simple tables. Block raw HTML, scripts, event handlers, iframes, unsafe protocols, remote tracking images, and arbitrary embeds.

## 2. Conversations

- Create automatically on first message or explicitly from “แชตใหม่”
- Generate a short title from the first useful turn; fall back to deterministic text
- List by most recent activity
- Search title and user-authored text only within the current user's records
- Rename, pin, archive, unarchive, and delete
- Deletion requires a confirmation UI and server-side ownership check
- Pagination must be cursor-based when result size grows
- Empty conversations should expire or be cleaned safely

## 3. Consent

Before personal data is included in AI context:

- Explain which data categories may be used
- Explain that AI can be wrong and is not medical care
- Store consent version, scope, timestamp, and revocation timestamp
- Let the user choose personal context categories where practical
- Revocation stops future use immediately; retention/deletion follows policy
- Never infer consent from merely opening the page

Suggested scopes:

- `ai_chat_basic`: send the message to the configured provider
- `profile_context`: use goal and profile fields
- `nutrition_history`: use meals and scan summaries
- `hydration_history`: use water logs
- `image_analysis`: send an uploaded image for analysis
- `memory`: maintain a long-term conversation summary

## 4. Context and memory

- Use only data necessary for the current question
- Prefer aggregates or summaries over raw history
- Include provenance internally: category and date range
- Do not insert secrets, password hashes, session data, admin notes, or unrelated records
- Long-term memory must be user-visible, editable/revocable, bounded, and consented
- Treat stored summaries as untrusted context, not system instructions
- Never let conversation content override system and safety policies

## 5. Image upload and meal analysis

- Accept only allowlisted image types and bounded dimensions/size
- Validate file signature where possible, not only extension or MIME supplied by client
- Strip metadata before durable storage or provider transmission when feasible
- Do not persist base64 data URLs in conversation JSON
- Use existing scan-food behavior or a shared server service; avoid duplicating provider logic
- If the image is unclear or not food/drink, say so without inventing nutrition
- Nutrition estimates must include uncertainty and serving assumptions
- User must confirm before an AI estimate becomes a saved Meal record

## 6. Nutrition and health behavior

- Provide education and practical options, not diagnosis
- Distinguish user-provided facts, database facts, and AI estimates
- Avoid moralizing food as “good” or “bad”
- Do not promote extreme restriction, purging, unsafe fasting, or rapid weight-loss practices
- For allergies, pregnancy, chronic disease, medication interaction, eating disorders, children, or severe symptoms, narrow the answer and recommend qualified professional guidance
- For possible emergency symptoms, advise immediate local emergency help; do not continue with routine optimization advice

## 7. Failure states

The UI and API must handle:

- unauthenticated session
- missing/expired consent
- invalid or oversized input
- inaccessible conversation
- rate limit
- provider timeout or overload
- malformed provider output
- client disconnect
- database failure
- unsupported image
- safety refusal

Errors must be actionable but must not reveal whether another user's resource exists.

## 8. Future enhancements

- Voice input/output
- Approved knowledge retrieval with citations
- Wearable and health platform integrations
- User-exportable conversation archive
- Provider failover and evaluation dashboard
- Explicit tool calls for proposed meal/water actions with user confirmation

## Acceptance criteria

- [ ] All chat and conversation actions require authentication
- [ ] Every conversation/message query is scoped by authenticated `userId`
- [ ] Consent is checked on the server before personal context or images leave the app
- [ ] Streaming can be stopped and retried without duplication
- [ ] Markdown is sanitized
- [ ] Image failures never invent food or nutrients
- [ ] AI estimates are labeled
- [ ] Search, pin, archive, rename, and delete are isolated per user
- [ ] Error responses follow the shared API error shape

## Agent prompt

```text
Implement the requested feature behavior exactly as specified here. For each behavior,
define loading, empty, success, error, retry, and unauthorized states. Validate every
input on the server and scope every query to the authenticated user. Do not implement
future enhancements unless the current task explicitly requests them. When a requirement
needs a product decision, preserve the safest minimal behavior and document the decision.
```

