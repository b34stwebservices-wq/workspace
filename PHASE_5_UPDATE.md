# B34ST Staff Workspace 2.0 — Stage 5

## Delivered
- Project portfolio route and navigation.
- Admin/BizOps project creation with optional client association.
- Project manager and team-member UID assignment.
- Project status, priority, start date and target date.
- Milestone checklist with due dates and completion tracking.
- Computed progress indicator, overdue indicator, search and status filters.
- Member-scoped project reads and management-only writes in Firestore rules.
- Composite index for member-scoped project portfolio sorting.
- Audit events for project creation, status changes and milestone changes.

## Data model
Collection: `projects`.

Documents contain `name`, `clientId`, `clientName`, `description`, `status`, `priority`, `startDate`, `dueDate`, `managerId`, `memberIds`, `milestones`, and standard creation/update metadata. Milestones are bounded embedded records `{ id, title, dueDate, done }`.

## Deployment notes
1. Publish the Firestore rules and indexes from this archive.
2. Use valid Firebase Authentication UIDs in the manager/team member fields.
3. Add each staff member who needs project visibility to `memberIds`.
4. Run build, lint, typecheck and Firestore emulator tests before production deployment.

## Known limitations
- Team assignment uses UID entry rather than a searchable staff picker.
- Milestones are checklist records, not independently permissioned task documents.
- Project updates are limited to Admin and BizOps; assigned members have read access only.
- No file uploads, timesheets, budget tracking or Gantt timeline in this phase.
