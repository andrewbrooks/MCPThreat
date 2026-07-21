# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

MCPThreat is a threat-modeling SaaS for MCP (Model Context Protocol) servers: model trust boundaries, map STRIDE + MCP-specific threat vectors, track findings to mitigation, and generate reports. Next.js 14 (App Router) + TypeScript + Prisma + NextAuth + Tailwind.

## Commands

```bash
npm run dev                         # dev server (http://localhost:3000)
npm run build                       # prod build — runs typecheck + eslint; use this to validate changes
npm run lint                        # eslint only
npx tsc --noEmit                    # typecheck only (faster than build)
npm run seed                        # seed the "Example Payment MCP" sample (DUAL policy).
                                    # Logins: demo@example.com (assessor) + client@example.com (client), password123
npm run db:reset                    # DESTRUCTIVE: prisma migrate reset --force, then re-seed

npx prisma migrate dev --name X     # create + apply a migration after editing schema.prisma
npx prisma generate                 # regenerate the client (also runs after migrate)
```

There is **no test runner** in this project. Validate changes with `npx tsc --noEmit` then `npm run build`.

### Windows / Prisma gotcha
On Windows the running dev server locks the Prisma engine DLL, so `prisma migrate`/`generate` fail with `EPERM`. **Stop the dev server (and any `next`/`node` processes) before running migrations**, then restart it afterward.

## Architecture

### Enums live in TypeScript, not the database
SQLite has no native enums, so every "enum" column (severity, status, STRIDE category, MCP category, trust-boundary type, etc.) is a plain `String` in `schema.prisma`, constrained at the app layer. `src/lib/taxonomy.ts` is the **single source of truth**: allowed values, display labels, and Tailwind color-class maps. `src/lib/validators.ts` derives Zod enums from those arrays. This keeps the schema portable to PostgreSQL for prod (swap the `datasource` provider). When adding a taxonomy value, update `taxonomy.ts` first.

### Two read/write paths, one authorization gate
- **Reads** (server components) go through `src/lib/data.ts` (`getProjectDetail`, `listProjectSummaries`, etc.).
- **Writes / client-side reads** go through App Router route handlers under `src/app/api/`.
- **Both** call `requireProjectAccess(userId, projectId, { write? })` from `src/lib/authz.ts`, which enforces owner-or-member access and throws `AuthzError` (mapped to JSON by `errorResponse`). Never query a project-scoped resource without it. Child resources (boundaries/vectors/findings/attachments) are additionally verified to belong to the project via the `assert*InProject` helpers in `src/lib/api.ts` — this closes cross-project tampering.

Route handlers follow a consistent shape: `const actor = await currentActor()` (or `currentUserId()`), `await requireProjectAccess(...)`, `parseJson(req, schema)`, mutate, `recordAudit(...)`, return JSON — all wrapped in `try/catch` → `errorResponse(err)`.

### Computed, never stored
Severity rollups, open-finding counts, and `completionPct` (share of threat vectors with ≥1 MITIGATED/CLOSED finding) are computed at read time in `src/lib/metrics.ts`. Do not persist them.

### Timers are lazy, not scheduled
- **Review/revisit timer**: an ACCEPTED finding with `reviewDueAt` in the past is auto-reopened by `reopenDueFindings` in `data.ts`, invoked on read paths (`getProjectDetail`, findings GET, dashboard). No cron needed.
- **Owner reminders**: recurring emails are dispatched by `POST/GET /api/cron/reminders`, authenticated with `CRON_SECRET`, meant to be hit by an external scheduler.

### Audit trail
`src/lib/audit.ts` `recordAudit(...)` appends `AuditEvent` rows for finding changes (per-field diffs, status, evidence, attachments, alerts, auto-reopen). `AuditEvent` is deliberately **not** FK-linked to `Finding` (no cascade) so history survives deletion. `src/lib/audit-format.ts` holds the Prisma-free `describeAuditEvent` used by both the client drawer and the server-rendered `/projects/[id]/activity` page — keep display formatting there so it stays importable from client code.

### Risk-acceptance workflow
A finding can only reach `ACCEPTED` through an approval workflow when the project's `acceptancePolicy` (`OFF` | `SINGLE` | `DUAL`, default `OFF`) requires it. Logic lives in the Prisma-free `src/lib/acceptance.ts` (`acceptanceRequirement(policy, severity)` → `NONE`/`SINGLE`/`DUAL`; `resolveSide(...)`; `isAcceptanceComplete(...)`).
- **`DUAL` is severity-gated**: HIGH/CRITICAL need one **assessor** + one **client** sign-off; lower severities fall back to `SINGLE`.
- **Party side**: each `ProjectMember` has a `side` (`ASSESSOR`/`CLIENT`); the project owner is always `ASSESSOR`. A user's side (from `requireProjectAccess().side`) fixes which sign-off slot they may fill, which enforces separation of duties. `SINGLE` also blocks the requester from self-approving (four-eyes).
- **State machine**: requesting acceptance creates an `AcceptanceRequest` (sign-offs stored as side-keyed slots on the row) and moves the finding to `PENDING_ACCEPTANCE`; final sign-off flips it to `ACCEPTED`. The finding-update route (`findings/[fid]/route.ts`) **rejects** manual status changes into `ACCEPTED`/`PENDING_ACCEPTANCE` when a policy is active — accept only via `POST /findings/[fid]/acceptance` + `/acceptance/decision`.
- **Expiry reuses the review timer**: an approved request sets the finding's `reviewDueAt`, so acceptance lapses via the same lazy `reopenDueFindings` path (which also flips the request to `EXPIRED`).
- The client `AcceptancePanel` renders inside the finding drawer; pages pass `acceptancePolicy` + `viewerSide` + `viewerId` down to `FindingsTable`. `MANUAL_STATUSES` (taxonomy) is the set selectable in status dropdowns — it excludes `PENDING_ACCEPTANCE` and (when a policy is active) `ACCEPTED`.

### Security posture (the product also practices it)
- SSRF: user-supplied `mcpServerUrl` is validated by `src/lib/url-safety.ts` (HTTPS-only, blocks private/reserved/metadata ranges). The app does not auto-fetch these URLs.
- CSP + `X-Frame-Options`/`nosniff`/referrer/permissions headers are set in `next.config.mjs`.
- No token passthrough; sessions are NextAuth JWT.

### Auth
`src/lib/auth.ts` — NextAuth v4, Credentials (bcrypt) always on; GitHub provider registered only when `GITHUB_ID`/`GITHUB_SECRET` are set (app still boots without them). JWT session strategy (required for Credentials). `authorize()` uses a non-strict schema because NextAuth injects extra fields (`csrfToken`, `json`). `src/middleware.ts` protects app pages and redirects to `/login`; API routes enforce their own auth so they can return JSON 401/403 instead of an HTML redirect.

### MCP knowledge base
`src/lib/mcp-knowledge-base.ts` maps each MCP category to a threat summary, mitigations, and clickable source `references` (label + URL, rendered as data in the UI). **Convention:** citations belong in this data and in UI, not as attribution comments in code — don't add "// per OWASP…"-style references in source.

### UI conventions
- shadcn/ui-style primitives are hand-rolled in `src/components/ui/` (no Radix dependency). `Button` has **no `asChild`** — to style a `Link` as a button, apply `buttonVariants({...})` to its `className`.
- Light theme is the default (`next-themes`); dark is available via the sidebar toggle. Badge/color classes are **light-first with `dark:` variants** — follow that pattern for any new colored element or it will be unreadable in one mode.
- Authenticated pages live under the `src/app/(app)/` route group (shared `AppShell` sidebar). Client interactivity mutates via `fetch` to the API routes, then calls `router.refresh()` to re-pull server data.
- Files/attachments are stored as `Bytes` in the DB (portable downloads); allowed types and limits are in `src/lib/attachments.ts`.

## Environment
`.env` keys (see `.env.example`): `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, optional `GITHUB_ID`/`GITHUB_SECRET`, optional `SMTP_*` + `EMAIL_FROM` (emails log to console when SMTP is unset), and `CRON_SECRET` for the reminders endpoint.
