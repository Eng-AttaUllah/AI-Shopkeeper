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
- Conversational assistant in Pashto (Phase 8).
- Voice input.
- Camera-based suspicious-activity alerts.
- Pashto user interface and right-to-left layout.
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
- Camera, video processing, theft or suspicious-activity detection, and face recognition.
- Supplier management, purchase orders, and goods returns.
- Multi-shop, multi-branch, or multi-device cloud synchronisation.
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
| 8 | Pashto support | Pashto interface, product aliases, and Pashto input handling |
| 9 | Voice input | Spoken commands, after testing on real Pashto speakers |
| 10 | Camera alerts | Suspicious-activity alerts with a saved clip, never automatic accusation |
| 11 | Face recognition | Optional, consent-based research feature |

Phases 0 to 5.5 constitute the sellable v1. Every later phase must be able to reuse the
business logic built in phases 0 to 5.5 without rewriting it.
