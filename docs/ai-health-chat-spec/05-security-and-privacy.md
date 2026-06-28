# 05 — Security and Privacy

## Security invariants

- Deny by default
- Authenticate on every private endpoint
- Authorize every object access
- Derive identity and role from the server session
- Minimize data sent to the model
- Treat all model input/output as untrusted
- Keep secrets and sensitive logs server-side
- Return the same not-found response for missing and unauthorized private resources

## Authentication and session

- Reuse the existing `scanzapp_session` HttpOnly cookie flow
- Preserve `HttpOnly`, `SameSite=Lax`, `Secure` in production, expiry, and token hashing
- Rotate or revoke sessions according to the existing auth policy
- Do not add JWT solely for Chat; a JWT would not replace authorization or revocation checks
- Never accept `userId`, email, or role from request JSON as identity

## Authorization and ownership

Every user-owned model must include or resolve to `userId`. This applies to:

- conversations
- messages
- attachments
- consent
- memories/summaries
- feedback
- usage records visible to the user

Prefer compound filters such as `{ id, userId }`. Admin role must not imply access to conversation content. Any future support access requires explicit scope, reason, audit, and user/privacy approval.

## Consent and sensitive health data

- Store versioned, scoped consent
- Check consent at the point of use, not only in UI
- Send only the categories required for the current answer
- Revocation prevents future context construction immediately
- Provide export/deletion behavior consistent with the retention policy
- Do not use chats, images, or health records for training unless a separate explicit opt-in is designed
- Avoid placing sensitive content in URLs, analytics events, cache keys, or error trackers

## Prompt injection

Protect against:

- direct user instructions to ignore rules
- instructions embedded in images, OCR, meal names, files, links, or retrieved text
- attempts to reveal system prompts, provider keys, hidden context, or other users' data
- instructions to call arbitrary URLs, execute code, or perform unauthorized actions

Controls:

1. Separate trusted policy from untrusted content by message role and delimiters
2. Never execute model-produced commands directly
3. Use allowlisted tools with schema validation and per-call authorization
4. Re-check authorization when a tool executes, even if the model requested it
5. Filter context fields and strip instruction-like metadata where appropriate
6. Test multilingual and encoded injection variants

## Web attack controls

### XSS

- Escape text by default
- Sanitize Markdown output with an allowlist
- Disallow raw HTML, unsafe protocols, inline event handlers, iframe/embed, and data URLs
- Add links with safe `rel` behavior where new tabs are used

### CSRF

- Use same-origin requests and `SameSite` cookies
- For state-changing endpoints, validate Origin/Host or use a CSRF token when the deployment threat model requires it
- Never use GET for mutations

### SSRF

- Do not let the client or model choose arbitrary provider URLs
- Do not fetch user-provided URLs in v1
- If retrieval is added, allowlist schemes/hosts, block private/link-local ranges, cap redirects and size, and revalidate each redirect

### Injection and unsafe queries

- Use Prisma parameterization
- Never interpolate user input into raw SQL
- Bound search input and escape provider-specific wildcard behavior where needed
- Validate sort fields against an allowlist

## Secrets

- Keep `AI_API_KEY` and operational credentials in environment variables or a secret manager
- Do not log, serialize, return, or commit secrets
- Redact authorization headers and provider URLs containing credentials
- Fail closed with a configuration error that does not name secret values
- Rotate a secret immediately if exposure is suspected

## File upload

- Allowlist MIME and verify magic bytes where practical
- Set maximum bytes, pixels, dimensions, and processing time
- Decode images with a safe library and reject malformed/polyglot inputs
- Strip EXIF/location metadata before durable storage or provider use
- Generate server-controlled object names
- Serve stored files as non-executable content from an isolated origin or safe storage layer
- Add malware/content scanning if broader file types are introduced
- Delete abandoned temporary files

## Rate limiting and abuse

Apply limits per authenticated user and, where appropriate, IP/device:

- chat requests per minute
- concurrent streams
- image uploads and bytes
- daily token/cost budget
- auth failures
- conversation search and export

Return `429` with safe retry guidance. Do not rely on an in-memory limiter for multi-instance production.

## Logging and audit

Allowed operational fields:

- request ID
- internal user hash/pseudonymous ID
- endpoint and outcome
- model identifier
- latency, token counts, estimated cost
- normalized error category

Do not log:

- full prompts or responses
- raw images or base64
- health profile fields
- passwords, cookies, tokens, API keys
- provider authorization headers

Audit high-risk events such as consent changes, exports, deletion, admin actions, and repeated authorization failures.

## Error handling

- Use stable error codes
- Keep client messages actionable and non-sensitive
- Map provider errors; never proxy raw payloads
- Avoid resource-existence leaks
- Include request ID for support
- Log the diagnostic category separately with redaction

## Retention

Define before production:

- conversation retention period
- attachment retention period
- deleted-record purge window
- usage/audit retention
- backup deletion behavior
- consent and legal record retention

Soft delete is not a complete privacy deletion. A purge workflow must remove or irreversibly anonymize data from active storage and address backups according to policy.

## Agent prompt

```text
Threat-model the requested change before coding. Identify trust boundaries, sensitive
data, object ownership, abuse paths, and external transmissions. Implement server-side
authentication, consent, validation, ownership, rate limits, and redaction. Treat model
input/output and uploaded content as hostile. Do not weaken an invariant for convenience.
Add negative tests proving one user cannot discover, read, mutate, stream, search, export,
or delete another user's resources.
```

