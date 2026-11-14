# B34ST Staff Workspace 2.0 — Stage 6

## Delivered
- Admin/BizOps-only finance workspace at `/finance`.
- Create quotation and invoice records linked to existing clients.
- ZMW amount display and finance summary cards.
- Track quotation status (draft, sent, accepted, rejected).
- Record partial or full invoice payments with date, method and reference.
- Payment records are append-only; the UI explicitly does not process transfers.
- Search and filter finance records.
- Audit events for record creation, status changes and payment recording.
- Firestore rules validate finance record shapes, role access, immutable commercial fields and append-only payments. Payment creation requires an atomic corresponding invoice balance increase via `getAfter`.

## Collections
- `financeRecords`: quotation/invoice metadata and current paid amount.
- `financePayments`: immutable payment entries linked to an invoice.

## Deployment
1. Deploy updated `firebase/firestore.rules`.
2. No new composite index is required; records use `updatedAt` ordering and clients use `company` ordering.
3. Build and run tests before production deployment.
4. Verify finance records and payment entries against the organisation's accounting process. This module is a record-keeping ledger, not a payment gateway, tax engine, or accounting compliance system.

## Limitations
- Reference numbers are not server-generated or guaranteed unique; establish a controlled numbering policy before production use.
- No PDF generation, tax/VAT calculations, credit notes, bank reconciliation, payment gateway integration or automated reminders in this stage.
- A payment entry is immutable; corrections require a separately designed reversal workflow rather than editing historical entries.
