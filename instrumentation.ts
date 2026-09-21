// Next.js server instrumentation — runs once at server startup.
// Fails fast if required environment variables are missing (P2-02).
export async function register() {
  const { validateEnv } = await import("@/lib/env");
  validateEnv();

  // License lock: both delivery models (perpetual & subscription) require a
  // valid offline-signed MBS_LICENSE_KEY. Fail fast on invalid/expired keys.
  // Skipped during `next build` (phase-production-build) — only enforced at runtime.
  if (process.env.NODE_ENV === "production" && !process.env.NEXT_PHASE) {
    const { requireActiveLicense } = await import("@/lib/license");
    requireActiveLicense();
  }

  if (process.env.CRON_ENABLED === "true") {
    const { registerMaintenance } = await import("@/jobs/scheduleMaintenance");
    registerMaintenance();
  }
}