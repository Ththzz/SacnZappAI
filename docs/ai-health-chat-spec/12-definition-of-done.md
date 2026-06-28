# 12 — Definition of Done

A checkbox may be marked only with implementation or test evidence. Use `N/A` with a reason when genuinely outside the approved scope.

## Product

- [ ] Authenticated user can create, continue, stop, and retry a chat
- [ ] Conversation list, search, rename, pin, archive, and delete meet approved scope
- [ ] Refresh preserves completed history without duplicates
- [ ] Empty/loading/error/offline/rate-limit/session-expired states are usable
- [ ] Thai and English input/output render correctly
- [ ] Image behavior, if in scope, handles unclear and non-food images without invention

## Authentication and ownership

- [ ] Every private endpoint requires the existing authenticated session
- [ ] Identity and role are derived server-side
- [ ] Every conversation/message/attachment/consent query enforces `userId`
- [ ] Another user's ID is indistinguishable from a missing private ID
- [ ] Admin has no implicit access to private chat content
- [ ] Multi-user isolation tests pass

## Consent and privacy

- [ ] Consent is explicit, scoped, versioned, and checked server-side
- [ ] Revocation prevents future context use
- [ ] Only necessary personal data is sent to the provider
- [ ] Context provenance is understandable to the user
- [ ] Retention and purge behavior are documented and implemented for production scope
- [ ] Logs/analytics exclude prompts, responses, images, health content, and secrets
- [ ] No training use occurs without separate explicit approval

## AI and medical safety

- [ ] System prompt is server-only and versioned
- [ ] Untrusted content cannot override policy
- [ ] Direct/indirect prompt-injection evaluations pass
- [ ] AI does not diagnose, prescribe, or guarantee outcomes
- [ ] Emergency escalation is clear
- [ ] High-risk populations/topics receive appropriate limitations
- [ ] Nutrition and image results disclose estimation/uncertainty
- [ ] Unsupported claims and fabricated citations are not produced in evaluation cases

## Application security

- [ ] No API keys or server secrets reach the client bundle or responses
- [ ] Markdown/output is sanitized against XSS
- [ ] Mutation CSRF/origin protections match the deployment threat model
- [ ] No arbitrary URL fetch/SSRF path exists
- [ ] Inputs, pagination, search, files, and output are bounded and validated
- [ ] Uploads validate type/signature/size and address metadata
- [ ] Rate limits and concurrency limits are production-capable
- [ ] Errors do not expose stack traces, provider payloads, SQL, or resource existence

## Streaming and reliability

- [ ] Stream format and events match the API specification
- [ ] Stop propagates cancellation
- [ ] Partial, failed, and completed messages have correct durable status
- [ ] Retry does not overwrite or duplicate history
- [ ] Idempotency prevents duplicate user submissions
- [ ] Provider timeout/overload/malformed output is normalized
- [ ] Stale streaming records have a recovery path

## Database

- [ ] Prisma schema and reviewed migration are present
- [ ] Ownership fields, relations, constraints, and query indexes are correct
- [ ] Transactions protect multi-record invariants without wrapping provider latency
- [ ] Cascade/purge behavior is tested
- [ ] Existing users, sessions, profiles, settings, meals, water logs, and scan results remain valid

## UI/UX and accessibility

- [ ] UI matches existing ScanZapp AI design conventions
- [ ] Mobile layouts work at 320px and common breakpoints
- [ ] Keyboard-only workflow is complete
- [ ] Focus management and dialog restoration work
- [ ] Status is not communicated by color alone
- [ ] Streaming live announcements do not overwhelm assistive technology
- [ ] Contrast, touch targets, reduced motion, and semantic structure meet WCAG 2.2 AA target
- [ ] Dark mode works if supported project-wide

## Performance and cost

- [ ] Input, output, context, upload, pagination, retries, and concurrency are bounded
- [ ] Context is relevant and compressed without dropping safety policy
- [ ] No private shared caching is used
- [ ] No per-token database write amplification
- [ ] Latency, tokens, normalized errors, and cost are measured without content logging
- [ ] Agreed performance targets are measured in a production-like environment

## Quality

- [ ] Unit tests pass
- [ ] API/integration tests pass
- [ ] Security and ownership tests pass
- [ ] AI behavior evaluations pass
- [ ] Existing feature regression tests pass
- [ ] ESLint passes for the approved baseline
- [ ] TypeScript check passes
- [ ] Production build passes
- [ ] API contracts and specification match the implementation
- [ ] No unrelated refactor or breaking change is included

## Final agent prompt

```text
Audit the implementation against every item in this Definition of Done. For each checked
item, cite concrete evidence: file, test, command result, or verified behavior. Mark an
item N/A only with a scope reason. Do not mark work complete while a required security,
ownership, consent, medical-safety, migration, test, type, lint, build, responsive, or
accessibility item is unresolved. Report blockers and residual risk plainly.
```

