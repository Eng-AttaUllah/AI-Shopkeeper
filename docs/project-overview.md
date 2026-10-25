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

Later phases add a conversational assistant, Pashto language support, voice input, and
camera-based suspicious-activity alerts. Those are explicitly out of scope for v1 and must
not be built early `(see Scope)`.

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

- AI assistant that answers shop questions in English, then Pashto.
- Conversational transaction entry with explicit shopkeeper confirmation.
- Voice input.
- Camera-based suspicious-activity alerts.
- Pashto user interface and right-to-left layout.
- Face recognition (research only, consent-based).
- Suppliers, purchase orders, returns, multi-shop, thermal printing.

## Scope

### In Scope

- Phases 0 to 5 of the implementation plan: environment, products and stock, sales,
  customers and credit, dashboard and reports, expenses and hardening.
- Single shop, single installation, single local database.
- English user interface.
- Laptop as the application host, phone browser as the primary client over local Wi-Fi.

### Out of Scope

- Pashto or any non-English interface, right-to-left layout, and translation layers.
- Voice input and speech recognition.
- The AI assistant and all conversational features.
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

## Implementation Phases

| Phase | Name | Outcome |
| ----- | ---- | ------- |
| 0 | Environment setup | App runs, database connected and verified, tests pass, docs in place |
| 1 | Products and stock | Real shop items with prices and stock can be entered and viewed |
| 2 | Sales | Items can be sold; stock and profit update correctly |
| 3 | Customers and credit | Credit sales, repayments, balances, and statements work |
| 4 | Dashboard and reports | Daily, monthly, yearly, per-item, and profit reporting works |
| 5 | Expenses and hardening | Net profit, voiding, audit log, and backups are complete |
| 6 | Assistant (read-only) | Shop questions in English are answered from real database figures |
| 7 | Assistant actions | Proposed sales and records require explicit confirmation |
| 8 | Pashto support | Pashto interface, product aliases, and Pashto input handling |
| 9 | Voice input | Spoken commands, after testing on real Pashto speakers |
| 10 | Camera alerts | Suspicious-activity alerts with a saved clip, never automatic accusation |
| 11 | Face recognition | Optional, consent-based research feature |

Phases 0 to 5 constitute the sellable v1. Every later phase must be able to reuse the
business logic built in phases 0 to 5 without rewriting it.
