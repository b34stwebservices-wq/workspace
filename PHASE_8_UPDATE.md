# Stage 8 — Reporting, Notifications & Management Intelligence

## Delivered

- Added a role-protected `/reports` page for Admin, BizOps and Digital Operations.
- Reports combine records available through existing Firestore permissions: task status, project portfolio, receivables, lead pipeline, campaign funnel and website-request workload.
- Added ZMW outstanding-receivables calculations (invoice amount less recorded payments), overdue invoice counts, task completion distribution, campaign click-through rate, leads and conversions.
- Added CSV export for the report's loaded records. CSV cells are quoted and formula-prefixed values are escaped to reduce spreadsheet formula-injection risk.
- Added `/notifications`, an in-app attention centre available to active staff. It derives reminders from assigned open tasks, leave approvals assigned to the current user, overdue invoices and projects, pending social-content approvals, due scheduled content and open website requests.
- Added navigation and dashboard quick-access links for Notifications and Reports.
- Kept the existing React + TypeScript + Firebase client architecture and Firebase Spark-tier constraints.

## Data and access model

Stage 8 introduces no new Firestore collections and does not widen Firestore rules. Reports and notifications read existing collections through their existing rules. The client uses queries aligned with those rules:

- Tasks: current user's `assigneeId` for notifications; role-appropriate department scope for reports, with Admin reading the permitted collection.
- Leave: `approverId == current uid` for pending decisions.
- Finance and projects: Admin/BizOps only.
- Digital campaigns, social posts and website requests: Admin/Digital Operations; Designers read their own posts; employees read their own website requests.

The report page is route-protected to Admin, BizOps and Digital Operations. The notifications page is available to all active roles. Existing deny-by-default Firestore rules remain authoritative; hiding navigation is not treated as security.

## Indexes and cost controls

- No new composite indexes are required. Added queries use single-field equality filters supported by Firestore automatic indexes.
- Reads are capped at 500 documents per report collection and 200 per notifications collection to limit accidental unbounded reads. The report UI identifies its figures as loaded/accessible records.
- No Cloud Functions, scheduled functions, Firebase Extensions, Analytics SDK, external API, email/SMS provider or paid infrastructure is added.

## Notification semantics and limitations

- Notifications are derived when the user opens or refreshes the page. They are not persisted as a notification inbox and do not send push, email or SMS messages.
- The app does not create background scheduled reminders. That would require a trusted server-side scheduler (for example Cloud Functions/Cloud Scheduler) and explicit approval of the required billing plan and notification provider.
- Task records currently do not have a due-date field in the Firestore task schema, so the attention centre reports open assigned tasks as informational rather than inventing due-date alerts.
- Attendance alerts are not inferred because there is no organisation-wide shift schedule or expected-hours policy to determine a missed check-in safely.
- Campaign performance is based on manually entered metrics, not live platform ingestion.

## Deployment and verification

1. No new Firestore rules or indexes are required for Stage 8; retain the current Stage 7 rules and indexes.
2. Run `npm ci`, then `npm run typecheck`, `npm run lint`, `npm run test` and `npm run build` in a complete Node 20–22 environment.
3. Test each role with separate accounts and verify query permissions: admin, bizops, digitalops, designer and employee.
4. Confirm that report exports contain only records visible to the signed-in role.
5. Confirm no scheduled/push notifications are expected from this client-only implementation.

## Verification status in this delivery environment

- Source syntax parsing and archive integrity are checked during packaging.
- `npm ci --ignore-scripts --prefer-offline` timed out. The partially populated `node_modules` tree is incomplete.
- `npm run typecheck` was attempted and stopped on missing type definition packages (including React and Node types) caused by the incomplete dependency installation. ESLint, unit tests and production build could not be reliably run.
- Firebase Emulator tests were not run; the existing project direction disables the rules-test script.

This archive is a development handoff, not a production-certified release.
