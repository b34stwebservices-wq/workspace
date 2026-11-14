# Stage 7 — Digital Operations

## Delivered

- Added `/digital` workspace navigation and page for all active staff roles.
- Social content calendar with month navigation, post drafts, channel selection, optional scheduled date/time, caption copy and creative URL.
- Content review workflow: creator submits draft, an admin/Digital Operations reviewer (not the creator) approves or rejects, and authorised managers mark approved content scheduled/published.
- Website change request intake for all active staff; creators can read their own requests while Admin/Digital Operations can review all and move requests through triage, in-progress, completed or rejected.
- Campaign planning for Admin, Digital Operations and BizOps, including channel mix, objectives, dates, ZMW budget, lifecycle status and manually entered performance metrics.
- Campaign reporting totals and per-campaign click-through rate.
- Shared content asset directory using validated HTTP(S) links and metadata.
- Audit events for content, website request, campaign and asset operations.
- Firestore validation functions and restrictive collection rules for all four new collections.

## Firestore collections and fields

- `socialPosts`: `title`, `channel`, `caption`, `scheduledAt`, `assetUrl`, `status`, `reviewerNote`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy`.
- `websiteRequests`: `title`, `description`, `pageUrl`, `priority`, `status`, `assignedTo`, `completionNote`, audit timestamps and actor IDs.
- `digitalCampaigns`: `name`, `objective`, `channels`, `startDate`, `endDate`, `budgetZmw`, `status`, `impressions`, `clicks`, `leads`, `conversions`, audit timestamps and actor IDs.
- `contentAssets`: `name`, `category`, `platform`, `assetUrl`, `notes`, audit timestamps and actor IDs.

## Access model

- Social posts: Admin and Digital Operations can read all; Designers can read only their own. Admin, Digital Operations and Designers can create drafts. A creator can submit their own draft/rejected post; Admin/Digital Operations can approve/reject someone else's pending post and progress approved content to scheduled/published. Deletes are denied.
- Website requests: any active user can create and read their own; Admin and Digital Operations can read all and change workflow state. Deletes are denied.
- Campaigns: Admin, Digital Operations and BizOps can read/create/update allowed status and metric fields. Deletes are denied. Metric validation prevents clicks exceeding impressions and conversions exceeding leads.
- Assets: Admin, Digital Operations and Designers can read/create metadata links. Updates and deletes are denied in this phase.
- All changes are additionally recorded in the existing append-only `auditLogs` collection.

## Indexes and Spark-tier choices

The page uses simple collection reads and a single-field `createdBy == uid` filter for owner-scoped queries. These are supported by Firestore's automatic single-field indexes, so no composite index is required for Stage 7. No Cloud Functions, paid APIs, social publishing integrations, analytics SDKs or Firebase Storage uploads were added. The asset library stores links/metadata only; it does not upload binary files. Campaign metrics are manually entered and are not claimed to be live platform analytics.

## Deployment and verification

1. Deploy `firebase/firestore.rules` and `firebase/firestore.indexes.json` using the existing Firebase project configuration.
2. Build and run lint/tests using the root scripts after installing dependencies.
3. Run the Firestore Emulator rules tests before production. Emulator tests remain disabled by the existing project direction and were not executed in this stage.
4. Test each role with separate accounts: admin, digitalops, designer, bizops and employee. Verify owner-scoped website requests and designer-owned social posts.
5. Review any existing custom claims or role documents before granting production access.

## Known limitations

- No automatic posting to social networks; `scheduled` and `published` are internal workflow states only.
- No social platform API integration or live analytics ingestion; campaign metrics are manual.
- Asset library stores external URLs and metadata; it does not upload files or enforce permissions on the external host.
- Website request workflow state is tracked, but assignment and completion-note editing UI are reserved for a later iteration.
- The campaign metrics editor currently uses browser prompts; a dedicated edit dialog would improve usability.
