# Project Changelog (Behavioral)

Tracks meaningful behavior/architecture changes (not every small code diff).

## [2026-09-21]

- Added FX Rate Monitor: `GET /api/fx-rate` serves latest USD/THB (BOT reference via frankfurter.dev) with 30d series + trend; invoice creation page shows a live FX widget and "Use Latest Rate" button to prefill the markup calculator's exchange rate (FX-based billing)
- Invoice markup calculator now supports FX mode: USD cost × rate × markup → THB price, and records the rate used into the line detail for evidence

## [2026-04-09]

- Standardized role model to canonical `superadmin/admin/user`
- Centralized role helper in `lib/core-standards.ts`
- Removed duplicate global AI chat rendering
- Removed dead sidebar routes without real pages
- Restored admin checks in user/group APIs (removed temporary bypass)
- Added persistent knowledge system documents under `docs/`
- Added governance enforcement:
  - PR/CI knowledge guard
  - Weekly docs-code consistency audit workflow
  - Node test coverage for governance guards
- Hardened RBAC endpoints:
  - invoice delete authorization uses canonical admin helper
  - group permissions update now uses atomic DB transaction with one client
- Added module extensibility baseline:
  - canonical module registry (`lib/module-registry.ts`)
  - module discovery API (`GET /api/modules`)
  - sidebar now renders from shared registry
  - RBAC group permission page now uses shared permission modules
  - added `services` and `payroll` routes for menu completeness

## [2026-10-02]

- Reconciled project documentation with the current implementation: custom JWT/proxy authentication, deployment environment requirements, and dashboard sync behavior.
- Clarified that tax exports are preparation summaries, not official RD filing files; recorded unresolved WHT/COA implementation discrepancies for accountant and developer review.
- Added a status note that the historical GitHub workflow entry is not proof of an active workflow; no `.github/workflows/` files were found in the current checkout.
- Verified test/type/lint snapshot: `pnpm test` 14 passed; `pnpm exec tsc --noEmit` 17 errors in `tests/taxAutomator.test.ts`; `pnpm lint` 363 errors and 169 warnings. These are point-in-time results, not release approval.

