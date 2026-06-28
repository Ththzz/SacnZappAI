# 10 — Testing and Quality

## Quality gates

Run the checks relevant to the changed scope:

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
```

Do not claim a check passed if it was not run. Record unrelated pre-existing failures separately.

## Unit tests

Test pure logic for:

- request validation and normalization
- context selection and token budgeting
- consent evaluation
- title generation fallback
- error mapping
- provider response parsing
- Markdown/security allowlists
- nutrition estimate normalization
- safety classification/routing
- idempotency decisions

## API integration tests

For each endpoint cover:

- valid authenticated request
- no session / expired session
- malformed and oversized input
- owned object
- another user's object
- missing object
- missing/revoked consent
- rate limit
- database failure mapping
- provider timeout, overload, malformed response
- abort/disconnect
- duplicate `clientRequestId`

The response for another user's private ID must not reveal its existence.

## Streaming tests

- event order and valid framing
- unicode/Thai text split across chunks
- complete finalization
- stop before first token
- stop after partial output
- client disconnect
- provider error before and after partial output
- retry linkage
- no duplicate persisted message
- stale streaming recovery

## Security tests

- horizontal privilege escalation for conversation/message/attachment/consent
- role/user ID spoofing in request bodies
- direct and indirect prompt injection
- system prompt and secret exfiltration requests
- XSS payloads in user/model Markdown
- unsafe link protocols
- CSRF/origin behavior for mutations
- SSRF if URL retrieval is ever added
- SQL/search injection attempts
- oversized/decompression-bomb-like uploads within safe test constraints
- EXIF/location stripping where implemented
- log redaction

## AI behavior evaluations

Maintain deterministic fixtures and scored expectations for:

- ordinary nutrition education
- insufficient information
- unclear/non-food image
- serving-size uncertainty
- allergy and food safety uncertainty
- pregnancy/child/chronic disease caution
- eating-disorder or extreme restriction content
- plausible emergency escalation
- request for diagnosis or medication change
- fabricated citation pressure
- instruction to reveal hidden prompt/context
- Thai, English, and mixed-language inputs

Do not require exact prose. Assert required safety elements and prohibited claims.

## UI tests

- composer keyboard behavior
- loading, empty, streaming, stopped, retry, error
- draft preservation
- conversation search/pin/archive/delete
- confirmation dialog and focus restoration
- keyboard-only navigation
- screen-reader semantics and restrained live regions
- 320px/mobile/tablet/desktop layout
- reduced motion
- dark mode if supported project-wide

## Regression tests

Protect existing:

- sign-in/sign-up/sign-out
- scan-food flow
- meals/history
- profile/settings
- water logs
- health insight
- notifications
- admin access boundaries

## Test data

- Use isolated temporary/test databases
- Never use real health records or production credentials
- Seed at least two ordinary users and one admin
- Include similarly shaped IDs/resources to catch missing ownership filters
- Clean up temporary files and generated records

## Review checklist

- Types accurately model runtime states
- No `any` introduced without justification
- Client/server boundary is clear
- No secret or sensitive content enters browser/logs
- New schema has migration and indexes
- Error handling covers partial streaming
- Documentation/API contracts match implementation
- Accessibility and mobile behavior are verified

## Agent prompt

```text
For every behavior changed, add the smallest test that would fail before the change and
pass after it. Prioritize auth, ownership, consent, prompt injection, streaming state,
and regression coverage. Use at least two users in isolation tests. Run tests, lint,
TypeScript, and build in proportion to the change, report exact commands/results, and
never hide a pre-existing failure.
```

