# B34ST Staff App: RBAC Matrix

**Companion to:** B34ST Staff App Project Plan (updated) | **Status:** Draft for sign-off | **Updated:** 13 Nov 2026

This is the permission spec the app is built from. It maps directly to Firebase custom claims, Firestore rules, and Storage rules. Nothing in Phase 1 is coded until this is signed off.

**Principle:** least privilege. A job title grants nothing by itself. Every permission below is enforced server-side (rules and Cloud Functions). Hiding a button is not security.

## 1. Roles and claims

Each user gets two custom claims, set only by an admin-triggered Cloud Function.

| Role key | Title | Department claim | Intended user |
| --- | --- | --- | --- |
| `admin` | CTO | `technical` | Rennie Kawangu, plus any explicitly authorised admin |
| `bizops` | Business Operations Officer | `business` | Business Administration graduate |
| `digitalops` | Digital Operations Officer | `digital` | Lubinda Noyi |
| `designer` | UI/UX & Graphic Designer | `creative` | Design team member |
| `employee` | Employee / intern | per person | Other staff |

Claim shape: `{ role: "digitalops", dept: "digital" }`. One role per user. A user with no role claim has no access to anything.

## 2. Legend

- **C** create, **R** read, **U** update, **D** delete
- **own** only records where the user is the owner or subject
- **assigned** only records the user is assigned to or a member of
- **—** no access (rule denies)

## 3. Collection matrix

| Collection | admin | bizops | digitalops | designer | employee |
| --- | --- | --- | --- | --- | --- |
| `users` (public profile: name, jobTitle, department, work email, status) | CRUD | R | R | R | R |
| `userPrivate` (phone, employmentType, reportsTo, startDate, emergency contact, HR notes) | CRUD | — | R own | R own | R own |
| `onboarding` (checklists, recruitment records) | CRUD | CRU | R own | R own | R own |
| `tasks` | CRUD | CRU in `business`; U status if assigned | CRU in `digital`; U status if assigned | CRU in `creative`; U status if assigned | R assigned, U status only |
| `attendance` | R all | — | CR own | CR own | CR own |
| `leave` | R all, approve | — | CR own | CR own | CR own |
| `announcements` | CRUD | C, U own | R | R | R |
| `leads` | CRUD | CRU | — | — | — |
| `clients` | CRUD | CRU | — | — | — |
| `projects` | CRUD | CRU | R assigned | R assigned | R assigned |
| `timeEntries` | R all | R all | CRU own | CRU own | CRU own |
| `quotations` | CRUD | CRU | — | — | — |
| `invoices` | CRUD | CRU (no D); field scope TBD | — | — | — |
| `contentCalendar` | CRUD, approve | R | CRU, see workflow rules | R, U assets and own design status | — |
| `websiteUpdates` | CRUD, approve | R | CRU, cannot self-approve | R | — |
| `brandAssets` (metadata) | CRUD | R | R | CRU | R approved only |
| `documents` | CRUD | CRU where `allowedRoles` includes bizops | R where allowed | R where allowed | R where allowed |
| `auditLogs` | R | — | — | — | — |
| `settings` | CRUD | — | — | — | — |

Notes:

- Rules work per document, not per field. That is why `users` is split in two: anything sensitive lives in `userPrivate`, never in the public profile.
- No role other than `admin` can delete business records. Others archive by setting `status`.
- `auditLogs` and role claims are written by Cloud Functions only. No client can write them, admin included.
- `leads` and `clients` hold third-party contact data, so Digital Operations and Design get nothing there by default. Add aggregate counts through a function later if they need lead numbers.

## 4. Storage matrix

| Path | admin | bizops | digitalops | designer | employee |
| --- | --- | --- | --- | --- | --- |
| `/brand/` (approved logos, templates) | RW | R | R | RW | R |
| `/design/{projectId}/` | RW | — | R if member | RW if member | R if member |
| `/content/` (drafts, creatives) | RW | R | RW | RW | — |
| `/business/` (quotes, contracts, reports) | RW | RW | — | — | — |
| `/hr/` (contracts, IDs) | RW | — | — | — | — |
| `/avatars/{uid}` | RW | R | R | R | RW own |

Set file type and size limits on every path. Public read is never enabled.

## 5. Workflow rules (the parts a matrix cannot show)

### Content calendar

1. Digitalops or designer creates the item as **Draft**.
2. Digitalops moves it to **Review** once copy and creative are attached.
3. **Admin approves** it (default approver, see open decisions).
4. Digitalops moves **Approved → Scheduled → Posted**.

Digitalops cannot set `Approved` and cannot edit an item after approval except to schedule or post it. Any content edit after approval sends it back to Review.

### Website updates

`Requested → In progress → Pending approval → Approved → Completed` with `evidenceUrl` required on completion. Digitalops cannot approve their own change. The log never stores passwords, keys or tokens.

### Leave

Employee creates. Approver is the person in their `reportsTo`, or admin. Nobody approves their own leave.

### Disabling or changing a user

A Cloud Function sets the claim, writes an audit entry, and revokes refresh tokens so the old role stops working immediately. Claims otherwise only refresh on the next token renewal.

## 6. Access outside the app

The matrix only controls what happens inside the app. It does nothing about direct access to the infrastructure behind it. Keep a separate register and default everything to **no**.

| System | admin | bizops | digitalops | designer |
| --- | --- | --- | --- | --- |
| Firebase console / IAM | Owner | No | No | No |
| Vercel team | Owner | No | No | No |
| GitHub org | Owner | No | No | Design repo only, if needed |
| Cloudflare / domain | Owner | No | No | No |
| Website admin dashboard | Yes | No | Yes, approved scope | No |
| Social accounts and Metricool | Yes | No | Yes | Draft only |
| Banking and payments | Yes | No, tracking only | No | No |

Website admin access for digitalops should be a limited-role account on the site's own admin tool, never a shared login. Use a password manager and 2FA on every account.

## 7. Firestore rules skeleton

Helpers every rule file uses:

```
function signedIn() { return request.auth != null; }
function role() { return request.auth.token.role; }
function isAdmin() { return signedIn() && role() == 'admin'; }
function hasRole(list) { return signedIn() && role() in list; }
function isOwner(uid) { return signedIn() && request.auth.uid == uid; }
```

Example: `userPrivate` (admin or the person themselves, nobody else):

```
match /userPrivate/{uid} {
  allow read: if isAdmin() || isOwner(uid);
  allow write: if isAdmin();
}
```

Example: `contentCalendar` (digitalops cannot approve):

```
match /contentCalendar/{id} {
  allow read: if hasRole(['admin','bizops','digitalops','designer']);
  allow create: if hasRole(['admin','digitalops','designer'])
    && request.resource.data.status == 'Draft';
  allow update: if isAdmin()
    || (role() == 'digitalops'
        && resource.data.status in ['Draft','Review']
        && request.resource.data.status in ['Draft','Review'])
    || (role() == 'digitalops'
        && resource.data.status in ['Approved','Scheduled']
        && request.resource.data.status in ['Scheduled','Posted']);
  allow delete: if isAdmin();
}
```

These are a starting point. Final rules also validate field types, block changes to `ownerId`, and require 2FA where decided. Check the 2FA claim name against current Firebase docs before relying on it.

## 8. Must-fail test list

These run in the Firebase emulator on every rule change. Each one must be denied.

| # | Test | Expected |
| --- | --- | --- |
| 1 | Digitalops reads `userPrivate` of another user | Denied |
| 2 | Digitalops reads `invoices`, `quotations`, `leads`, `clients` | Denied |
| 3 | Digitalops reads or lists `/hr/` and `/business/` in Storage | Denied |
| 4 | Digitalops sets a content item to `Approved` | Denied |
| 5 | Digitalops approves their own website update | Denied |
| 6 | Any non-admin writes `role` or `dept` on any profile | Denied |
| 7 | Any client writes to `auditLogs` | Denied |
| 8 | Bizops reads `auditLogs` or `settings` | Denied |
| 9 | Bizops deletes an invoice | Denied |
| 10 | Designer reads a project they are not a member of | Denied |
| 11 | Designer reads `clients` or `invoices` | Denied |
| 12 | Employee reads another employee's leave or attendance | Denied |
| 13 | Employee updates a task field other than status | Denied |
| 14 | User with no role claim reads anything | Denied |
| 15 | Disabled user with an old token reads anything | Denied after token revocation |
| 16 | Unauthenticated read or write on any path | Denied |

Also run the allowed paths for each role, so a rule that is too strict gets caught as well.

## 9. Build placement

| Step | Phase |
| --- | --- |
| Sign off this matrix and the open decisions | Before Phase 1 starts |
| Custom claims function, first-admin bootstrap script, route guards | Phase 1 |
| Rules and emulator tests for `users`, `userPrivate`, `tasks`, `auditLogs` | Phase 1 |
| Rules for `leave`, `attendance`, `announcements`, `onboarding` | Phases 2 and 3 |
| Rules for `leads`, `clients`, `projects`, `invoices` | Phases 4 and 5 |
| Rules for `contentCalendar`, `websiteUpdates`, `brandAssets`, Storage | Phase 6 |
| Full rules review and security test | Phase 7 |

The first admin is created with a one-off Admin SDK script, not through the UI. After that, only an existing admin can grant roles.

## 10. Open decisions, with recommended defaults

| Decision | Recommended default |
| --- | --- |
| Who approves social posts and website changes | Admin (CEO). Add a delegated `approver` flag later if workload demands it |
| Financial fields Bizops can see and edit | View all invoice and quotation fields; edit status, notes and due dates; amount changes after issue need admin |
| Does designer need all client files | No. Assigned projects only |
| 2FA scope | Mandatory for every role from day one. The current plan says "admin and manager" but there is no manager role now, so update that line |
| Bizops access to HR data | Onboarding checklists only. No contracts, IDs or personal records |
| Digitalops title | Confirm formal title vs. Digital Operations Intern, then set `jobTitle` accordingly. The role key stays `digitalops` either way |
| Leave approver | `reportsTo` person, with admin as fallback |
| Can digitalops see lead counts | Not at launch. Revisit with an aggregate-only dashboard card |

## 11. Sign-off

- [ ] Roles and claims confirmed
- [ ] Collection matrix reviewed
- [ ] Storage matrix reviewed
- [ ] Workflow rules confirmed
- [ ] Access register started for systems outside the app
- [ ] Open decisions answered
- [ ] Test list accepted as the Phase 1 exit criteria
