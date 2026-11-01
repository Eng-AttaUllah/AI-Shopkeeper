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

In code, the palette is exposed as Tailwind utilities: `bg-page`, `bg-surface`, `bg-subtle`,
`text-ink`, `text-ink-muted`, `bg-brand`, `text-brand`, `border-line`, `text-error`,
`text-warning`, `text-success`. shadcn components use their own semantic tokens
(`bg-primary`, `bg-muted`, `border-border`); `globals.css` maps those to the same palette, so
`--primary` is the teal accent, `--muted` is the subtle surface, and `--accent` is soft teal.

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

shadcn/ui on top of Tailwind. The installed version (v4, `base-nova` style) builds on Base UI
(`@base-ui/react`) rather than Radix. Components live in `src/components/ui/` and are treated
as protected files:

- Add components with the shadcn CLI rather than writing them by hand.
- Do not edit generated components to fit one screen. Wrap them in
  `src/components/` instead. Size and spacing overrides are passed through `className`.
- Required base components: `button`, `input`, `label`, `form`, `table`, `card`, `dialog`,
  `alert-dialog`, `select`, `badge`, `separator`, `sonner` (toasts), `calendar`, `popover`,
  `tabs`, `sheet` (mobile navigation).
- Forms use native `<select>` and `<input>` elements inside the generated `Label`/`Input`
  wrappers so `FormData` submission and no-JavaScript behaviour stay reliable. The shadcn
  `select` is for non-form controls.
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
- **Sign-in:** a centered single-column card on the page background with the brand, username,
  password, and one primary **Sign in** button. Errors are inline. No app navigation is shown
  until the shopkeeper is signed in.
- **Assistant:** one card with a **Read-only · confirm to save** badge, a scrollable
  transcript, and a composer fixed to the bottom of the card. The empty state shows a short
  prompt and six suggested questions as large tap targets. User messages are right-aligned in
  the teal accent with white text; assistant messages are left-aligned on a white surface.
  Under an answer, show the checks used as small labels ("Checked: Sales summary"). While
  waiting, show a pending bubble ("Checking the shop…") and disable the composer. If the
  provider is not configured, replace the chat with a setup card that shows the three
  environment variables and a local Ollama example. A short privacy note sits below the card.
  Reach the assistant from the dashboard and **More**, not the main navigation.
- **Sale proposal card:** warning-tinted, never the success colour. The heading is
  **Proposed sale — not saved yet**; show the lines, unit prices, subtotal, discount, total,
  payment method, customer, cash received, change, and expiry. The primary action is
  **Confirm sale** (large, teal); **Dismiss** is secondary. The card states plainly that
  nothing is saved and the assistant cannot confirm it. While confirming, disable both buttons
  and show "Recording…". On success, replace the card with a success panel and a **View
  receipt** link; on failure, keep the card and show an inline error. A confirmed card must not
  be confirmable again.
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
- Sign-in errors say "Wrong username or password." and never reveal which field was wrong.
- Assistant errors are inline, short, and actionable: "The assistant is not configured…" or
  "The assistant could not reach the AI provider." Never show a stack trace, a provider body,
  or a raw HTTP status.
- The assistant shows its **Read-only · confirm to save** badge. It has no direct save, edit,
  or delete action; a sale proposal is written only by the shopkeeper's **Confirm sale**
  button.
- Destructive actions require confirmation and name the record being affected.
