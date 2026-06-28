# 03 — Next.js Architecture

## Architectural rules

1. Use App Router conventions already present in the repository.
2. Use Server Components by default.
3. Add `"use client"` only at the smallest interactive boundary.
4. Keep secrets, provider calls, context building, authorization, and persistence server-only.
5. Route Handlers are the public boundary for chat APIs.
6. Do not refactor unrelated pages or shared components.
7. Preserve existing import aliases and project formatting.

## Suggested feature structure

Adapt this structure to the existing repository; do not create empty abstraction layers:

```text
app/
  health-chat/
    page.tsx
    loading.tsx
    error.tsx
    HealthChatClient.tsx
  api/
    chat/
      route.ts
      conversations/
        route.ts
        [id]/
          route.ts
components/
  health-chat/
lib/
  ai/
    provider.ts
    prompts.ts
    safety.ts
  chat/
    context.ts
    validation.ts
    repository.ts
types/
  chat.ts
```

Create a layer only when it owns a clear responsibility or is reused. A small route can remain direct; provider secrets and reusable ownership queries should not.

## Server and Client Components

Server Components may:

- authenticate and redirect
- read initial conversation metadata
- produce page metadata
- pass serializable initial state

Client Components may:

- manage composer state
- display streaming updates
- control sidebar/dialog/toast interactions
- handle keyboard and clipboard behavior

Client Components must not:

- import Prisma or server-only modules
- read secret environment variables
- build authoritative AI context
- decide ownership or consent
- call an external AI provider

## Route Handlers

- Authenticate using existing server helpers
- Parse and validate JSON/form data before use
- Return consistent JSON errors or a documented event stream
- Derive `userId` from the server session
- Check ownership in the same query whenever possible
- Apply rate limiting before expensive work
- Propagate abort signals to provider requests
- Keep Node runtime when required by Prisma or Node APIs; do not opt into Edge without verification

## Loading, errors, and Suspense

- Use route-level `loading.tsx` only for meaningful navigation loading
- Use scoped skeletons for conversation lists and messages
- Add user-facing error boundaries for recoverable UI failures
- Do not expose stack traces, SQL errors, provider payloads, or secret names
- Avoid Suspense boundaries that cause the composer to remount and lose drafts

## Caching

- Treat personalized chat data as dynamic and private
- Do not put user conversations in shared caches
- Avoid static generation for authenticated conversation content
- Cache only non-sensitive, user-independent data with an explicit invalidation policy
- After mutations, update local state or revalidate the narrow affected surface

## State and hooks

- Keep server data authoritative
- Prefer local component state for draft and streaming UI
- Use custom hooks only for cohesive reusable behavior
- Do not introduce a global state library solely for this feature without demonstrated need
- Use `AbortController` for Stop and unmount cleanup

## Environment variables

Server-only examples:

- `AI_API_KEY`
- `AI_BASE_URL`
- `AI_MODEL`
- rate-limit or storage credentials

Only variables intentionally safe for the browser may use `NEXT_PUBLIC_`. The provider key, system prompt, internal model routing, and moderation configuration must never be public.

## Authentication, authorization, ownership

Authentication answers “who is this?”; authorization answers “may they do this?” Every mutation and read needs both. A valid session does not grant access to a conversation by ID.

Preferred query pattern:

```ts
const conversation = await prisma.conversation.findFirst({
  where: { id: conversationId, userId: user.id },
})
```

Avoid fetching by ID and checking ownership much later. Mutating queries must retain the ownership predicate or run in a transaction after a verified record lock/condition appropriate to the database.

## Incremental development

- Inspect before editing
- Change the smallest coherent set of files
- Keep old APIs working unless a migration is part of the task
- Add schema migration and tests with the behavior that needs them
- Do not mix a feature slice with broad style cleanup
- Stop and report after the requested phase

## Agent prompt

```text
Follow existing Next.js App Router conventions. Use Server Components by default and a
small Client Component boundary for interaction. Keep Prisma, authentication, context,
system prompts, and provider calls on the server. Never expose API keys. Do not change
unrelated folders. Before adding a service, hook, provider, or repository abstraction,
show the concrete responsibility it isolates. Verify imports do not pull server-only
code into the client bundle.
```

