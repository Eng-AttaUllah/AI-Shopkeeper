# AI Shopkeeper Assistant

## Overview

AI Shopkeeper Assistant is an offline-first shop management system for a single small
retail shop. It replaces the paper register and the handwritten credit book (khata) with a
fast, phone-friendly application: the shopkeeper records sales in seconds, keeps stock and
prices accurate, tracks customer credit without losing a single entry, and sees sales and
profit reports that can be trusted.

Version 1 is **English-only** and runs entirely on one laptop on the shop's local network.
No internet connection and no paid cloud service are required. Customers, products, sales,
credit, and reports all live in a single local database that is backed up daily.

Phase 6 adds an English assistant that answers shop questions from real database figures.
Phase 7 lets it prepare a sale, expense, khata repayment, customer, product, product edit, or
stock adjustment proposal; the proposal is saved only when the shopkeeper explicitly confirms
it. Later phases add Pashto language support, voice input, and camera-based suspicious-activity
alerts. Those are explicitly out of scope for v1 and must not be built early `(see Scope)`.

## Goals

1. Record a complete sale — items, quantities, discount, and payment type — in under
   30 seconds on a phone screen.
2. Never lose a credit record: every credit sale and every repayment is stored, reversible,
   and auditable.
3. Ensure every reported figure reconciles with the physical cash drawer at end of day.
4. Achieve zero data loss: an automatic daily backup exists and has been restored once in
   testing.
5. Keep stock accurate: stock can never go negative, and every change has a recorded reason.

## Core User Flow

1. The shopkeeper signs in with a username and password.
2. The dashboard opens: today's sales, low-stock items, and total outstanding credit.
3. The shopkeeper adds products with name, unit, cost price, sale price, and opening stock.
4. During the day, the shopkeeper sells: selects items, sets quantity, applies an optional
   discount, chooses **Cash** or **Credit**, and confirms.
5. If the buyer is new and buying on credit, the shopkeeper creates a customer record with a
   name and optional phone number, then attaches the sale to that customer.
6. When a customer pays part or all of what they owe, the shopkeeper records a repayment.
7. At any time the shopkeeper reviews reports: daily, monthly, and yearly sales, sales and
   profit for a single item, top-selling items, and low-stock items.
8. At end of day the shopkeeper enters the counted cash; the app shows the expected amount
   and any difference.
9. A daily backup of the database is written automatically, and the shopkeeper can also
   trigger one manually.

## Features

### Authentication and Access

- Username and password sign-in (Auth.js Credentials provider, hashed passwords).
- Session persists for a working day; sign-out available everywhere.
- A `role` field exists so a second cashier account can be added later without a migration.

### Inventory

- Add, edit, and deactivate products (deactivation instead of deletion).
- Product name, unit of measure (kg, piece, packet, litre), category, and optional barcode.
- Purchase cost and selling price per unit.
- Current stock quantity and a per-product low-stock level.
- Alternative names for the same product (aliases), so search matches common wording.
- Every stock change is recorded as a stock movement with a reason.

### Sales

- Quick-sale screen designed for touch: large item buttons, numeric quantity entry.
- Multiple items per sale, optional per-sale discount.
- Cash or credit payment, with partial payment supported.
- Automatic stock deduction and stock-movement records.
- Printable/on-screen receipt view (sharing and thermal printing come later).
- Sales are never edited: they are voided (which reverses stock and balances) and re-entered.

### Customers and Credit (Khata)

- Customer records with name, optional phone number, and a note.
- Running balance per customer, calculated from credit sales minus repayments.
- Full transaction history per customer.
- Repayment recording, including partial repayments.
- Search by name or phone number.
- A shareable text statement of what a customer owes (WhatsApp-ready text).

### Reporting

- Today, this month, this year, and custom date-range sales totals.
- Gross profit, calculated from the cost price snapshot stored on each sale line.
- Sales and profit for a single product over any date range.
- Best-selling products and slow-moving products.
- Low-stock list and total inventory value.
- Total outstanding credit and a list of customers who owe money.
- Expense totals and net profit for the period.

### Expenses

- Record shop expenses (rent, electricity, salaries, transport, other) with date and note.
- Expense totals feed the net-profit calculation.

### Reliability and Data Safety

- Single-transaction writes for anything that touches both money and stock.
- Audit log entries for every money or stock change.
- Daily automatic database backup plus a manual "Back up now" action.
- Void workflow instead of silent edits.
- End-of-day cash reconciliation.

### Future Phases (not in v1)

- Read-only English assistant (Phase 6, complete).
- Conversational sale, expense, khata repayment, customer, product, product-edit, and stock
  adjustment entry with explicit shopkeeper confirmation (Phase 7 complete).
- Pashto support (Phase 8): conversational assistant in Pashto, Pashto user interface with
  right-to-left layout, product aliases, and Pashto input handling.
- Voice input.
- Camera-based suspicious-activity alerts.
- Face recognition (research only, consent-based).
- Suppliers, purchase orders, returns, multi-shop, thermal printing.

## Scope

### In Scope

- Phases 0 to 5.5 of the implementation plan: environment, products and stock, sales,
  customers and credit, dashboard and reports, expenses and hardening, and sign-in.
- Single shop, single installation, single local database.
- English user interface.
- Laptop as the application host, phone browser as the primary client over local Wi-Fi.

### Out of Scope

- Pashto or any non-English interface, right-to-left layout, and translation layers.
- Voice input and speech recognition.
- The AI assistant and all conversational features in v1. The read-only English assistant
  (Phase 6) and the signed proposals in Phase 7 are separate post-v1 phases.
- Camera, video processing, theft or suspicious-activity detection, and face recognition
  (out of scope for v1; post-v1 Phases 11–12 schedule them).
- Supplier management, purchase orders, and goods returns.
- Multi-shop, multi-branch, or multi-device cloud synchronisation. Deferred to v2 by the
  owner: shop self-registration, customers joining a shop to track their khata, and account
  type chosen at account creation. Direction recorded in progress-tracker.md Open Questions.
- Online payments, card payments, and tax filing.
- Thermal receipt printing and barcode scanner hardware.
- Public internet hosting and remote access.

## Success Criteria

1. A signed-in shopkeeper can add a product and record a sale containing three different
   items in under 60 seconds of interaction time.
2. After a sale, product stock equals its previous value minus the sold quantity, and a
   matching stock-movement row exists.
3. Attempting to sell more than the available stock is rejected with a clear message, and no
   partial record is written.
4. A credit sale increases the customer's balance by exactly the unpaid amount, and a
   repayment reduces it by exactly the paid amount.
5. Voiding a sale restores stock and customer balance to their pre-sale values, and the void
   is visible in the audit log.
6. Dashboard totals for today, this month, and this year match a manual summation of the
   underlying sale records for the same period in `Asia/Karachi` time.
7. Gross profit for a period uses the cost price recorded at the time of each sale, even
   after product cost prices have changed.
8. The counted cash entered at end of day is compared with expected cash, and any difference
   is displayed.
9. A backup file is produced and can be restored to a working database.
10. `npm run build` and `npm test` pass on a clean checkout.

## Phase 6 — Assistant (read-only)

The assistant is an optional, post-v1 feature for the signed-in owner. It answers English
questions about the shop using the same database the screens read.

### Scope

- A `/assistant` chat screen, reachable from the dashboard and the **More** page. The main
  navigation is unchanged.
- Questions about sales, revenue, gross and net profit, expenses, stock, low stock,
  inventory value, slow-moving stock, customer balances, outstanding khata, recent sales,
  and expected cash.
- A provider-agnostic adapter for any OpenAI-compatible chat-completions endpoint,
  configured with `AI_BASE_URL`, `AI_API_KEY` (optional), and `AI_MODEL`. No vendor SDK and
  no cloud account are required by the code.
- An approved list of read-only tools in `src/modules/assistant/tools.ts`. The model never
  generates SQL and never calls an unregistered function.
- A short, in-browser conversation history. Chat messages are not stored in the database.
- A clear setup notice and a plain-language error when the provider is not configured or is
  unreachable. The rest of the app continues to work offline.

### Acceptance Criteria

1. A signed-in owner can ask "How much did I sell today?", "What is low in stock?", "Who owes
   me the most?", "What was my net profit this month?", and "How much cash should be in the
   drawer today?" and receives figures that match the dashboard, reports, and day-close
   screens.
2. The Phase 6 assistant cannot create, edit, void, or delete a record. Every tool is
   read-only, and unknown tools or invalid arguments are rejected before execution. (Phase 7
   adds separately confirmed proposals; it does not weaken this rule.)
3. Answers quote the formatted figures returned by the tools. If the data is missing, the
   assistant says so instead of estimating.
4. With no provider configured, `/assistant` shows setup instructions and the rest of the app
   works normally. A provider failure shows a readable message and never a stack trace.
5. `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` pass.

## Phase 7 — Assistant proposals

Phase 7 lets the signed-in owner ask the assistant to prepare a sale, an expense, a khata
repayment, a customer, a product, a product edit, or a stock adjustment in plain English. The
assistant prepares a signed proposal; nothing is saved until the owner presses the matching
**Confirm** button.

### Scope

- A separate proposal registry with seven tools, none of which writes:
  - `propose_sale` resolves product names, aliases, and barcodes plus a customer name or phone
    for credit sales.
  - `propose_expense` resolves a category (rent, electricity, salaries, transport, other),
    amount, note, and shop date (defaulting to today).
  - `propose_payment` resolves an existing customer by name or phone, reads the current
    outstanding khata balance, and refuses an amount above it.
  - `propose_customer` resolves a new customer and rejects an exact duplicate name or phone.
  - `propose_product` resolves a new product, unit, prices, opening stock, barcode, and
    aliases, and rejects a duplicate name or barcode.
  - `propose_product_update` resolves an existing product and signs both its current snapshot
    and the requested after-state.
  - `propose_stock_adjustment` resolves a product, signed quantity, and reason, and rejects a
    below-zero result.
- Proposal cards in the assistant chat:
  - sale: lines, unit prices, subtotal, discount, total, payment method, customer, cash
    received, change, and expiry;
  - expense: category, amount, date, note, and expiry;
  - payment: customer, amount, khata before, khata after, note, and expiry;
  - customer: name, phone, note, and expiry;
  - product: name, unit, category, cost and sale prices, opening stock, low-stock level,
    barcode, aliases, and expiry;
  - product edit: changed fields with before and after values, and expiry;
  - stock adjustment: product, stock before, signed change, stock after, reason, note, and
    expiry.
  Each card is warning-tinted and labelled "Proposed … — not saved yet".
- A separate confirmation action for each kind. Each verifies a signed, user-bound,
  15-minute token and writes through the existing service:
  - sale: re-prices the draft inside one transaction and rejects a stale price or stock
    change;
  - expense: writes the signed draft and audit row in one transaction;
  - payment: re-reads the derived khata balance inside the transaction and rejects a stale
    balance or an overpayment;
  - customer: writes the signed draft and audit row in one transaction;
  - product: writes the product, its opening stock movement, and audit row in one transaction;
  - product edit: compares the signed before-state with the current row and rejects a stale
    product;
  - stock adjustment: re-reads the current stock and rejects a stale preview or a below-zero
    result.
- Idempotent confirmation: nullable, unique proposal ids on `Sale`, `Expense`, `Payment`,
  `Customer`, `Product`, and `StockMovement` make a replay return the existing row. A product
  edit updates an existing row, so its unique proposal id lives on the audit row.
- An audit entry with the signed-in actor and `details.source = "assistant_proposal"` for
  each confirmed proposal.
- One proposal per assistant answer.

### Acceptance Criteria

1. Asking "Sell 2 kg of sugar for cash" prepares a proposal with the current product price and
   total; the product stock and sale count do not change before confirmation.
2. Asking "Record 500 rupees electricity expense" prepares an expense proposal; no expense or
   audit row exists before confirmation. Confirming writes the expense at shop-local midnight
   and records the signed-in actor.
3. Asking "Ali paid 200 on his khata" prepares a payment proposal with the current balance
   before and after; no payment exists before confirmation. Confirming reduces the balance by
   exactly the amount. A balance change after the proposal is rejected with a readable
   message.
4. Asking "Add a customer named Ali Khan" prepares a customer proposal; no customer exists
   before confirmation. Confirming creates one customer, and a replay returns it instead of
   creating a duplicate.
5. Asking "Add a new product called Rice, 250 cost, 280 sale, 20 kg opening" prepares a product
   proposal; no product or stock movement exists before confirmation. Confirming creates the
   product and one OPENING movement.
6. Asking "Change sugar's sale price to 170" prepares a product-edit proposal with before and
   after values; the product is unchanged before confirmation. If the product changes in the
   meantime, confirmation is rejected as stale.
7. Asking "Add 5 kg of sugar to stock because we restocked" prepares a stock-adjustment
   proposal; stock is unchanged before confirmation. Confirming writes one movement and the
   new cached stock. An adjustment that would take stock below zero is rejected.
8. Each proposal is bound to the signed-in user and expires after 15 minutes. A tampered,
   expired, or wrong-user token is rejected without writing.
9. Confirming the same proposal twice returns the same row and does not change stock, the
   khata, the expense count, the product count, or the movement count twice.
10. The model cannot write or confirm a proposal; it can only prepare one. Unknown or
    ambiguous products and customers, duplicate names or barcodes, missing categories, missing
    customers for credit, insufficient stock, and overpayments produce a readable error or a
    clarifying question.
11. `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` pass.

## Phase 8 — Pashto support

Phase 8 adds Pashto language support to the assistant and the shop interface. No schema
change or migration is required.

### Scope

- A cookie-based locale (`shop_locale`, `en` or `ps`) remembered per browser; no migration.
- `lang`/`dir` attributes on the root `html` element; Pashto uses `dir="rtl"`.
- A Noto Naskh Arabic font for Pashto script, with Geist as the Latin fallback.
- A language switcher in the header (English ↔ Pashto).
- Translated shell, navigation, page headings, buttons, labels, assistant copy, and all
  seven proposal cards. English is the fallback for unverified Pashto strings.
- The assistant system prompt answers in Pashto when the locale is `ps`; tool descriptions
  stay English for the model.
- Text inputs are bidi-safe: names, notes, and search use `dir="auto"`; money, quantity,
  phone, receipt number, and barcode use `dir="ltr"`.
- Unicode text normalization (`src/lib/text.ts`) folds Arabic/Pashto character variants
  (ي/ی, ك/ک, ہ/ه), strips ZWNJ/tatweel/diacritics, converts Arabic-Indic digits to ASCII, and
  lowercases — applied to product/customer search, duplicate detection, and assistant
  resolution.

### Acceptance Criteria

1. Switching the locale cookie changes `lang`/`dir` and all visible strings without a page
   reload losing the choice (cookie persists across refreshes).
2. Pashto pages render right-to-left with no horizontal scrolling on a 360px phone.
3. The assistant answers in Pashto when `ps` is selected, quoting formatted figures exactly.
4. All seven proposal cards render translated labels, buttons, and expiry; confirmation still
   requires explicit shopkeeper action.
5. `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` pass.

## Phase 9 — Voice input

Phase 9 adds spoken commands to the assistant. Spoken audio is converted to text using the
browser's Web Speech API and fed into the existing assistant tool pipeline. No schema change
or migration is required.

### Scope

- A microphone button on the assistant chat (`/assistant`) that starts/stops speech
  recognition via the browser's Web Speech API (`window.SpeechRecognition` /
  `webkitSpeechRecognition`).
- A listening state indicator and live transcript shown while recording.
- Recognition language follows the selected locale: `ps-PK` for Pashto, `en-US` for English.
- On final transcript, the spoken text is submitted to `askAssistantAction` exactly as if it
  were typed; the assistant answers using the same read-only tools and proposal flow.
- Proposals prepared from voice input still require explicit shopkeeper confirmation — voice
  cannot write directly.
- If speech recognition is not supported or not available, the assistant shows a graceful
  fallback (microphone button hidden or disabled with a short message).
- Audio never leaves the laptop; no cloud transcription provider is used.

### Acceptance Criteria

1. A microphone button appears on `/assistant` only when speech recognition is supported.
2. Clicking the button starts listening; a transcript appears; clicking again stops and
   submits the spoken text to the assistant.
3. Voice commands that match existing assistant questions (for example "how much did I sell
   today?") produce answers identical to typing the same question.
4. Voice requests to prepare a sale, expense, payment, customer, product, product edit, or
   stock adjustment produce a signed proposal card requiring explicit Confirm — nothing is
   written by voice alone.
5. On a browser without speech recognition, the microphone button is absent/disabled with a
   short message; the rest of the assistant works normally.
6. `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` pass.

### Out of Scope

- Text-to-speech (assistant speaking back) — not part of "spoken commands".
- Cloud transcription APIs — audio stays on the laptop.
- Voice outside the assistant chat (for example, voice on the sell screen).
- Persisting voice transcripts — chat history remains client state only.

## Phase 10 — Customer accounts

Phase 10 adds two user account types so customers can view their own khata/debt online.

### Scope

- Two user roles on the `User` model: `OWNER` (full access) and `CUSTOMER` (view-only,
  own khata only). `CASHIER` remains in the schema but is not yet built.
- `User.customerId` (nullable, unique) links a `CUSTOMER` user to an existing `Customer`
  record.
- Customer self-registration page (`/customers/sign-up`): name, phone, password. Creates a
  `User` (role `CUSTOMER`) and a `Customer` record in one transaction. Phone is required so
  the customer can be matched to their khata.
- Shopkeeper customer management: from the admin side, the shopkeeper can create customer
  accounts and link them to existing `Customer` records.
- Customer login uses the same `/login` screen. After login, role-based UI: `OWNER` sees the
  full shop interface; `CUSTOMER` sees only their khata view.
- Customer khata view (`/customers/khata`): current outstanding balance, full credit sales
  history (date, receipt number, amount, amount paid), and repayment history (date, amount,
  note). Reuses `customerBalancePaisa` and `customerHistory` queries.
- Permission enforcement: `CUSTOMER` users cannot access sell, products, reports, expenses,
  day-close, backups, audit, or any write path. Server actions enforce role before mutating;
  pages redirect unauthorized users.

### Acceptance Criteria

1. A customer can self-register with name, phone, and password; a `User` (role `CUSTOMER`)
   and `Customer` record are created and linked.
2. The shopkeeper can create a customer account from the admin side and link it to an
   existing `Customer`.
3. A `CUSTOMER` user logging in sees only their khata balance and transaction history, not
   shop data.
4. A `CUSTOMER` user attempting to access shopkeeper-only routes is redirected with an error.
5. `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` pass.

### Out of Scope

- Cashier role permissions (role exists in schema but no UI yet).
- Customer editing their own profile or password inside the app.
- Customer placing orders or making payments through the portal.
- Separate login screen for customers.

## Phase 11 — Camera alerts

Phase 11 adds camera-based suspicious-activity alerts with a saved clip, never automatic
accusation. It is a post-v1 phase (v1's Out of Scope list excludes camera work; this phase
supersedes that exclusion for its own scope).

### Scope

- Camera source (owner decision, 2026-11-04): the laptop webcam (built-in or USB) today; a
  separate or IP camera may replace it later, so the capture reads a configurable device.
- A separate Python + OpenCV process under `services/camera/` captures frames, detects
  motion, writes short clips to `media/camera/`, and posts alert metadata to the app over a
  local HTTP endpoint authenticated with a shared secret (`CAMERA_ALERT_TOKEN`). It holds no
  business data of its own.
- `CameraAlert` rows in SQLite store clip path, capture time, duration, and review state.
  Video bytes never live in the database and never under `public/`.
- Owner-only alerts page (`/alerts`): clips listed newest first, mark reviewed or dismissed;
  clips stream through an authenticated route handler.
- Retention: keep the newest clips and delete older files after posting a new alert; review
  state and audit rows survive clip deletion.
- Never automatic accusation: motion only flags a clip for human review. No face detection or
  recognition (Phase 12 is a separate, consent-based research feature), no person/zone
  detection beyond motion, no cloud upload, no live streaming.

### Acceptance Criteria

1. Running the camera service records a clip on motion and posts an alert; the alert appears
   on `/alerts` for the shopkeeper.
2. The shopkeeper can play a clip, then mark it reviewed or dismissed; the state persists.
3. Only `OWNER` sessions can reach `/alerts` or fetch a clip; `CUSTOMER` sessions and
   anonymous requests cannot.
4. The camera service holds no business data; a missing clip file is handled gracefully.
5. `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` pass.

### Out of Scope

- Face detection or recognition, person/zone detection beyond plain motion.
- Multiple simultaneous cameras (the design allows one configurable device now).
- Cloud upload, push notifications, and live streaming in the browser.
- Customer-visible alerts.

## Implementation Phases

| Phase | Name | Outcome |
| ----- | ---- | ------- |
| 0 | Environment setup | App runs, database connected and verified, tests pass, docs in place |
| 1 | Products and stock | Real shop items with prices and stock can be entered and viewed |
| 2 | Sales | Items can be sold; stock and profit update correctly |
| 3 | Customers and credit | Credit sales, repayments, balances, and statements work |
| 4 | Dashboard and reports | Daily, monthly, yearly, per-item, and profit reporting works |
| 5 | Expenses and hardening | Net profit, voiding, audit log, and backups are complete |
| 5.5 | Sign-in | Username/password sign-in, sessions, route protection, and audit attribution |
| 6 | Assistant (read-only) | Shop questions in English are answered from real database figures |
| 7 | Assistant proposals | Signed sale, expense, repayment, customer, product, product-edit, and stock-adjustment proposals are written only after the shopkeeper confirms them |
| 8 | Pashto support | Pashto UI with right-to-left layout, conversational assistant in Pashto,
| product aliases, and Pashto input handling |
| 9 | Voice input | Spoken commands converted to text via the browser's Web Speech API,
| answered by the existing assistant tool pipeline; proposals still require
| explicit shopkeeper confirmation |
| 10 | Customer accounts | Shopkeeper and customer user roles. Customers self-register or are
| created by the shopkeeper; customers view only their own khata balance and
| transaction history; shopkeeper retains full access |
| 11 | Camera alerts | Suspicious-activity alerts with a saved clip, never automatic accusation |
| 12 | Face recognition | Optional, consent-based research feature |

Phases 0 to 5.5 constitute the sellable v1. Every later phase must be able to reuse the
business logic built in phases 0 to 5.5 without rewriting it.
