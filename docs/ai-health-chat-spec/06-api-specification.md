# 06 — API Specification

## General contract

- Base path: `/api/chat`
- Authentication: existing HttpOnly session cookie
- JSON requests use `Content-Type: application/json`
- Image upload may use `multipart/form-data` or an explicit bounded upload flow
- All IDs are opaque strings
- Timestamps use ISO 8601 UTC
- Client-supplied `userId` and role are ignored/rejected

## Error shape

```json
{
  "error": {
    "code": "CONVERSATION_NOT_FOUND",
    "message": "ไม่พบบทสนทนา",
    "requestId": "opaque-id",
    "retryable": false
  }
}
```

Suggested codes:

- `UNAUTHENTICATED`
- `FORBIDDEN`
- `CONSENT_REQUIRED`
- `VALIDATION_ERROR`
- `CONVERSATION_NOT_FOUND`
- `RATE_LIMITED`
- `UNSUPPORTED_IMAGE`
- `PROVIDER_UNAVAILABLE`
- `GENERATION_STOPPED`
- `INTERNAL_ERROR`

## `POST /api/chat`

Creates a user turn and streams an assistant response.

Request:

```json
{
  "conversationId": "optional-existing-id",
  "message": "ช่วยสรุปมื้ออาหารวันนี้",
  "attachmentIds": [],
  "clientRequestId": "uuid-for-idempotency"
}
```

Server pipeline:

```text
parse → validate → authenticate → consent → rate limit → ownership
→ persist user message/idempotency record → build minimal context
→ call AI service → safety/output handling → stream → persist final state
```

Streaming format may be SSE or another documented stream supported by the client. If SSE is used, define events such as:

```text
event: meta
data: {"conversationId":"...","assistantMessageId":"..."}

event: delta
data: {"text":"..."}

event: done
data: {"finishReason":"stop","usage":{"inputTokens":0,"outputTokens":0}}

event: error
data: {"code":"PROVIDER_UNAVAILABLE","retryable":true}
```

Never include hidden prompts or private context in the stream.

## `POST /api/chat/stop`

Optional when cancellation cannot be handled solely by disconnect/abort.

Request:

```json
{
  "conversationId": "id",
  "assistantMessageId": "id"
}
```

Must validate ownership and ensure only the active generation is affected.

## `POST /api/chat/image`

Upload or analyze a bounded food image.

- Validate authentication and `image_analysis` consent
- Enforce size/type/signature limits
- Remove metadata where feasible
- Return an attachment ID and structured estimate
- Do not automatically create a Meal
- Reuse a shared AI provider/service extracted from scan-food only when this can be done without breaking the existing endpoint

## `GET /api/chat/conversations`

Query:

- `cursor`
- `limit` with bounded maximum
- `status=active|archived`
- `q` for bounded search
- `pinned`

Response:

```json
{
  "items": [
    {
      "id": "id",
      "title": "สรุปอาหารวันนี้",
      "pinned": false,
      "archivedAt": null,
      "updatedAt": "2026-06-28T00:00:00.000Z",
      "preview": "..."
    }
  ],
  "nextCursor": null
}
```

## `POST /api/chat/conversations`

Creates an empty conversation only if the UI needs it. Otherwise prefer creation with the first message to avoid abandoned records.

## `GET /api/chat/conversations/[id]`

Returns conversation metadata and cursor-paginated messages. Missing and unauthorized IDs produce the same external response.

## `PATCH /api/chat/conversations/[id]`

Allowlisted fields only:

```json
{
  "title": "ชื่อใหม่",
  "pinned": true,
  "archived": false
}
```

Reject unknown fields. Enforce title length and normalization.

## `DELETE /api/chat/conversations/[id]`

- Requires authentication and ownership
- Is idempotent from the user's perspective
- Applies the documented soft-delete/purge policy
- Cancels any active generation safely

## `GET/PATCH /api/chat/consent`

GET returns active scopes and version. PATCH records explicit grants/revocations. The server must not accept a fabricated historic timestamp or consent version as authoritative.

## Status codes

- `200` successful read/update
- `201` created
- `204` successful deletion with no body
- `400` malformed/validation failure
- `401` no valid session
- `403` authenticated but disallowed/consent policy where appropriate
- `404` missing or non-owned private object
- `409` idempotency/state conflict
- `413` upload too large
- `415` unsupported media
- `429` rate limit
- `502/503/504` normalized provider/upstream failure

## Agent prompt

```text
Implement only the endpoint contracts required by the current phase. Authenticate,
validate, rate-limit, and check ownership before expensive work. Derive identity from
the server session. Use stable error codes and never return raw provider errors. Support
abort and idempotency for streamed requests. Add contract tests for every status and
negative ownership case. Update this file if an approved implementation changes a
request, response, event, or status contract.
```

