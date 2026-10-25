# UI Context

## Theme

Light theme only. The shop is bright during the day and the interface must stay readable in
daylight on a cheap phone screen. The design language is a clean, calm business workspace:
warm off-white backgrounds, white surfaces, near-black text, and one teal accent reserved for
the primary action on each screen.

Principles:

- Clarity over decoration. This is a money tool used while a customer is waiting.
- One primary action per screen, visually obvious.
- Large touch targets and large numbers. The amount due is the biggest thing on the sale
  screen.
- Dense but calm tables on desktop, stacked cards on mobile.
- No dark mode in v1. No gradients, no glass effects, no heavy shadows.

## Colors

All components must use these tokens — no hardcoded hex values.

| Role            | CSS Variable       | Value     |
| --------------- | ------------------ | --------- |
| Page background | `--bg-base`        | `#F7F7F5` |
| Surface         | `--bg-surface`     | `#FFFFFF` |
| Subtle surface  | `--bg-subtle`      | `#F1F1EE` |
| Primary text    | `--text-primary`   | `#17181A` |
| Muted text      | `--text-muted`     | `#6B7280` |
| Primary accent  | `--accent-primary` | `#0F766E` |
| Accent hover    | `--accent-hover`   | `#115E59` |
| Accent soft     | `--accent-soft`    | `#E6F4F1` |
| Border          | `--border-default` | `#E4E4E7` |
| Error           | `--state-error`    | `#DC2626` |
| Warning         | `--state-warning`  | `#B45309` |
| Success         | `--state-success`  | `#16A34A` |

Usage rules:

- Primary buttons and active navigation use `--accent-primary` with white text.
- Money owed and destructive actions use `--state-error`. Paid and settled use
  `--state-success`. Low stock uses `--state-warning`.
- Status is always reinforced with a label, never colour alone.

## Typography

| Role      | Font              | Variable      |
| --------- | ----------------- | ------------- |
| UI text   | Geist Sans        | `--font-sans` |
| Code/mono | Geist Mono        | `--font-mono` |

- Base size 16px. Body text 16px, secondary 14px, table cells 14px, page titles 24–30px.
- The sale total and dashboard headline figures use 32–40px with tabular numbers
  (`font-variant-numeric: tabular-nums`).
- All money and dates render through shared formatters in `src/lib/format.ts`. Never format
  currency inline. Money displays as `Rs. 1,250.00` and derives from integer paisa.
- Never go below 14px for anything a shopkeeper must read.

## Border Radius

| Context           | Class          |
| ----------------- | -------------- |
| Inline / small UI | `rounded-md`   |
| Cards / panels    | `rounded-xl`   |
| Modals / overlays | `rounded-2xl`  |

Radii map to 6px (`md`), 12px (`xl`), and 16px (`2xl`).

## Component Library

shadcn/ui on top of Tailwind. Components live in `src/components/ui/` and are treated as
protected files:

- Add components with the shadcn CLI rather than writing them by hand.
- Do not edit generated components to fit one screen. Wrap them in
  `src/components/` instead.
- Required base components: `button`, `input`, `label`, `form`, `table`, `card`, `dialog`,
  `alert-dialog`, `select`, `badge`, `separator`, `sonner` (toasts), `calendar`, `popover`,
  `tabs`, `sheet` (mobile navigation).
- Icons: Lucide React, stroke-based only. `h-4 w-4` inline, `h-5 w-5` in buttons,
  `h-6 w-6` in navigation on mobile.

## Layout Patterns

- **App shell (desktop/tablet):** fixed left sidebar (240px) with the shop name at the top and
  navigation below; content area with a 24px padding and a max width of 1200px.
- **App shell (mobile):** top bar with page title and the current user; bottom navigation with
  at most five items: Dashboard, Sell, Products, Customers, More.
- **Dashboard:** a 2-column mobile / 4-column desktop grid of summary cards, then a sales
  chart, then two lists side by side (recent sales, low stock).
- **Sale screen:** item search and grid at the top, cart in the middle, and a fixed bottom bar
  with the total and the **Complete sale** button. The bottom bar must remain visible while
  the cart scrolls.
- **Tables:** on mobile, collapse to stacked cards; never allow horizontal page scrolling for
  primary data.
- **Forms:** one column, labels above inputs, inline field errors, and a single primary submit
  button at the bottom.
- **Modals:** centered overlay with a dimmed backdrop. Use `alert-dialog` for destructive
  confirmations (voiding a sale) and `dialog` for editing.
- **Empty states:** every list has a short explanation and the action that fills it ("No
  products yet — add your first product").

## Feedback and States

- Every mutation shows a toast on success and an inline message on failure.
- Buttons show a pending state and are disabled while a request is in flight.
- Loading uses skeletons for lists and cards, not full-page spinners.
- Errors are written in plain language, not codes: "Only 3 kg of Sugar are in stock" rather
  than "VALIDATION_ERROR".
- Destructive actions require confirmation and name the record being affected.
