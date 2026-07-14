Find every `<Button>` in the codebase that renders on a light or white background (inside cards, modals, dialogs, popovers, forms, calendar pickers, table rows, or any `bg-white` / `bg-card` / `bg-background` surface) and ensure it uses `variant="action"`.

## Rule

**Light/white background → `variant="action"`**
Dark navy (`#0f2a3d`) background with ivory (`#f3ecda`) text, hovering to gold (`#c69456`).
This matches the "Book Now" style used across all booking CTAs in the app.

**Dark navy chrome (header, footer) → `variant="default"`** (gold/primary)

The `action` variant is defined in `components/ui/button.tsx`:
```ts
action: "bg-[#0f2a3d] text-[#f3ecda] hover:bg-[#c69456] hover:text-[#0f2a3d]"
```

Note: existing buttons that already use `BOOKING_ACTION_BUTTON_CLASS` from `lib/rooms.ts` are equivalent — do not change those, they are correct.

## What to check

1. Grep for `<Button` across `components/` and `app/`
2. For each hit, determine the background surface it renders on:
   - Popover, Dialog, Card, form page, table, calendar picker → light → must be `variant="action"`
   - Header nav, footer, dark hero section → dark chrome → keep `variant="default"` or `variant="outline"`
3. Skip buttons that are intentionally `variant="ghost"`, `variant="outline"`, `variant="destructive"`, or `variant="link"` — those are correct by design
4. Fix any `variant="default"` (or missing variant) buttons on a light surface

## Output

List every file and line changed, or confirm no changes were needed.
