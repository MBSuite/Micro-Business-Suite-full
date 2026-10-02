# Architecture Overview

## Stack

- App: Next.js (App Router) + TypeScript
- Database: PostgreSQL via `pg` (`lib/db.ts`); provider is deployment-specific
- Auth: custom JWT using `jose`, `session-token` cookie, and `proxy.ts`; no NextAuth runtime

## Core Modules

- Sales: quotations, invoices, payments
- Purchase: expenses, vouchers
- Accounting: journal entries + chart of accounts
- Access control: RBAC groups/permissions
- Settings/integrations: company settings + Google integration

## Canonical Data Flow

1. Business document created (`invoice`, `expense`, `payment_voucher`, `payment`)
2. Relevant server action may generate entries in `journal_entries`; transaction and authorization coverage vary by workflow
3. Some reports read journal presentation; tax summaries also query business tables directly
4. `proxy.ts` enforces a session gate; RBAC/admin authorization is handled separately where implemented

## Canonical Access Standard

- Role baseline: `superadmin`, `admin`, `user`
- Permission model: module/action via RBAC
- Helper standard: `lib/core-standards.ts`

## FX Rate Source (`/api/fx-rate`)

- Endpoint: `GET /api/fx-rate` → latest USD/THB + 30d series + trend (low/high/%change)
- Source: Bank of Thailand reference rate via `https://api.frankfurter.dev/v2` (`providers=BOT`)
- Server-side cache: latest 6h, series 24h (in-memory Map)
- Used by invoice creation "FX Mode": prefill `fxRate` and monitor currency movement before billing (billing policy is configured per installation via company settings)

## Stability Rules

- Preserve historical accounting evidence
- Backward compatibility required
- No destructive schema operations in production

## Verification Caveats

- Authentication is custom JWT, not NextAuth; `NEXTAUTH_*` remains in environment variable names for compatibility.
- Do not assume every server action or API route enforces module-level RBAC. Verify the target route before describing its access policy.
- Tax summaries and export actions are preparation aids, not proof of a correct filing or an end-to-end Revenue Department submission.

