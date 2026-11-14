# B34ST Staff App: Build Instructions

Internal web app for b34st Web Services (Zambia) at **app.b34stweb.com**. It tracks and manages staff, tasks, leave, leads, clients, projects, content and website updates.

Brand: "Secure digital work that moves business forward." Security is the product. Write code that a security reviewer would approve.

**Free tier only (Firebase Spark).** Do not use Cloud Functions, Cloud Storage, phone/SMS auth, scheduled exports or any other Blaze-only product. Sections 3 and 14 explain what replaces them.

Sources of truth: the **Project Plan** (scope, phases) and the **RBAC Matrix** (permissions). If this file conflicts with the RBAC Matrix on permissions, the matrix wins. The matrix mentions custom claims, Cloud Functions and Firebase Storage; those mechanisms are replaced by the free-tier versions in sections 3 and 14, and the permissions themselves do not change. If something is unclear, make the safest reasonable choice, note it in `DECISIONS.md`, and continue.

---

## 1. Stack

| Layer | Choice |
|---|---|
| Frontend | React + Vite + React Router, TypeScript (strict) |
| Styling | Tailwind CSS, dark mode, mobile first |
| Auth | Firebase Auth, email/password, 2FA |
| Database | Firestore |
| Files | Firestore only: `files` metadata + `chunks` subcollection (Bytes). Small files; big design files stay outside the app |
| Server logic | None. Rules enforce access; admin tasks run as local Admin SDK scripts |
| Hosting | Vercel (frontend), Cloudflare DNS (DNS only) |
| Tests | Vitest, Firebase Emulator Suite (rules tests), Playwright (e2e) |
| Repo | GitHub, private, `main` deploys to production |

Two Firebase projects: `b34st-staff-dev` and `b34st-staff-prod`. Never point dev code at prod data.

## 2. Repo structure

```
/
├─ apps/web/                # React app
│  └─ src/
│     ├─ app/               # routes, layout, providers
│     ├─ features/          # one folder per domain (users, tasks, leave, leads, ...)
│     ├─ lib/               # firebase init, auth, role helpers, utils
│     └─ components/        # shared UI
├─ firebase/
│  ├─ firestore.rules
│  ├─ firestore.indexes.json
│  └─ tests/                # emulator rules tests
├─ scripts/
│  ├─ bootstrap-admin.ts    # one-off first admin (Admin SDK, run locally)
│  ├─ create-user.ts        # create an Auth account
│  ├─ disable-user.ts       # disable account and revoke tokens
│  └─ backup.ts             # weekly Firestore export to an encrypted local file
├─ DECISIONS.md
└─ instructions.md
```

## 3. Roles

One role per user, stored in Firestore at `roles/{uid}` as `{ role, dept, active }`. Rules read it with `get()`. There are no custom claims, because setting them needs a server.

| Role | Title | dept |
|---|---|---|
| `admin` | CTO | `technical` |
| `bizops` | Business Operations Officer | `business` |
| `digitalops` | Digital Operations Officer | `digital` |
| `designer` | UI/UX & Graphic Designer | `creative` |
| `employee` | Employee / intern | per person |

Rules:
- No `roles/{uid}` document, or `active != true`, means no access to anything.
- Only an admin writes `roles/*`, and never their own document.
- No public signup. The CTO creates accounts with `scripts/create-user.ts`, then assigns the role in the app.
- The first admin is created with `scripts/bootstrap-admin.ts`, never through the UI.
- Disabling a user: set `active: false` (rules deny immediately), then run `scripts/disable-user.ts` to disable the Auth account and revoke tokens.
- Never trust a role sent from the client. Rules read it from `roles/{uid}` only.
- Each `get()` in a rule counts as a read. Keep helpers lean.

## 4. Permissions

Implement exactly what the RBAC Matrix says. Short version:

- `users` holds public profile only (name, jobTitle, department, work email, status). Sensitive data lives in `userPrivate` (phone, employmentType, reportsTo, startDate, emergency contact, HR notes). Admin and the person themselves only.
- Only `admin` deletes business records. Everyone else archives via `status`.
- `leads`, `clients`, `quotations`, `invoices`: admin and bizops only.
- `digitalops` and `designer` get no access to `userPrivate`, financial records, leads, clients, `/hr/` or `/business/` storage.
- `digitalops` cannot set a content item to `Approved` and cannot approve their own website update.
- `auditLogs`: create-only from the client by any active user, with `actorId == request.auth.uid` and `createdAt == request.time`. No update or delete by anyone. Read by admin only.
- Leave is approved by the user's `reportsTo` person, or admin. Nobody approves their own.

UI checks are for usability only. Every permission must also be enforced in rules or functions.

## 5. Data model

Collections: `files`, `roles`, `users`, `userPrivate`, `onboarding`, `tasks`, `attendance`, `leave`, `announcements`, `leads`, `clients`, `projects`, `timeEntries`, `quotations`, `invoices`, `contentCalendar`, `websiteUpdates`, `brandAssets`, `documents`, `auditLogs`, `settings`.

Conventions:
- Document ID = Firestore auto ID, except `users`/`userPrivate` which use the auth `uid`.
- Every document has `createdAt`, `createdBy`, `updatedAt`, `updatedBy` (server timestamps, set in functions or validated in rules).
- Money in ZMW as integer ngwee, never floats.
- Status fields use fixed enums defined once in `apps/web/src/lib/enums.ts` and mirrored in rules.
- `contentCalendar.status`: Draft, Review, Approved, Scheduled, Posted.
- `websiteUpdates.status`: Requested, In progress, Pending approval, Approved, Completed. `evidenceUrl` required on Completed. Never store passwords, keys or tokens in this collection.
- `leads.stage`: New, Contacted, Proposal, Won, Lost.

## 6. Security requirements (non-negotiable)

1. Write and test Firestore and Storage rules **before** the feature that uses them. Deny by default.
2. Rules validate field types, required fields, and block changes to `ownerId`, `createdBy`, `role`, `dept`.
3. 2FA for every role from day one (see section 14 for how, on the free tier).
4. Firebase App Check on. API keys restricted to the app domains.
5. Security headers on Vercel: CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy.
6. `noindex` meta and robots block on the whole app.
7. Validate all input on the client and again in functions or rules. Treat all user text as untrusted. No `dangerouslySetInnerHTML`.
8. Leads are entered by bizops or admin. If a public form is added later, follow the strict create-only pattern in section 14.
9. Secrets in environment variables only. Commit `.env.example`, never `.env`.
10. Audit log entries for create, update, delete and role changes, written as create-only documents (section 4). Login events are not available without functions.
11. Files are stored in Firestore (section 14): types, size caps and category access enforced in rules and checked again on the client. Never trust the filename or MIME type alone; check the file signature (magic bytes) before storing.
12. No `console.log` of personal data. No personal data in URLs.
13. Dependencies: pin versions, run `npm audit` in CI, no unmaintained packages.

## 7. Build order

Do one phase at a time. Each phase ends with passing tests and a short note in `DECISIONS.md`.

| Phase | Deliverables |
|---|---|
| 0. Setup | Repo, Firebase dev and prod, Vercel project, `app.b34stweb.com` DNS, CI, lint, Tailwind tokens |
| 1. Foundation | Auth, login/reset, `roles` collection and rules helpers, bootstrap and user scripts, route guards, 2FA approach, audit log, admin role management, rules and emulator tests for `roles`, `users`, `userPrivate`, `tasks`, `auditLogs` |
| 2. Core HR | Employee directory and profile, departments, task board, announcements, role-aware dashboard, onboarding checklists |
| 3. Time and leave | Check-in/out, leave requests and approvals, leave calendar |
| 4. Leads | Pipeline board, manual lead entry by bizops, optional public lead form (section 14) |
| 5. Delivery | Clients, projects, time entries, quotations, invoice tracker |
| 6. Growth | Content calendar and approval flow, website update log, brand assets, Metricool widget, document vault (Firestore files), PWA, dark mode |
| 7. Hardening | Security test (auth bypass, IDOR, XSS, rate limits), local backup script and restore test, Lighthouse and accessibility pass, user guide |

Start with Phase 0 and 1 only. Do not build later phases until asked.

## 8. Testing

- Every collection and Storage path has emulator tests for each role.
- Include the **must-fail list** from the RBAC Matrix (section 8) as automated tests. These must be denied:
  - digitalops reading another user's `userPrivate`, or any of `invoices`, `quotations`, `leads`, `clients`, `/hr/`, `/business/`
  - digitalops setting `Approved` or self-approving a website update
  - any non-admin writing `role` or `dept`
  - any client writing `auditLogs`
  - bizops reading `auditLogs` or `settings`, or deleting an invoice
  - designer reading a project they are not a member of, or `clients`/`invoices`
  - employee reading another person's leave or attendance
  - a user with no role claim reading anything
  - a user whose `roles` document has `active: false` reading anything
  - any client updating or deleting an `auditLogs` entry, or creating one with another user's `actorId`
  - any non-admin writing `roles`, or an admin editing their own `roles` document
  - (if a public lead form exists) creating a lead with unknown fields, oversized values, or reading any lead
  - a user reading a file chunk outside their category, or writing a chunk over the size cap, with a disallowed type, or into a category their role cannot write
  - anyone but admin reading an `hr` file
  - unauthenticated access to anything
- Also test the allowed paths so rules that are too strict get caught.
- CI blocks merge if rules tests fail.

## 9. Code conventions

- TypeScript strict, no `any` without a comment explaining why.
- Feature folders own their components, hooks, types and queries.
- Small components, no business logic in JSX.
- Role checks go through one helper (`lib/roles.ts`), never inline string comparisons.
- Loading, empty and error states on every screen.
- Mobile first. Tap targets at least 44px. Keyboard accessible, visible focus, proper labels.
- Dates stored UTC, shown in Africa/Lusaka. Currency shown as ZMW.
- Plain English UI copy. No jargon.
- Conventional commits. Small pull requests, each with a Vercel preview.

## 10. Deployment

1. Connect the repo to Vercel. `main` deploys to production.
2. Vercel project, Domains: add `app.b34stweb.com`.
3. Cloudflare DNS: `CNAME app` to `cname.vercel-dns.com`, **DNS only** (grey cloud).
4. Firebase Auth, authorized domains: add `app.b34stweb.com`.
5. Deploy rules and indexes with the Firebase CLI from CI, dev first, then prod.
6. Backups: run `scripts/backup.ts` weekly from the CTO's machine and keep the file encrypted and off the repo. Managed exports need Blaze. Test a restore once before launch.

## 11. Defaults for open decisions

Use these until told otherwise, and log them in `DECISIONS.md`:

- Content and website-change approver: `admin`.
- Bizops can view all invoice and quotation fields, edit status, notes and due dates. Amount changes after issue need admin.
- Designer sees assigned projects only.
- Bizops sees onboarding checklists only, no contracts, IDs or personal records.
- Leave approver: `reportsTo`, fallback `admin`.
- Digitalops sees no lead data at launch.

## 12. Do not

- Do not store passwords, API keys or tokens in any Firestore document.
- Do not give any client write access to `auditLogs`, claims, or `role`.
- Do not use real staff, client or lead data in tests, seeds or screenshots.
- Do not invent pricing, testimonials, client names or stats. Use `[placeholder]`.
- Do not skip writing rules tests to save time.
- Do not build outside the current phase.
- Do not add Cloud Functions, Cloud Storage, phone/SMS auth or any Blaze-only service.
- Do not commit or deploy the service account key.

## 13. Definition of done (per feature)

- Matches the RBAC Matrix for every role.
- Rules written and tested in the emulator, including must-fail cases.
- Input validated on client and server side.
- Audit entry written where the matrix requires one.
- Works on a phone-sized screen, light and dark.
- Loading, empty and error states handled.
- No new lint, type or audit errors.
- Decisions noted in `DECISIONS.md`.

---

## 14. Free-tier (Spark) design notes

**What is not available and what replaces it**

| Planned | Why not | Instead |
|---|---|---|
| Cloud Functions | Needs Blaze | Rules enforce access; admin tasks run as local scripts |
| Custom claims | Set from a server | `roles/{uid}` document checked in rules |
| Audit log written by functions | No server | Create-only `auditLogs` from the client, admin read only |
| Lead intake endpoint | No server | Bizops logs leads from email; optional public create below |
| Email notifications | No server | In-app only for now |
| Firebase Storage | Needs Blaze since Feb 2026 | Firestore `files` + `chunks`, small files only |
| Scheduled backups | Managed export needs Blaze | Local `scripts/backup.ts`, weekly |

**Quotas.** Spark gives roughly 1 GiB of Firestore storage, 50K reads and 20K writes a day. Going over a quota shuts that product off for the rest of the month, so design lean:
- Paginate and `limit()` every list query. No unbounded listeners.
- Prefer one-time `getDocs` over realtime listeners, except on the task board and dashboard.
- Cache user profiles in memory for the session.
- Add a dev-only read counter to catch runaway queries.
- File reads count too: a 2 MB file is about 3 reads. Show thumbnails in lists and fetch the full file only when opened.

**Public lead form (optional, Phase 4).** If the website form must write directly: allow `create` only on `leads`, validate every field (type, max length, allowed keys), no read, no update, and turn on App Check. There is no rate limiting without a server, so a bot can burn the daily write quota. Start with email to manual entry, and add this only if volume justifies it.

**Files.** Files are stored in Firestore, so the same rules that protect data protect them.
- `files/{fileId}`: metadata `{ name, mime, size, category, ownerId, projectId?, allowedRoles[], chunkCount, thumb? (Bytes, 30 KB max), createdAt }`.
- `files/{fileId}/chunks/{n}`: `{ data (Bytes, 700 KB max), allowedRoles[], ownerId, category }`. The access fields are copied into every chunk so rules can check `resource.data` without an extra `get()`.
- A Firestore document is capped at 1 MiB, so split each file into chunks of 700 KB or less. Write the chunks first, then the metadata document.
- Limits: images up to 2 MB after client-side compression, PDFs up to 3 MB, avatars 100 KB. Rules enforce `data.size()` per chunk and the chunk count.
- Allowed types: PNG, JPEG, WebP, PDF. Check magic bytes, not just the extension.
- Categories follow the RBAC Storage matrix: `brand`, `design` (project members), `content`, `business`, `hr`, `avatar`. The category decides who can create, read and delete, in rules.
- Everything counts against the shared 1 GiB. Warn the admin at 70% usage and set a per-user upload cap.
- Larger files (design source files, video) stay in the team's own cloud drive and are linked by URL. List those folders in the access register.
- Do not store ID scans or other identity documents. Contracts only, in the `hr` category, admin only.
- `scripts/backup.ts` must include chunks, so the backup grows with them.

**Service account key.** The scripts need an Admin SDK key. Keep it on the CTO's machine only. Never in the repo, never on Vercel. Rotate it if the laptop is lost.

**2FA.** Check in the Firebase console whether multi-factor auth works without billing. If it does not, use Google sign-in and enforce 2-Step Verification on every staff Google account. The app cannot enforce that, so verify it at onboarding.
