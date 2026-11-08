# EasyShop

## Overview

EasyShop is a shop management system for small retail shops. It replaces the paper register
and the handwritten credit book (khata) with a fast, phone-friendly application: the
shopkeeper records sales in seconds, keeps stock and prices accurate, tracks customer credit
without losing a single entry, and sees sales and profit reports that can be trusted.

One hosted server serves many independent shops (Phase 13). Each shopkeeper has their own
EasyShop account and owns exactly one shop; a customer has their own account, finds a shop by
its name or by the shopkeeper's username, and joins it to see only their own khata. No
shopkeeper can reach another shop's data, and no customer can see another customer's ledger
or any shop operations. Business data lives in one server database, scoped per shop, and is
backed up daily.

The interface is English with Pashto support. Phase 6 adds an English assistant that answers
shop questions from real database figures. Phase 7 lets it prepare a sale, expense, khata
repayment, customer, product, product edit, or stock adjustment proposal; the proposal is
saved only when the shopkeeper explicitly confirms it. Later phases schedule voice input
(Phase 9), camera alerts (Phase 11), a face-recognition research spike (Phase 12), and
multi-shop accounts (Phase 13).

> **Implementation status.** Phases 0–12 are built and running as a single-tenant
> installation (one shop per server). Phase 13 is specified here and scheduled next; the
> multi-shop behaviour described in this document becomes real unit by unit as Phase 13
> lands. Until then, `docs/progress-tracker.md` holds the live task list. Because the
> platform is now hosted, shops need an internet connection from Phase 13 onward — the v1
> "one laptop, no internet" model is retired by that phase.

## Goals

1. Record a complete sale — items, quantities, discount, and payment type — in under
   30 seconds on a phone screen.
2. Never lose a credit record: every credit sale and every repayment is stored, reversible,
   and auditable.
3. Ensure every reported figure reconciles with the physical cash drawer at end of day.
4. Achieve zero data loss: an automatic daily backup exists and has been restored once in
   testing.
5. Keep stock accurate: stock can never go negative, and every change has a recorded reason.
6. Keep shops isolated: every read and write of business data is scoped to exactly one shop,
   so no shopkeeper can ever reach another shop's data and no customer can ever see another
   customer's ledger.

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

1. Account types are chosen when an account is created (Phase 13): **I run a shop**
   (shopkeeper) or **I'm a customer**. One type per account; a shopkeeper account owns
   exactly one shop.
2. A new shopkeeper signs up, creates their shop with a name, and adds products with name,
   unit, cost price, sale price, and opening stock.
3. A customer signs up with a name, phone, and password; the phone is their username.
4. To join a shop, the customer searches for it by shop name or by the shopkeeper's username
   and sends a join request. The shopkeeper approves it and links the request to an existing
   customer ledger record (matched by phone) or creates one. Until then the customer sees
   nothing of the shop.
5. The shopkeeper signs in with a username and password and lands on the dashboard: today's
   sales, low-stock items, and total outstanding credit for their shop.
6. During the day, the shopkeeper sells: selects items, sets quantity, applies an optional
   discount, chooses **Cash** or **Credit**, and confirms.
7. If the buyer is new and buying on credit, the shopkeeper creates a customer ledger record
   with a name and optional phone number, then attaches the sale to that customer.
8. When a customer pays part or all of what they owe, the shopkeeper records a repayment.
9. The customer opens **My khata** and sees, for each joined shop, the outstanding balance,
   credit sales, and repayments — and nothing else about that shop.
10. At any time the shopkeeper reviews reports: daily, monthly, and yearly sales, sales and
    profit for a single item, top-selling items, and low-stock items.
11. At end of day the shopkeeper enters the counted cash; the app shows the expected amount
    and any difference.
12. A daily backup of the database is written automatically, and the shopkeeper can also
    trigger one manually.

## Features

### Authentication and Access

- Username and password sign-in (Auth.js Credentials provider, hashed passwords).
- Account types, chosen at signup and never changed in-app: **shopkeeper** (creates and runs
  one shop) or **customer** (joins shops). One type per person.
- Membership, not the account type alone, grants shop access: each shop links its users with
  a role (`OWNER` for the shopkeeper, `CUSTOMER` for participants; `CASHIER` stays reserved)
  and a status (`PENDING`, `ACTIVE`, `REMOVED`).
- Shopkeeper access: full control of their own shop; no view of any other shop, and no
  ability to browse other shops.
- Customer access: view-only on the shops they joined — their own khata balance, credit
  sales, and repayments per shop — plus their own account. Searches and join requests only.
- Data boundary: the shopkeeper manages the ledger (a shop's credit sales and repayments) and
  the shop-scoped customer record (name, phone, note). The customer owns their login account
  and profile; the shopkeeper can never edit those.
- Session persists for a working day; sign-out lives in Settings → Security.

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

### Phases After v1

- Read-only English assistant (Phase 6, complete).
- Conversational sale, expense, khata repayment, customer, product, product-edit, and stock
  adjustment entry with explicit shopkeeper confirmation (Phase 7, complete).
- Pashto support (Phase 8, complete): conversational assistant in Pashto, Pashto user
  interface with right-to-left layout, and Pashto input handling.
- Customer khata accounts (Phase 10, complete), extended into multi-shop accounts in
  Phase 13.
- Voice input (Phase 9, complete).
- Camera-based suspicious-activity alerts (Phase 11, complete).
- Face recognition (Phase 12, complete — research only, consent-based).
- Multi-shop accounts (Phase 13): shopkeeper self-registration with their own shop, customer
  accounts that search and join shops, account types chosen at signup, and strict per-shop
  data isolation.
- Suppliers, purchase orders, returns, and thermal printing (unscheduled).

## Scope

### In Scope

- Phases 0 to 13 of the implementation plan (see the phase sections below and the phase
  table): environment, products and stock, sales, customers and credit, dashboard and
  reports, expenses and hardening, sign-in, assistant and proposals, Pashto with RTL, voice
  input, customer khata accounts, camera alerts, the face-recognition research spike, and
  multi-shop accounts.
- A hosted deployment serving many independent shops on one server, with strict per-shop
  data isolation.
- English and Pashto user interfaces.
- Phone browser as the primary client; shopkeepers' shops reach the app over the internet.

### Out of Scope

- Camera features beyond Phase 11 (no person/zone detection beyond motion, no cloud upload,
  no live streaming) and face recognition beyond the Phase 12 research spike (no product
  UI, no cloud face APIs).
- Supplier management, purchase orders, and goods returns.
- Online payments, card payments, and tax filing.
- Thermal receipt printing and barcode scanner hardware.
- Per-shop offline operation, an offline-first or local-only deployment of the multi-shop
  model, and offline synchronisation. Phase 13's model is deliberately hosted; a shop
  without internet cannot use the platform.
- Multiple shops per shopkeeper, a shopkeeper joining other shops as a customer, changing
  one's account type in-app, and any social features beyond shop discovery and joining.
- PostgreSQL: SQLite is kept for Phase 13; the database decision is revisited when shop
  count or write volume demands it (see Architecture Decisions).
- Assistant chat history persistence (needs a retention and privacy decision).
- Email verification or password-reset email for accounts (recovery is a later decision).

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
11. Two shopkeepers on the same installation can never read or modify each other's products,
    sales, customers, or reports; a customer sees only their own khata at the shops they
    joined, and no other customer's data in any screen, action, or assistant answer.

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
- Superseded by Phase 13 (2026-11-08): self-registration and the khata view move to the
  account-type signup and the membership model — `/sign-up` replaces `/customers/sign-up`,
  `/khata` replaces `/customers/khata`, and `User.customerId` moves into
  `ShopMembership.customerId`. This section remains the record of what was built in v1.

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

## Phase 12 — Face recognition research spike

Phase 12 is a research spike, not a product feature: prove whether local, offline face
detection, embedding, and matching work well enough on the shop laptop to justify building
something real later. The deliverable is a findings report with a go/no-go recommendation.

### Scope

- Goal (owner decision, 2026-11-04): a local pipeline — detect a face, compute an embedding,
  match against enrolled faces — evaluated honestly at counter-like distance and lighting.
  No product UI, no Phase 11 alert integration, no counter identification in this phase.
- Consent (owner decision): the eventual product direction is shopkeeper-enrolls-with-consent
  with a visible consent step. For the spike, only the owner's and consenting staff faces
  are enrolled.
- Biometric data (owner decision): numeric embedding plus the reference photo, both
  deletable on request; deletion is demonstrated before the spike ends. Embeddings are not
  reversible to a photo; photos never leave the laptop.
- Implementation: a separate process under `services/face/` (same boundary as the camera
  service), using OpenCV's YuNet face detection and SFace embedding models — fully offline
  after a one-time model download. The Next.js app never runs models.
- Findings report: match quality numbers, failure modes (lighting, angle, distance), storage
  and deletion behaviour, and a clear go/no-go recommendation for a future product feature.

### Acceptance Criteria

1. The pipeline runs fully offline on the shop laptop after a one-time model download.
2. A small consented test set is enrolled and probe photos are matched against it, with
   measured results recorded in the findings report.
3. Deleting an enrolled face removes both the embedding and the reference photo, verified
   before the spike ends.
4. No product UI, no alert integration, no cloud calls; biometric data stays on the laptop.
5. `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` still pass (the
   spike touches no app code).

### Out of Scope

- Any UI integration: alert-clip labeling, counter identification, customer self-enrollment.
- Cloud face APIs of any kind.
- Automatic accusation or naming a person in any product surface.
- Liveness detection or anti-spoofing (researched only if the spike succeeds).

## Phase 13 — Multi-shop accounts

Phase 13 converts EasyShop from one installation serving one shop into a hosted platform
serving many independent shops. Multi-shop was deferred to v2 by the owner and is now
scheduled; on 2026-11-08 the owner chose: a central deployment with shop discovery, one
account type per person, shopkeeper-approval joining, and a ledger-only shop reach into
customer data.

### Scope

- **Hosting.** One deployment serves every shop over the internet; the single-shop v1 model
  is retired by this phase. HTTPS termination, secure session cookies, and off-server
  backup copies become part of deployment.
- **Account types.** At signup a person chooses **shopkeeper** or **customer**; one type per
  account, unchanged in-app. A shopkeeper account owns exactly one shop; a customer may join
  many shops.
- **Membership.** A `ShopMembership` table links a user to a shop with a role (`OWNER`,
  `CUSTOMER`; `CASHIER` stays reserved) and a status (`PENDING`, `ACTIVE`, `REMOVED`). The
  customer role carries the unique link to the shop-scoped ledger record. `User.customerId`
  from Phase 10 moves into the membership.
- **Tenant isolation.** Every business table carries `shopId` (Product, Customer, Sale,
  StockMovement, Payment, Expense, AuditLog, CashReconciliation, CameraAlert; SaleItem and
  ProductAlias stay reached through their parent), with scope-checked uniqueness
  (`shopId + normalized product name`, `shopId + barcode`, `shopId + sale number`,
  `shopId + business day`). Invariant 13 is added to `architecture.md`.
- **Signup.** `/sign-up` selects the account type. The shopkeeper form creates the user, the
  shop, and the `OWNER` membership in one transaction; the customer form creates the user
  only (name, phone as username, password). Password and username rules stay as v1.
- **Discovery and joining.** Customers search by shop name or by the shopkeeper's username;
  results show shop name, owner username, and join state only. A request creates a
  `PENDING` membership. The shopkeeper approves and links the request to an existing ledger
  `Customer` (matched by phone) or creates one; the membership becomes `ACTIVE`. The
  customer sees nothing until linked. Reject, leave, and removal are recorded; leaving
  keeps the ledger record with the shop.
- **Screens.** Customer: `/khata` (joined shops with per-shop balances), `/khata/[shopId]`
  (that shop's balance, credit sales, repayments), `/shops` (search and request). Shopkeeper:
  join requests under settings with approve/link/create/reject, plus everything from v1.
  Shopkeepers see the whole shop; customers never see shop operations.
- **Sessions and guards.** The JWT carries the account type, never a shop id; the shop is
  resolved per request from membership. `requireShopkeeper()` and
  `requireCustomerShop(shopId)` replace `requireOwner()` and the `customerId` shortcut.
  Rate limiting protects login, signup, search, and join requests.
- **Assistant.** Tools receive the shop from the server context, never from the model;
  proposal tokens are bound to the user and the shop, and each confirmation verifies both.
- **Audit.** Every audit row carries the shop it belongs to, backfilled for legacy rows.
- **Migration.** All existing users and business rows are backfilled to the existing shop;
  the seeded owner becomes its `OWNER`; existing `CUSTOMER` users become `ACTIVE`
  memberships. Two staged migrations keep every commit buildable (nullable `shopId` first,
  required `shopId` with composite uniques and the `accountType` move afterwards). No data
  is lost; the seed stays idempotent.

### Acceptance Criteria

1. A shopkeeper self-registers, creates their shop, and signs in; they see only their shop.
2. A customer self-registers, searches by shop name or shopkeeper username, requests to
   join; the shopkeeper approves and links a ledger record; the customer then sees their own
   khata for that shop.
3. A customer in two shops sees both khata balances and only their own transactions; a
   pending or rejected requester sees nothing about the shop.
4. Neither a shopkeeper nor a customer can read or write another shop's data through any
   screen, server action, route handler, or assistant tool; isolation is covered by a test
   for every module.
5. Customers cannot reach shopkeeper routes or actions, and vice versa; the account type is
   fixed at signup.
6. An existing database migrates without loss; the seeded owner and Phase 10 customer
   accounts keep working through the membership model.
7. Product names and barcodes, sale receipt numbers, cash checks, and searches are scoped
   per shop, while usernames stay platform-wide unique.
8. Every audit entry carries its shop.
9. `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` pass.

### Out of Scope

- Multiple shops per shopkeeper; a shopkeeper joining other shops as a customer; changing
  account type in-app.
- Per-shop offline operation, offline-first synchronization, or a local-only deployment of
  the multi-shop model.
- PostgreSQL (kept on SQLite for this phase; see Architecture Decisions).
- Automatic per-shop camera routing: the camera intake keeps one `CAMERA_SHOP_ID` for now;
  per-shop camera tokens are a later decision.
- Per-shop backup, export, or restore: backups remain whole-database.
- Social features beyond discovery and joining (no feeds, reviews, or messaging).
- Email verification or password-reset email; account recovery is a later decision.

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
| 13 | Multi-shop accounts | Hosted multi-shop platform: shopkeeper and customer account types, shop discovery and joining, strict per-shop data isolation |

Phases 0 to 5.5 constitute the sellable v1. Every later phase must be able to reuse the
business logic built in phases 0 to 5.5 without rewriting it.
