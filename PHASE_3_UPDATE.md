# B34ST Staff Workspace — Phase 3 update

## Included

- Employee check-in and check-out with one record per user per local calendar date.
- Personal attendance history and an admin attendance overview.
- Leave request form with type, date range, duration, and reason.
- Requests routed to the employee's configured `userPrivate/{uid}.reportsTo` manager.
- Assigned manager and admin approval/rejection with optional decision notes.
- Owner/approver/admin Firestore access boundaries, immutable attendance history, and audit events.
- Firestore composite indexes for the new query patterns.

## Policy choices and limitations

- Leave duration currently counts calendar days inclusively, including weekends. No balance accrual, public-holiday calendar, or automatic entitlement calculation is implemented because the organisation's leave policy has not been provided.
- Admins can review and decide all leave requests; an employee's configured `reportsTo` manager can decide only requests assigned to them. No one can approve their own request.
- Employees need a valid `reportsTo` UID in their private profile before submitting leave.
- Attendance is not geolocation-verified and should not be represented as proof of physical presence. No location data is collected.

## Before deployment

1. Ensure every employee has a correct `reportsTo` value in `userPrivate/{uid}`.
2. Review the leave types and calendar-day policy with management.
3. Run `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, and Firebase Emulator rules tests.
4. Deploy the updated Firestore rules and indexes only after review and passing tests.
5. Never include service-account credentials or `.env.local` in shared archives.
