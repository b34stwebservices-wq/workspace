# Phase 4 update — Leads and clients

## Delivered
- Admin and bizops-only lead pipeline with manual entry, contact details, source, stage, notes, next follow-up date, search and stage filter.
- Admin and bizops-only client directory with manual entry, contact details, industry, active/inactive status, notes and search.
- Firestore validation and role gates for both collections.
- Lead updates are limited to changing `stage` and update metadata; deletes are denied. Client updates are limited to authorised admin/bizops users; deletes are denied.
- Audit records for create and lead stage-change actions.

## Security boundaries
- Only active `admin` and `bizops` roles can read/write lead and client records.
- Other staff roles are denied by Firestore rules, not merely hidden navigation.
- No public intake endpoint, bulk export, destructive delete or client-side role assignment was introduced.

## Verification
Run `npm run lint`, `npm run typecheck`, `npm test`, and (when the Firebase Emulator is enabled) `npm run test:rules`. Do not deploy until all checks pass against the target Firebase project.
