# Decisions

## Phase 0–1

- The supplied `instructions(1).md` and `B34ST Staff App RBAC Matrix.md` are the working equivalents of the named instruction and RBAC files. No separate project plan was supplied.
- The target is `b34st_stuff_app/` inside the provided workspace; writing to absolute `/b34st_stuff_app` is outside the permitted workspace.
- Spark projects cannot use Firebase Authentication SMS MFA: Firebase requires a linked Cloud Billing account for SMS, and Firebase MFA is an Identity Platform feature. The Phase 1 fallback is mandatory staff Google accounts with Google 2-Step Verification verified during onboarding. Email/password login remains for the requested flow; a future identity-policy decision is required before Google sign-in is enabled.
- Access is enforced from `roles/{uid}`, not custom claims. The RBAC document's claims/functions/storage mechanisms are replaced by the explicit Spark-tier mechanism in the build instructions.
- `auditLogs` is client create-only for active users because the build instructions override the matrix's Cloud Function-only mechanism. Rules require `actorId` to match the authenticated user and `createdAt` to be the server request time.
- Future-phase collections intentionally fall through to deny-by-default. Their denial paths are covered now; their allowed rules are deferred to their phase.
- A role assignment is allowed only for an existing active admin and never the acting admin's own role. The first admin is created only by the local Admin SDK bootstrap script.

## Phase 2

- Phase 2 was started on the user's subsequent instruction. Dependencies remain at their current pinned versions; the prior audit findings were recorded but not auto-upgraded because the user directed that modules be kept.
- Onboarding is visible only to its subject, Business Operations, and admins. Business Operations and admins create and maintain checklist records; only admins delete them.
- Announcements are readable by every active staff member. Admins and Business Operations can publish them, while Business Operations can update only announcements they authored.
- Firebase Emulator execution is disabled by the user's direction. The existing rules tests remain in the repository but are not run locally or in CI. The supplied `b34stweb-management` Firebase configuration is stored only in ignored `.env.local`; Analytics is not initialized to avoid collecting internal staff-app usage data by default.

## Phase 2 continuation (14 Nov 2026)

- Expanded the staff directory with search, department and employment-status filters, active-staff summaries, and links to individual work profiles. Directory records contain public work information only.
- Added individual staff profile pages. Public profile data is visible to active staff; `userPrivate/{uid}` is requested only for the profile subject or an admin, with Firestore rules remaining the authority. HR-only notes are displayed to admins only.
- Fixed onboarding queries so non-admin/non-bizops users query only their own `subjectId`; Firestore rules are not query filters, so an unscoped collection query would be denied for those roles.
- Made Announcements discoverable to all active staff because the rules permit all active staff to read published announcements; authoring controls remain restricted by Firestore rules to admin and bizops.
- No new collections or external services were introduced. Existing Phase 2 onboarding and announcement rules/tests remain in place. Full TypeScript/build verification remains blocked because dependency installation did not complete in this environment; do not deploy until `npm ci`, typecheck, lint, and emulator rules tests pass locally/CI.


## Phase 3 (14 Nov 2026)

- Added attendance check-in/check-out records keyed by authenticated UID and local calendar date. Staff can read only their own attendance; admins can read organisation records. Attendance is append/check-out only from the client; deletion and edits are denied.
- Added leave requests with employee ownership, an assigned approver copied from the employee's private `reportsTo` profile field, and admin fallback approval. The assigned approver or admin can approve/reject; self-approval is denied. Employees can read their own requests and requests assigned to them as approver.
- Leave duration is inclusive calendar days (weekends included); no automatic leave balance or public holiday calculation is claimed. Leave balance policy and working-day calendars remain business decisions.
- Added attendance and leave indexes. No paid Firebase services or external services were introduced.
- Attendance and leave rules are deny-by-default outside the explicit role/ownership paths. Firestore Emulator verification and complete build checks remain required before deployment.
