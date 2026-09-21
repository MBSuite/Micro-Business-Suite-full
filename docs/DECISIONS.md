# Architecture Decisions Log (Micro Business Suite)

บันทึก decision ระดับเทคนิค/สินค้าที่มีผลต่อโครงสร้างโค้ด — ใช้ประกอบการดูแลโปรแกรมของลูกค้า

## Template

### [YYYY-MM-DD] Decision Title
- Context:
- Decision:
- Alternatives considered:
- Why this was chosen:
- Impacted files/modules:
- Rollback plan:

---

### [2026-04-09] Canonical RBAC + Role Standard
- Context: Role labels and access checks were inconsistent across UI/API.
- Decision: Standardize to `superadmin/admin/user` + group-based RBAC permissions.
- Alternatives considered: keep mixed role aliases for compatibility.
- Why this was chosen: reduces regressions, removes duplicate logic, improves maintainability.
- Impacted files/modules: `lib/core-standards.ts`, admin/member/API access checks, docs.
- Rollback plan: none needed; this is additive/normalization without schema destruction.

### [2026-04-09] Governance Guardrails Automation
- Context: Behavior changes risk drifting from docs and standards over time.
- Decision: Add CI/PR/weekly enforcement and guard tests.
- Alternatives considered: manual review-only process.
- Why this was chosen: lowers human error, keeps documentation synchronized with code.
- Impacted files/modules: `.github/workflows/*`, `scripts/verify-knowledge-sync.mjs`, `scripts/weekly-consistency-audit.mjs`, `tests/governance-guards.test.mjs`.
- Rollback plan: remove workflow/script/test files if automation causes false-positive friction.

### [2026-04-09] Unified Module Registry and Menu API
- Context: Sidebar menu and permission modules were defined in multiple files and drifted over time.
- Decision: Introduce a canonical module registry and expose it through a modules API.
- Alternatives considered: keep local constants per page.
- Why this was chosen: enables future module onboarding (HR, Sales, external APIs) without duplicating menu/permission definitions.
- Impacted files/modules: `lib/module-registry.ts`, `components/Sidebar.tsx`, `app/admin/groups/page.tsx`, `app/api/modules/route.ts`.
- Rollback plan: revert to static menu constants if dynamic module model causes UI regressions.

### [2026-09-21] PDF Evidence Must Be Checked Before Recording Expenses
- Context: บันทึกค่าใช้จ่ายโดยอ้างตัวเลขจากความทรงจำ/การประมาณ เสี่ยงตัวเลขภาษีเพี้ยน
- Decision: ก่อนบันทึกค่าใช้จ่ายทุกครั้ง ต้องอ่าน PDF ต้นทาง (invoice/statement) ก่อน แล้วบันทึกตัวเลขตามหลักฐานเท่านั้น ห้ามเดา
- Why this was chosen: หลักฐานตรวจสอบย้อนหลังได้, ตัวเลขภาษีถูกต้อง
- Impacted files/modules: `docs/BUSINESS_RULES.md`, พฤติกรรมการบันทึก expenses
- Rollback plan: none — เป็นกฎการทำงาน ไม่กระทบ schema