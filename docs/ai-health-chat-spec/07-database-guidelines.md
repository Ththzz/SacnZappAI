# 07 — Database Guidelines

## Principles

- Every private record belongs to a user directly or through a parent with enforced ownership
- Keep message content separate from operational usage metadata
- Use explicit status fields for streaming lifecycle
- Make retries and idempotency observable
- Minimize stored sensitive content
- Use migrations; never edit production database files manually

## Suggested models

Names are illustrative and must be reconciled with the actual Prisma schema.

### Conversation

- `id`
- `userId`
- `title`
- `summary` (optional, bounded, untrusted context)
- `pinned`
- `archivedAt`
- `deletedAt`
- `createdAt`
- `updatedAt`

Indexes:

- `(userId, updatedAt)`
- `(userId, archivedAt, updatedAt)`
- `(userId, pinned, updatedAt)`

### Message

- `id`
- `conversationId`
- `userId` (denormalized ownership can make enforcement/querying safer)
- `role`: `user | assistant`
- `content`
- `status`: `pending | streaming | complete | stopped | error`
- `parentMessageId` or retry linkage
- `clientRequestId` for idempotency
- `model` and `finishReason` when applicable
- token counts/cost metadata that is safe to retain
- `createdAt`, `updatedAt`

Indexes/constraints:

- `(conversationId, createdAt)`
- `(userId, createdAt)`
- unique idempotency key scoped to user or conversation

Do not store system/developer prompts as ordinary visible messages.

### ChatConsent

- `id`
- `userId`
- `scope`
- `policyVersion`
- `grantedAt`
- `revokedAt`
- optional non-sensitive provenance such as UI version

Enforce a clear rule for the active grant per `(userId, scope, policyVersion)`.

### Attachment

- `id`
- `userId`
- `conversationId`
- safe storage key, MIME, bytes, dimensions
- processing status
- retention/deletion timestamps
- never rely on the original filename as a storage path

### Generation/Usage

Store request ID, user ID, conversation ID, message ID, model, latency, normalized outcome, token counts, and estimated cost. Do not store full provider payload by default.

## Ownership rule

Every query must include the authenticated `userId` directly or through a verified relation. Examples:

```ts
where: { id: conversationId, userId }
```

```ts
where: { id: messageId, userId, conversationId }
```

Do not rely on the UI hiding IDs. CUID/UUID opacity is not authorization.

## Transactions

Use a transaction when operations must succeed together, such as:

- creating a conversation and first user message
- finalizing assistant content and usage state
- deleting a conversation and scheduling attachment purge
- applying a confirmed AI meal proposal and linking provenance

Provider calls should generally not hold a long database transaction open. Persist a safe pending state, call the provider, then finalize with conflict/status checks.

## Streaming consistency

- Create an assistant placeholder with a unique generation ID
- Persist final content once, or checkpoint only with a documented strategy
- A stopped/error response remains distinguishable from a completed response
- Retries do not overwrite history silently
- Recovery jobs may mark stale `streaming` rows as `error`/`stopped`

## Cascade and deletion

- Conversation deletion should delete or purge messages and attachments according to policy
- User deletion must address all chat data and stored objects
- Avoid `SetNull` if it would create sensitive orphan content without a retention reason
- Soft delete supports recovery/workflow, not final erasure

## Query rules

- Select only needed fields
- Bound all page sizes
- Use cursor pagination for growing lists
- Avoid N+1 reads while building context
- Aggregate meal/water history in the database where practical
- Never use unbounded chat history as model context
- Search must remain scoped to `userId`

## Migration strategy

1. Inspect current Prisma schema and data
2. Add backward-compatible tables/columns
3. Generate and review migration
4. Backfill only when necessary and with a rollback/retry plan
5. Update Prisma client
6. Add repository/API tests
7. Verify existing seed/migration scripts still work

SQLite is the current development baseline. Document production database assumptions before using database-specific full-text search, locking, JSON, or index features.

## Agent prompt

```text
Design the minimum schema needed for the current vertical slice. Make ownership explicit,
add indexes for actual query paths, and use idempotency/status fields for streaming.
Never store secrets, raw images, or full provider payloads in message records. Use a
reviewable Prisma migration and preserve existing User, Session, Profile, UserSettings,
Meal, WaterLog, and ScanResult behavior. Test cascade, isolation, retry, and deletion.
```

