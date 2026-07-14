---
name: link-pointer-cursor
description: >-
  Ensures every clickable UI element shows a pointer cursor on hover. Native
  `<a>` tags and enabled `<button>` elements already get this from global CSS
  (app/globals.css) — no action needed there. Use when building or editing a
  custom interactive element (e.g. a `<div>`/`<span>` with a click handler, or
  a custom component rendering as neither `<a>` nor `<button>`) that needs an
  explicit `cursor-pointer` class.
---

# Clickable elements should have a pointer cursor on hover

`app/globals.css` already applies `cursor: pointer` to every `<a>` and enabled
`<button>`, and `cursor: not-allowed` to disabled buttons, via a global rule.
No per-component class is required for those.

## Scope

Applies to:

- Custom interactive elements that do **not** render as a native `<a>` or
  `<button>` (e.g. a `<div>`/`<span>` with an `onClick` handler, or a custom
  component using `role="button"`) — add `cursor-pointer` explicitly (and
  `cursor-not-allowed` when disabled).
- Components that wrap and render a native `<a>`/`<button>` (e.g. the shadcn
  `Button`) are already covered by the global rule; an explicit
  `cursor-pointer` class there is redundant but harmless.

Does not apply to:

- Server actions — they have no DOM presence or cursor. Only the element that
  triggers one (a button or link) does, and that falls under the rules above.
