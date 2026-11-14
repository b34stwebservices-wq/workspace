# Fix pass: user management and related bugs

## User management (Staff access, /admin/access)
- Full roster: name, email, title, role, department, status. Previously only raw UIDs.
- Add staff: new account (strong password generator) or grant a role to an existing Auth UID.
- Edit profile, role/department, active status and HR details (phone, start date, reports-to, ...) in one atomic save.
- Remove/restore access, send password reset, flags for missing profile / manager / HR record.
- Guards: cannot change own access, cannot remove the last active admin, department is fixed by role (except employees).

## Bugs fixed
1. Register user always failed: the `users` write omitted the timestamps the rules require, so the batch was rejected after the Auth account had been created, leaving an orphan. Creation now rolls back the Auth account on failure and signs out of the secondary auth instance.
2. "Sync profile" wrote a fake `@local-user.test` profile that the rules rejected. Removed; profiles are created properly.
3. `userPrivate` was never written anywhere, so nobody could request leave ("reports to" missing). Now editable by admins.
4. Deactivating a role left `users.status` "active". Both are now updated together; disable-user script syncs too; new enable-user script.
5. Auth session was read once; removing access had no effect until reload. Now a live subscription. Cache is cleared on sign-in/out.
6. /access-denied showed the full app shell to signed-out visitors. Now a standalone page with sign-out; unknown URLs redirect home.
7. Employees' task queries asked for a department they cannot read, so Firestore rejected the whole query. Fixed.
8. Task creation was rejected by the rules (`priority`, `dueDate` not allowed). Rules updated.
9. Bizops hit permission errors on Leave and Attendance (unscoped queries). Review/list is admin-only; approvers still see their assigned requests.
10. Digital ops could approve content, contradicting the RBAC matrix. Approve/reject is now admin-only in rules and UI.
11. Onboarding asked for a raw staff UID; now a staff picker.
12. bootstrap-admin created no directory profile.
13. Login shows specific messages for disabled accounts / rate limiting and redirects if already signed in.

## Deploy
`firebase deploy --only firestore:rules` (rules changed). Nothing else to migrate.

## Not done / caveats
- Firestore emulator rules tests were not run (emulators are disabled in this project). Test the new flows against a dev project before prod.
- Removing access in the app blocks the user immediately but cannot disable the Auth login itself (needs the Admin SDK): use `npm run disable-user`.
- I did not audit every line of Finance, Projects, Reports and Notifications beyond comparing their writes to the rules.

---

# Second pass: the rest of the pages

## Finance
- Invoice status dropdown offered `partial`/`paid`/`void`, which the rules rejected (or which corrupted totals). Now only `unpaid`/`overdue`/`void` can be set by hand; partial/paid follow recorded payments, and the dropdown locks once money is recorded. `void` is now allowed in the rules (only with no payments), and void invoices cannot take payments.
- Float rounding: amounts are rounded to 2 dp and the rules compare with a 0.005 tolerance, so 0.1+0.2-style sums no longer break "paid".
- Duplicate invoice/quotation numbers and due-before-issue dates are blocked.

## Leads and Clients
- Lead "Source" options (Cold outreach, Event, Social) were rejected by the rules. Fixed.
- Leads and clients could not be edited after creation (typos, follow-up dates, deactivation were impossible). Added Edit; lead rules now allow full edits, not just stage.
- Email format validated.

## Projects
- Team, manager, dates, brief, client could not be changed after creation. Added Edit project.

## Tasks and Dashboard
- Both now use one shared loader. Tasks assigned to you from another department were invisible to bizops/digitalops/designers; admin task lists were arbitrary 100 rows, now newest first (300).

## Leave and Attendance
- Overlapping leave requests are blocked.
- Attendance used the device timezone for the day key; now Africa/Lusaka everywhere (also overdue checks in Finance/Projects/Notifications/Reports). Admins' own check-in state no longer depends on the 150-row org list.

## Notifications and Reports
- Void invoices were counted as overdue/outstanding. Fixed.
- Failed reads were silently shown as zero; now a warning says which sources failed.
- Admins now see all pending leave, not only requests naming them as approver. Approval prompts go to admins only.
- CSV download no longer revokes the file URL before the browser reads it.

## Announcements, Audit, Directory
- "Posted by" showed a UID fragment; now the name. Admins can delete announcements. Audit shows user names for targets. Directory no longer crashes on profiles without a name.

## Still open
- Onboarding items can only be ticked by admin/bizops, not by the new hire.
- Tasks cannot be edited/reassigned after creation (rules allow it; no UI yet).
- Deploy `firestore.rules` again; rules were not run against the emulator.
- Rules: replaced the invalid `.{1,2040}` URL regex (RE2 caps repetition at 1000) with `.+`; length is already capped by size() checks.

---

# Third pass: Digital Operations
- Campaign channel picker offered "Website", which the rules reject for campaigns; removed from that picker.
- Rejecting content now requires written feedback (stored as `reviewerNote`) and the author sees it on the post. Before, rejections gave no reason.
- Scheduling a post without a scheduled date is blocked (it would never appear on the calendar).
- Admins who authored a post now see "waiting for another admin" instead of a silently missing Approve button.
- Calendar month defaults to the Zambia month (was UTC) and no longer breaks if the month input is cleared.
