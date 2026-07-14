Find every `<Button>` in the codebase that renders on a light or white background (inside cards, modals, dialogs, popovers, forms, calendar pickers, table rows, or any `bg-white` / `bg-card` / `bg-background` surface) and ensure it uses the correct variant.

## Rules

### `variant="blue"` — Auth/sign-in buttons
Dark navy (`#0f2a3d`) background, ivory (`#f3ecda`) text, lighter navy hover (`#163d57`).
Use for: **Sign in**, **Sign up**, and other authentication submit buttons.
This is the same dark navy blue as the "Book Now" button on the home page.

### `variant="action"` — Booking CTAs
Dark navy (`#0f2a3d`) background, ivory (`#f3ecda`) text, gold hover (`#c69456`).
Use for: **Book Now**, **Apply**, **Create account**, **checkout** and other booking action buttons.
Equivalent to `BOOKING_ACTION_BUTTON_CLASS` from `lib/rooms.ts` (do not change existing usages of that constant).

### `variant="default"` — Dark chrome
Gold/primary background. Use for buttons on the dark navy header, footer, or hero sections.

### `variant="outline"` / `variant="ghost"` / `variant="destructive"` / `variant="link"`
These are correct by design — do not change them.

## What to check

1. Grep for `<Button` across `components/` and `app/`
2. For each hit, determine the surface and purpose:
   - Auth submit on light surface → `variant="blue"`
   - Booking CTA on light surface → `variant="action"`
   - Button on dark chrome → `variant="default"` or `variant="outline"`
3. Fix any `variant="default"` (or missing variant) buttons on a light surface

## Output

List every file and line changed, or confirm no changes were needed.
