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
| Page background | `--bg-base`        | `#FFFFFF` |
| Surface         | `--bg-surface`     | `#FFFFFF` |
| Subtle surface  | `--bg-subtle`      | `#F7FAF9` |
| Mint tint       | `--bg-tint`        | `#ECFDF5` |
| Primary text    | `--text-primary`   | `#17181A` |
| Muted text      | `--text-muted`     | `#6B7280` |
| Primary accent  | `--accent-primary` | `#0F766E` |
| Accent hover    | `--accent-hover`   | `#115E59` |
| Accent soft     | `--accent-soft`    | `#ECFDF5` |
| Money accent    | `--accent-money`   | `#B45309` |
| Money hover     | `--accent-money-hover` | `#92400E` |
| Money soft      | `--accent-money-soft`  | `#FEF3C7` |
| Border          | `--border-default` | `#E5E7EB` |
| Card shadow     | `--card-shadow`    | soft two-layer shadow |
| Error           | `--state-error`    | `#DC2626` |
| Warning         | `--state-warning`  | `#B45309` |
| Success         | `--state-success`  | `#16A34A` |

Usage rules:

- White is the base: the page and every card are white. Cards are separated by the
  `--border-default` hairline plus `--card-shadow` (the `.rounded-xl.border.border-line.bg-surface`
  rule in `globals.css` applies it automatically; inputs and selects use `rounded-lg` and stay flat).
- Primary buttons and active navigation use `--accent-primary` with white text. The active
  section pill uses the mint tint (`bg-brand-soft`).
- The **money accent** (deep amber) marks money moments only: the sell screen's
  "Complete sale" / "Record credit sale" button, the mobile sale total, and the revenue stat
  card's top accent. It is not used for warnings — those stay `--state-warning` (the same hex,
  but a distinct token and meaning).
- Money owed and destructive actions use `--state-error`. Paid and settled use
  `--state-success`. Low stock uses `--state-warning`.
- Status is always reinforced with a label, never colour alone.
- Contrast (AA): white on teal 5.5:1, white on money amber 4.6:1, muted text on white 4.8:1,
  amber on white 4.6:1.

In code, the palette is exposed as Tailwind utilities: `bg-page`, `bg-surface`, `bg-subtle`,
`bg-tint`, `text-ink`, `text-ink-muted`, `bg-brand`, `text-brand`, `bg-brand-soft`,
`text-money`, `bg-money`, `bg-money-soft`, `border-line`, `text-error`, `text-warning`,
`text-success`. shadcn components use their own semantic tokens (`bg-primary`, `bg-muted`,
`border-border`); `globals.css` maps those to the same palette, so `--primary` is the teal
accent, `--muted` is the subtle surface, and `--accent` is soft teal.

## Brand assets

- **Logo:** `public/logo.svg` — the B1 Spine-E app tile from the logo work in
  `logo/easyshop/concepts/b1-spine-e-tile.svg`: a teal (`#0F766E`) squircle tile with a white
  E and a thin spine seam cut inside the stem, on a 48-unit grid. Rendered at 28px in the
  header brand and 32px on the sign-in card, always beside the "AI Shopkeeper" wordmark
  (`alt=""`; the text names the brand).
- **Favicon:** `src/app/icon.svg` is the same artwork; Next.js serves it as `/icon.svg` and
  links it automatically. The old `favicon.ico` was removed.
- Keep the logo's own tile colour rather than recolouring it; it matches `--accent-primary`.
  The source of truth stays in `logo/easyshop/` (the winner is B1; B2 and B3 are alternatives).

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
- **Header and section bar:** every signed-in page shares one top header: the shop name at the
  inline start, the section bar, then the hamburger settings menu, the locale switcher, and the
  signed-in user with sign-out. The brand is the logo tile (`public/logo.svg`, 28px) beside the
  "AI Shopkeeper" wordmark; the same logo appears on the sign-in card (32px). The section bar
  (Dashboard, Sell, Products, Sales, Customers, Reports, More) marks the current section with a
  brand-tinted pill, brand-coloured text, an icon, and `aria-current="page"`; inactive items
  are muted and gain a subtle hover fill. Nested pages keep their parent lit
  (`/customers/123` highlights Customers) and the More tools (assistant, expenses, day close,
  alerts, backups, audit) light More. Customers see the header without the section bar. On
  narrow screens the bar scrolls horizontally instead of wrapping.
- **Assistant:** one card with a **Read-only · confirm to save** badge, a scrollable
  transcript, and a composer fixed to the bottom of the card. The empty state shows a short
  prompt and suggested prompts as large tap targets, including a sale, an expense, a khata
  payment, a customer, a product, and a stock example. User messages are right-aligned in the
  teal accent with white text;
  assistant messages are left-aligned on a white surface. Under an answer, show the checks used
  as small labels ("Checked: Sales summary"). While waiting, show a pending bubble ("Checking
  the shop…") and disable the composer. If the provider is not configured, replace the chat
  with a setup card that shows the three environment variables and a local Ollama example. A
  short privacy note sits below the card. Reach the assistant from the dashboard and **More**,
  not the main navigation.
- **Proposal cards:** warning-tinted, never the success colour. Each card states plainly that
  nothing is saved and the assistant cannot confirm it. While confirming, disable both buttons
  and show "Recording…", "Creating…", or "Saving…" as appropriate. On success, replace the
  card with a success panel and a link to the record; on failure, keep the card and show an
  inline error. A confirmed card must not be confirmable again.
  - **Sale:** heading **Proposed sale — not saved yet**; show the lines, unit prices, subtotal,
    discount, total, payment method, customer, cash received, change, and expiry. Primary
    action **Confirm sale**; secondary **Dismiss**; success link **View receipt**.
  - **Expense:** heading **Proposed expense — not saved yet**; show category, amount, shop
    date, note, and expiry. Primary action **Confirm expense**; secondary **Dismiss**; success
    link **View expenses**.
  - **Payment:** heading **Proposed payment — not saved yet**; show customer, amount, khata
    before, khata after, note, and expiry. Primary action **Confirm payment**; secondary
    **Dismiss**; success link **View customer**.
  - **Customer:** heading **Proposed customer — not saved yet**; show name, phone, note, and
    expiry. Primary action **Confirm customer**; secondary **Dismiss**; success link
    **View customer**.
  - **Product:** heading **Proposed product — not saved yet**; show name, unit, category, cost
    and sale prices, opening stock, low-stock level, barcode, aliases, and expiry. Primary
    action **Confirm product**; secondary **Dismiss**; success link **View product**.
  - **Product edit:** heading **Proposed product change — not saved yet**; show each changed
    field with its before and after value, and expiry. Primary action **Confirm changes**;
    secondary **Dismiss**; success link **View product**.
  - **Stock adjustment:** heading **Proposed stock adjustment — not saved yet**; show the
    product, stock before, signed change, stock after, reason, note, and expiry. Primary action
    **Confirm adjustment**; secondary **Dismiss**; success link **View product**.
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
  or delete action; a proposal is written only by the shopkeeper's matching **Confirm**
  button.
- Destructive actions require confirmation and name the record being affected.
