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
- Verified test/type/lint snapshot: `pnpm test` 14 passed; `pnpm exec tsc --noEmit` clean (0 errors); `pnpm lint` 363 errors and 169 warnings. These are point-in-time results, not release approval. (Superseded by the later 36/36 run below.)
- Removed `tests/taxAutomator.test.ts` (owner decision, 2 Oct 2026). The file imported two symbols that `lib/taxAutomator.ts` does not export and called the async `InputTaxValidator.validate()` without `await`; `package.json` only runs `tests/**/*.test.mjs`, so it had never executed. Deleting it cleared all 17 TypeScript errors and left `lib/taxAutomator.ts` with no coverage.
- Added `tests/taxAutomator.test.mts` covering all four exported classes (22 tests, 14 → 36 total). `package.json` now runs `node --import tsx --test tests/**/*.test.mjs tests/**/*.test.mts`. The file is `.mts` because `package.json` has no `"type": "module"`, so a `.ts` file would be compiled as CommonJS and reject top-level await. It uses a dynamic import because `lib/db.ts` throws at module load without `POSTGRES_URL`, and it assigns a closed loopback address unconditionally because `getCompanySettings()` issues DDL and must never reach a real database from a unit test. Result: `pnpm test` 36/36, `pnpm exec tsc --noEmit` 0 errors, `pnpm check:consistency` passed, `pnpm lint` unchanged at 363 errors and 169 warnings.
- Found a defect while writing those tests: `lib/taxAutomator.ts:64` comments "Allow slight floating point discrepancy (1 satang)" but the check `Math.abs(expectedVat - actualVat) > 0.01` rejects an exact 1-satang gap, because floating point yields `0.010000000000005116`. `netAmount: 1000, vatAmount: 70.01` is reported as an incorrect VAT amount. The test pins current behaviour rather than the intent; changing the threshold is a tax decision and was left untouched per owner instruction.
- Not covered: the `taxId`/`address` identity-mismatch branch of `InputTaxValidator`, which requires a real database. `InputTaxValidator` is still not called from any expense UI or action.
- Backup encryption remains open: `scripts/auto-backup.mjs` gzips and uploads to Drive without encrypting the payload first. Owner paused this item for now; it must be revisited before production use because the archive contains customer data and bcrypt password hashes.

