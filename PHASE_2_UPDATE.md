# B34ST Staff Workspace — Phase 2 update

## Included in this continuation

- Searchable staff directory with department and active/inactive filters.
- Staff profile pages with public work details.
- Private HR profile retrieval restricted to the profile owner and admin; HR notes are shown only to admin.
- Department labels and directory summaries.
- Onboarding checklist progress summary and role-aware query constraints.
- Announcements navigation available to all active staff, matching read permissions.
- Phase 2 decisions documented in `DECISIONS.md`.

## Before deployment

1. Restore your own development Firebase values in ignored `.env.local` from `.env.example`.
2. Run `npm ci` from the repository root.
3. Run `npm run typecheck`, `npm run lint`, and `npm test` in `apps/web`.
4. Run Firestore emulator rules tests from the repository root using the project's documented emulator setup.
5. Review the rules and test suite before deploying to the development Firebase project.
6. Do not copy service-account credentials into this archive or commit them.

This update has not been production-verified. Dependency installation timed out in the build environment.
