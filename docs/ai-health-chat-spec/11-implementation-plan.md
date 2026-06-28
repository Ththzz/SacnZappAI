# 11 — Incremental Implementation Plan

## Working protocol

For every phase:

1. Inspect current code and `git status`
2. State assumptions and current baseline
3. List the exact files expected to change
4. Implement one coherent vertical slice
5. Add/update tests
6. Run focused verification
7. Summarize changed behavior, risks, and remaining work
8. Stop at the requested phase

Do not mechanically enforce “1–2 files” when a safe vertical slice requires schema, migration, API, test, and UI changes. The true rule is: change the smallest coherent set and do not mix unrelated refactors.

## Phase 0 — Discovery and decisions

- Map routes, components, auth, database, settings, scan-food provider, and tests
- Confirm production database and deployment model
- Decide streaming protocol, provider adapter, storage, rate limiter, consent version, and retention
- Record conflicts between this specification and existing behavior
- No feature refactor in this phase

Exit: an evidence-based implementation map and decisions required for Phase 1.

## Phase 1 — Domain types and persistence

- Add Conversation, Message, Consent, and necessary generation/usage models
- Add reviewed Prisma migration and indexes
- Add repository helpers with ownership predicates
- Test data isolation, cascade, statuses, and idempotency

Exit: persistence works without exposing an API.

## Phase 2 — Consent and conversation APIs

- Add consent read/update
- Add conversation create/list/read/update/delete
- Add validation and consistent error shape
- Add auth/ownership/consent tests

Exit: two users are provably isolated and conversation lifecycle works.

## Phase 3 — AI provider and safety core

- Extract or create a server-only provider adapter
- Version the system prompt
- Add context builder with data minimization
- Add timeout, abort, error normalization, usage metadata
- Add AI safety/injection evaluation fixtures

Exit: provider behavior can be tested without UI and scan-food remains working.

## Phase 4 — Streaming chat API

- Persist user turn idempotently
- Create assistant generation state
- Stream normalized events
- Finalize complete/stopped/error states
- Add disconnect, retry, duplicate, and failure tests

Exit: API can complete, stop, recover, and retry without duplicate history.

## Phase 5 — Minimal chat UI

- Add authenticated route/page
- Add message timeline and composer
- Implement stream parsing, Stop, Retry, Copy
- Cover loading/empty/error/session states
- Verify keyboard, screen reader, mobile, and Thai text

Exit: first end-to-end text chat slice is usable.

## Phase 6 — Conversation management

- Sidebar/drawer
- Cursor pagination and search
- Rename, pin, archive, delete confirmation
- Optimistic behavior only where rollback is safe

Exit: users can manage only their own conversations.

## Phase 7 — Personal context and memory

- Add explicit context scopes
- Build minimal profile/meal/water summaries
- Show context provenance in UI
- Add bounded, revocable memory only if approved
- Test revocation and data minimization

Exit: personalization is transparent, consented, and bounded.

## Phase 8 — Image chat

- Define safe upload/storage policy
- Reuse shared scan-food provider logic without breaking existing flow
- Add attachment lifecycle and retention
- Require confirmation before saving a Meal
- Test malformed, oversized, unclear, non-food, and injection images

Exit: food images work safely in a conversation.

## Phase 9 — Production hardening

- Distributed rate limiting and cost budgets
- Operational metrics and redacted logs
- Cleanup/recovery jobs
- Retention, export, and purge workflow
- Load, security, accessibility, and regression tests

Exit: all required items in `12-definition-of-done.md` pass.

## Phase prompt template

```text
Implement Phase [N] only.

First inspect the current repository and the relevant specification files. Report the
baseline, assumptions, and exact files you expect to change. Preserve unrelated code and
existing behavior. Implement the smallest testable vertical slice for this phase. Add
negative security and ownership tests where applicable. Run focused checks, then broader
checks proportional to risk. Summarize completed acceptance criteria, command results,
remaining risks, and the next phase. Stop after this phase; do not continue automatically.
```

