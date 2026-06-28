# 09 — Performance and Cost

## Goals

- Keep chat responsive on mobile networks
- Bound provider spend per request and per user
- Prevent context growth from degrading quality and latency
- Avoid loading entire conversation histories into the browser or model
- Measure before optimizing

## Initial targets

Targets must be validated in the deployment environment:

- Conversation list API p95: under 500 ms excluding cold start
- Existing conversation first page p95: under 700 ms excluding cold start
- Time to first streamed content p50: under 2.5 s; p95: under 6 s when provider is healthy
- User-perceived composer response: under 100 ms
- No unbounded query, message payload, context window, upload, or retry loop
- Core chat page should maintain production Lighthouse accessibility target ≥ 90

## Token budget

Each generation has explicit budgets for:

- system/safety prompt
- recent turns
- user profile/context
- conversation summary
- current user input
- output

Reserve output capacity before selecting context. When over budget:

1. remove irrelevant records
2. reduce raw history to aggregates
3. retain recent turns
4. use a bounded summary
5. ask a clarifying question rather than silently dropping essential facts

Never truncate safety rules to fit more history.

## Context selection

- Select context based on the current question and consent scopes
- Default to a small date range
- Prefer meal/water aggregates over raw rows
- Cap the number of recent messages
- Include only fields that help the answer
- Record category/date-range provenance without logging sensitive values
- Do not re-summarize unchanged history on every request when a safe versioned summary is available

## Summarization

- Summaries are derived, fallible, and untrusted
- Version summaries and tie them to a message boundary
- Never summarize secrets because secrets should never enter context
- Preserve unresolved user corrections
- Regenerate or invalidate when source messages are deleted
- Long-term memory requires explicit consent and user controls

## Caching

Safe candidates:

- model capability/config metadata without secrets
- non-user-specific UI resources
- short-lived aggregate computations keyed and isolated by user where the cache guarantees privacy

Do not cache private conversations in shared public caches. Never use raw message text as a cache key.

## Database and payload

- Cursor paginate conversation and message lists
- Select only displayed fields
- Do not send full context back to the client
- Keep stream event payloads small
- Avoid repeated writes per token; finalize once or checkpoint at a coarse documented interval
- Add indexes based on the queries in `07-database-guidelines.md`

## Frontend

- Lazy-load heavy Markdown/table/highlighting features if measurement justifies it
- Avoid rerendering the entire history on every token
- Memoize only measured expensive boundaries
- Virtualize only when message volume warrants the complexity
- Bound image previews and release object URLs
- Prevent duplicate requests caused by remounts or double clicks

## Provider reliability and cost

- Configure request timeout and abort propagation
- Retry only transient failures and only before unsafe duplication; use bounded exponential backoff with jitter
- Do not blindly retry a partially streamed generation
- Track input/output token counts, latency, normalized failure, model, and estimated cost
- Enforce per-user concurrency and daily budgets
- Provide a safe degraded message when the model is overloaded

## Cost dashboard

Aggregate operational metrics may include:

- requests and active users
- input/output tokens
- estimated cost
- latency percentiles
- completion/error/stop rate
- image-analysis volume
- rate-limit events

Do not expose prompts, responses, health content, or raw user identifiers.

## Agent prompt

```text
Set explicit limits before implementing: input characters, upload bytes/pixels, recent
turns, context tokens, output tokens, concurrency, retries, and pagination size. Build
minimal relevant context and reserve safety/output tokens first. Propagate cancellation,
avoid per-token database writes, and measure latency/tokens/cost without logging content.
Do not add caching or memoization without a clear privacy boundary and measured benefit.
```

