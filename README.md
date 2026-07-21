# MCPThreat

A SaaS-style threat-modeling tool built specifically for **MCP (Model Context Protocol) servers**. Model an MCP deployment as trust boundaries, map STRIDE + MCP-specific threat vectors, track findings to mitigation, and generate a shareable threat-model report.

## Stack

- **Next.js 14** (App Router) + **TypeScript**
- **Prisma ORM** — SQLite in dev, PostgreSQL-ready for prod
- **Tailwind CSS** + hand-rolled shadcn/ui-style primitives (dark mode default)
- **NextAuth.js** — email/password (bcrypt) + optional GitHub OAuth
- **React Hook Form** + **Zod** validation

## Getting started

```bash
npm install
cp .env.example .env          # adjust secrets as needed
npx prisma migrate dev        # create the SQLite database
npm run seed                  # load the "Example Payment MCP" sample
npm run dev                   # http://localhost:3000
```

**Demo login:** `demo@example.com` / `password123`

### GitHub OAuth (optional)

Set `GITHUB_ID` and `GITHUB_SECRET` in `.env`. When both are present the "Continue with GitHub" button appears; otherwise the app runs on email/password alone. Callback URL: `http://localhost:3000/api/auth/callback/github`.

### Production database

Switch the `datasource` provider in `prisma/schema.prisma` to `postgresql` and point `DATABASE_URL` at Postgres. Enum-like fields are stored as `String` columns validated at the app layer, so no schema rewrite is needed.

## What's inside

- **Dashboard** — project cards with open-finding counts, severity breakdown, and completion %.
- **Project detail** — inline-editable metadata, completion progress, expandable trust boundaries, findings summary.
- **Threat Model Workspace** — a four-step flow (boundaries → vectors → findings → review) with live MCP security guidance.
- **Findings** — filter/sort, inline status changes, bulk updates, and a per-finding detail drawer.
- **Report** — generated markdown (exec summary, boundary map, vector table, findings, mitigation summary, recommended controls) with copy + PDF export.
- **Security Guidance** — an MCP security knowledge base mapping each threat category to concrete mitigations and cited references.

## Security posture

MCPThreat applies the practices it teaches:

- Ownership/membership checks on every project-scoped route and page.
- SSRF-safe validation of user-supplied MCP server URLs (HTTPS-only, private/reserved/metadata ranges blocked).
- Strict Zod validation on all writes; enum values constrained to the taxonomy.
- Secure sessions (NextAuth JWT), no token passthrough.
- CSP, `X-Frame-Options`, `X-Content-Type-Options`, and referrer/permissions policies on every response.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build (typecheck + lint) |
| `npm run seed` | Seed the sample project |
| `npm run db:reset` | Reset the database and re-seed |

## Health

`GET /api/health` returns `{ status, db }` for deployment checks.
