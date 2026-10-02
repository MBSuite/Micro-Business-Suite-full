// Pure helpers for registration / bootstrap decisions.
//
// Status values in the users table are written with mixed casing ("Active",
// "Pending", "Inactive"), so every JS comparison must be case- and
// whitespace-insensitive. The matching SQL guard uses lower(status) = 'active'
// and must agree with isActiveStatus() here.

export const ACTIVE_STATUS = "active";
export const BOOTSTRAP_ROLE = "superadmin";
export const BOOTSTRAP_STATUS = "Active";
export const DEFAULT_ROLE = "user";
export const DEFAULT_STATUS = "Pending";

export function normalizeStatus(status) {
  return String(status ?? "").trim().toLowerCase();
}

export function isActiveStatus(status) {
  return normalizeStatus(status) === ACTIVE_STATUS;
}

// Bootstrap only an empty installation. An installation with users but no
// active admin must use a trusted recovery path, not public self-registration.
export function resolveRegistrationAccess(hasExistingUsers) {
  if (hasExistingUsers) {
    return { role: DEFAULT_ROLE, status: DEFAULT_STATUS };
  }
  return { role: BOOTSTRAP_ROLE, status: BOOTSTRAP_STATUS };
}
