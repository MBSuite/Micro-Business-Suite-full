import { test, describe } from "node:test";
import assert from "node:assert/strict";

// lib/taxAutomator.ts imports lib/settings.ts, which imports lib/db.ts, which
// throws at module load unless a database URL is present. Point it at a closed
// loopback port so the import succeeds and no real database is ever contacted:
// getCompanySettings() swallows the connection error and returns
// { success: false }, so company.data stays undefined.
//
// This overwrites any inherited value on purpose. getCompanySettings() runs
// ensureCompanySettingsTable(), which issues DDL, so inheriting a developer's
// POSTGRES_URL would let a unit test write to a real database.
//
// The assignment has to happen before the import is evaluated, which is why
// this is a dynamic import rather than a static one.
process.env.POSTGRES_URL = "postgres://unused:unused@127.0.0.1:1/unused?sslmode=disable";

const {
  InputTaxValidator,
  WithholdingTaxEngine,
  OverseasServiceTrigger,
  TaxCalendarAlerts,
  RD_EFILING_HOMEPAGE,
  TAX_FILING_URLS,
} = await import("../lib/taxAutomator");

// These tests never pass taxId or address, because the identity mismatch branch
// compares against company_settings and is the one branch that cannot be
// covered without a database. Every assertion below is independent of whether a
// database is reachable.
describe("WithholdingTaxEngine", () => {
  test("skips withholding below 1000 baht without a continuous contract", () => {
    const result = WithholdingTaxEngine.calculate("Service/Professional", 999.99, true);
    assert.equal(result.requiresWht, false);
    assert.equal(result.rate, 0);
    assert.equal(result.whtAmount, 0);
    assert.equal(result.form, null);
  });

  test("applies withholding at exactly 1000 baht", () => {
    const result = WithholdingTaxEngine.calculate("Service/Professional", 1000, true);
    assert.equal(result.requiresWht, true);
    assert.equal(result.rate, 3);
    assert.equal(result.whtAmount, 30);
    assert.equal(result.form, "ภ.ง.ด. 53");
  });

  test("a continuous contract bypasses the 1000 baht floor", () => {
    const result = WithholdingTaxEngine.calculate("Rent", 500, true, true);
    assert.equal(result.requiresWht, true);
    assert.equal(result.rate, 5);
    assert.equal(result.whtAmount, 25);
  });

  test("maps service types to their rates", () => {
    const cases = [
      { serviceType: "Rent", amount: 1000, isJuristicPerson: true, rate: 5, whtAmount: 50 },
      { serviceType: "Advertisement", amount: 1000, isJuristicPerson: false, rate: 2, whtAmount: 20 },
      { serviceType: "Transport", amount: 4000, isJuristicPerson: true, rate: 1, whtAmount: 40 },
    ];

    for (const { serviceType, amount, isJuristicPerson, rate, whtAmount } of cases) {
      const result = WithholdingTaxEngine.calculate(serviceType, amount, isJuristicPerson);
      assert.equal(result.rate, rate, `${serviceType} rate`);
      assert.equal(result.whtAmount, whtAmount, `${serviceType} amount`);
    }
  });

  test("chooses the form by payee type", () => {
    assert.equal(
      WithholdingTaxEngine.calculate("Rent", 1000, true).form,
      "ภ.ง.ด. 53",
      "juristic person files ภ.ง.ด. 53",
    );
    assert.equal(
      WithholdingTaxEngine.calculate("Rent", 1000, false).form,
      "ภ.ง.ด. 3",
      "natural person files ภ.ง.ด. 3",
    );
  });

  test("an unmapped service type is not withheld", () => {
    const result = WithholdingTaxEngine.calculate("ค่าสาธารณูปโภค", 5000, true);
    assert.equal(result.requiresWht, false);
    assert.equal(result.form, null);
  });
});

describe("OverseasServiceTrigger", () => {
  test("flags a foreign service vendor for ภ.พ. 36", () => {
    const result = OverseasServiceTrigger.check("USA", "Software");
    assert.equal(result.requiresPP36, true);
    assert.ok(result.message, "a flagged vendor should carry an explanation");
    assert.match(result.message, /ภ\.พ\. 36/);
  });

  test("does not flag a domestic vendor", () => {
    const result = OverseasServiceTrigger.check("Thailand", "Software");
    assert.equal(result.requiresPP36, false);
    assert.equal(result.message, null);
  });

  test("does not flag a foreign non-service vendor", () => {
    const result = OverseasServiceTrigger.check("USA", "Office Supplies");
    assert.equal(result.requiresPP36, false);
  });
});

describe("TaxCalendarAlerts", () => {
  test("reminds about paper filing on the 1st, 5th and 10th", () => {
    for (const day of [1, 5, 10]) {
      const alerts = TaxCalendarAlerts.getAlertsForDate(new Date(2026, 4, day));
      assert.equal(alerts.length, 1, `day ${day} should raise one alert`);
      assert.match(alerts[0], /แบบกระดาษ/);
    }
  });

  test("reminds about e-Filing from the 15th to the 20th", () => {
    const alerts = TaxCalendarAlerts.getAlertsForDate(new Date(2026, 4, 17));
    assert.equal(alerts.length, 1);
    assert.match(alerts[0], /e-Filing/);
    assert.ok(
      alerts[0].includes(TAX_FILING_URLS.pp30),
      "the e-Filing reminder should link to the ภ.พ. 30 form",
    );
  });

  test("stays quiet on an ordinary day", () => {
    const alerts = TaxCalendarAlerts.getAlertsForDate(new Date(2026, 4, 3));
    assert.deepEqual(alerts, []);
  });

  test("raises the yearly ภ.ง.ด. 51 reminder on 1 August", () => {
    const alerts = TaxCalendarAlerts.getAlertsForDate(new Date(2026, 7, 1));
    assert.equal(alerts.length, 2, "paper filing plus the yearly estimate");
    assert.ok(
      alerts.some((alert) => alert.includes("ภ.ง.ด. 51")),
      "the August reminder should mention ภ.ง.ด. 51",
    );
  });

  test("exposes a real RD e-Filing homepage", () => {
    assert.equal(RD_EFILING_HOMEPAGE, "https://efiling.rd.go.th");
    assert.ok(TAX_FILING_URLS.pp30.startsWith("https://"));
  });
});

describe("InputTaxValidator", () => {
  test("accepts a complete invoice with a matching VAT amount", async () => {
    const result = await InputTaxValidator.validate({
      netAmount: 1000,
      vatAmount: 70,
      hasRequiredFields: true,
    });

    assert.equal(result.isValid, true);
    assert.equal(result.isForbiddenTax, false);
    assert.equal(result.capitalizedExpense, 1000);
    assert.deepEqual(result.errors, []);
  });

  test("caps VAT into the expense for a forbidden category", async () => {
    const result = await InputTaxValidator.validate({
      category: "ค่ารับรอง",
      netAmount: 1000,
      vatAmount: 70,
      hasRequiredFields: true,
    });

    assert.equal(result.isForbiddenTax, true);
    assert.equal(result.capitalizedExpense, 1070);
  });

  test("caps VAT for a non-deductible vehicle category", async () => {
    const result = await InputTaxValidator.validate({
      category: "รถยนต์นั่งส่วนบุคคลไม่เกิน 10 ที่นั่ง",
      netAmount: 10000,
      vatAmount: 700,
      hasRequiredFields: true,
    });

    assert.equal(result.isForbiddenTax, true);
    assert.equal(result.capitalizedExpense, 10700);
  });

  test("leaves the expense at net when a forbidden invoice has no VAT", async () => {
    const result = await InputTaxValidator.validate({
      category: "ค่ารับรอง",
      netAmount: 1000,
      hasRequiredFields: true,
    });

    assert.equal(result.isForbiddenTax, true);
    assert.equal(result.capitalizedExpense, 1000);
  });

  test("reports incomplete documents", async () => {
    const result = await InputTaxValidator.validate({
      netAmount: 1000,
      vatAmount: 70,
      hasRequiredFields: false,
    });

    assert.equal(result.isValid, false);
    assert.ok(result.errors.some((error) => error.includes("ข้อมูลบังคับไม่ครบถ้วน")));
  });

  test("reports a VAT amount that does not equal 7% of net", async () => {
    const result = await InputTaxValidator.validate({
      netAmount: 1000,
      vatAmount: 99,
      hasRequiredFields: true,
    });

    assert.equal(result.isValid, false);
    assert.ok(result.errors.some((error) => error.includes("ยอด VAT ไม่ถูกต้อง")));
  });

  test("rejects a one-satang difference despite the comment claiming it is tolerated", async () => {
    // lib/taxAutomator.ts:64 comments "Allow slight floating point discrepancy
    // (1 satang)", but the check is `Math.abs(expected - actual) > 0.01` and
    // floating point makes an exact 1-satang gap come out as
    // 0.010000000000005116, which is strictly greater than 0.01. The tolerance
    // therefore never accepts a 1-satang difference.
    //
    // This test pins the current behaviour rather than the intent, so that
    // fixing the comparison later shows up as a deliberate change instead of a
    // silent regression. Fixing it means deciding what the threshold should be,
    // which is a tax decision.
    const result = await InputTaxValidator.validate({
      netAmount: 1000,
      vatAmount: 70.01,
      hasRequiredFields: true,
    });

    assert.ok(
      result.errors.some((error) => error.includes("ยอด VAT ไม่ถูกต้อง")),
      "a 1-satang VAT gap is rejected today, despite the tolerance comment",
    );
  });

  test("accepts a sub-satang difference that rounds away", async () => {
    const result = await InputTaxValidator.validate({
      netAmount: 1000,
      vatAmount: 70.001,
      hasRequiredFields: true,
    });

    assert.deepEqual(result.errors, []);
    assert.equal(result.isValid, true);
  });
});
