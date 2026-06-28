# 08 — UI/UX Specification

## Experience principles

- Thai-first, calm, readable, and non-judgmental
- Direct answer before detail
- Make uncertainty, consent, and data use visible
- Preserve user drafts and avoid surprising data loss
- Mobile-first without reducing desktop productivity
- Match existing ScanZapp AI visual language

## Page layout

Desktop:

- conversation sidebar
- message timeline
- sticky composer
- optional contextual information panel only when useful

Mobile:

- conversation list in a drawer/sheet
- full-width timeline
- composer above safe-area inset
- no horizontal overflow from tables or code

## Conversation sidebar

- New chat
- Search
- Pinned and recent sections
- Archived view
- Rename, pin, archive, delete actions
- Skeleton during initial load
- Helpful empty state
- Cursor/infinite loading without scroll jumps

## Message timeline

- Visually distinguish user and assistant without relying on color alone
- Stream text without aggressive layout shift
- Show status for sending, streaming, stopped, retrying, and failed
- Provide Copy and Retry with accessible labels
- Keep the latest response visible while respecting manual scroll position
- Do not force-scroll users who scrolled up
- Tables scroll horizontally in a bounded container

## Composer

- Multiline text input
- Enter sends; Shift+Enter adds a line
- Send button has clear disabled/loading state
- Stop replaces Send during generation
- Attachment preview can be removed before send
- Display character/file limits before failure
- Preserve an unsent draft during ordinary navigation or clearly warn before loss

## Consent

Use plain Thai:

- what data will be sent
- why it is used
- that results may be wrong
- that the tool is not medical care
- how to change or revoke consent

Do not use prechecked optional scopes or manipulative design. Basic refusal to grant optional context should still allow the safest reduced-function experience where technically possible.

## Loading and errors

- Use skeletons for layout, not indefinite spinners
- Show retry near the failed operation
- Keep already loaded messages visible during a recoverable failure
- Distinguish offline/network, rate limit, provider busy, validation, and session expiry
- Redirect or prompt sign-in on expired auth without exposing private cached content
- Toasts supplement, not replace, inline critical errors

## Optimistic UI

Appropriate for:

- pin/archive/rename when rollback is reliable
- showing a pending user message after server acceptance/idempotency is established

Avoid optimistic irreversible deletion or pretending a model response completed.

## Accessibility

- Meet WCAG 2.2 AA target
- Full keyboard navigation
- Visible focus
- Semantic headings, lists, buttons, dialogs, and form labels
- `aria-live` used carefully for status, not every streamed token
- Respect reduced motion
- Minimum touch target appropriate for mobile
- Sufficient contrast in light and dark themes
- Dialog focus trap, Escape behavior, and focus restoration
- Announce upload and generation errors

## Dark mode and responsive behavior

Follow existing theming decisions. If dark mode is not yet a stable project feature, do not introduce a separate chat-only theme system. Verify 320px width, common mobile widths, tablet, and desktop.

## Safety UX

- Safety messages should be clear and calm
- Emergency guidance must be prominent and concise
- Label estimated nutrition
- Show context source at a useful level, e.g. “อ้างอิงมื้ออาหาร 7 วันที่บันทึกไว้”
- Never display hidden prompts, raw context blobs, provider errors, or internal confidence as authority

## Agent prompt

```text
Implement a complete state model for the requested UI: loading, empty, composing,
sending, streaming, stopped, success, error, retry, unauthorized, and consent-required.
Reuse existing ScanZapp AI components and styles. Preserve keyboard and mobile behavior.
Do not use color alone for status, announce important changes accessibly, and prevent
streaming updates from overwhelming screen readers. Verify responsive layout and focus
behavior before marking the UI complete.
```

