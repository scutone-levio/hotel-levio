# Account & reservations page readability — Design Spec

**Date:** 2026-07-16
**Status:** Approved

## Problem

The account pages (`/account`, `/account/reservations`, `/account/reservations/[id]`) felt hard to read where text sat directly on the cream page background (`--background: oklch(0.983 0.016 90)`) instead of on a white card.

## Audit

Checked every `text-muted-foreground` (and similar secondary-text) usage across `app/account/**` and `components/account/**` against the surface it renders on:

| Location | Surface | Contrast |
|---|---|---|
| `AccountShell` sidebar nav — inactive links | `bg-background` (cream), directly | **4.51:1** — bare AA pass, reads as low-contrast at `text-sm` |
| `ProfileForm` footer note | inside `AccountShell`'s `bg-white` card | 4.73:1 on white — fine |
| `ReservationsList` empty-state text, card subtext | `bg-white` (tab list / reservation cards) | 4.73:1 — fine |
| `ReservationDetail` `<dt>` labels, room number, cancellation note | inside `bg-white` card | 4.73:1 — fine |
| Login/register footer link text | inside `Card` (`--card: oklch(1 0 0)`, white) | 4.73:1 — fine |

Everything else in these flows renders inside a white card or `Card` component (`bg-white` / `bg-card`), so `text-muted-foreground` there is effectively on white (4.73:1) — acceptable. The **only** direct-on-cream text is the `AccountShell` sidebar nav's inactive links, and — on mobile/tablet, where the nav stacks above the card instead of beside it — that exposure is even more prominent.

4.51:1 technically clears WCAG AA (4.5:1) for normal text, but only by a hair, which is why it reads as washed out against the warm cream tint in practice.

## Rule

**Text placed directly on the page's cream background (`bg-background`) must not use `text-muted-foreground`.** Use one of:

- A brand-navy tint: `text-[#0f2a3d]/70` (7.61:1 on cream) — preferred when the surface already uses the brand navy elsewhere (e.g. active/hover states), for visual cohesion.
- `text-foreground/70` (7.46:1 on cream) as a neutral fallback where no brand color is already in play.

Both land comfortably at WCAG AAA (≥7:1) instead of a bare AA pass, and both stay legible without needing the surface itself to change.

`text-muted-foreground` remains correct for secondary text inside white/card surfaces (`bg-white`, `bg-card`) — measured at 4.73:1 there, which is the existing site-wide convention and out of scope for this fix.

## Fix applied

`components/account/account-shell.tsx` — sidebar nav inactive-link class changed from `text-muted-foreground` to `text-[#0f2a3d]/70` (brand navy at 70% opacity), matching the active state's navy and the hover state's navy background. Active state and hover behavior are unchanged.

```diff
  active
    ? "bg-[#c69456] font-medium text-[#0f2a3d]"
-   : "text-muted-foreground hover:bg-[#0f2a3d] hover:text-white",
+   : "text-[#0f2a3d]/70 hover:bg-[#0f2a3d] hover:text-white",
```

## Non-goals

- Changing the `--muted-foreground` token globally (would affect on-white usage across the whole site, which already measures fine).
- Changing the cream `--background` token itself.
- Auditing pages outside `/account` and `/account/reservations` (e.g. public rooms pages) — out of scope for this pass.

## Test plan

- [ ] `/account` — sidebar nav inactive link text reads clearly against the cream background, both desktop (side-by-side) and mobile (stacked above the card).
- [ ] Hover and active nav states unchanged (gold background + navy text when active; navy background + white text on hover).
- [ ] No other `text-muted-foreground` usage in `app/account/**` / `components/account/**` renders outside a white/card surface.
