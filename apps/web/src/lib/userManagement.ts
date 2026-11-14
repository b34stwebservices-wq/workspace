import type { Department, Role } from "./enums";

/** Each non-employee role belongs to exactly one department. Employees choose. */
export const ROLE_DEFAULT_DEPT: Record<Role, Department> = {
  admin: "technical",
  bizops: "business",
  digitalops: "digital",
  designer: "creative",
  employee: "technical",
};

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin (CTO)",
  bizops: "Business Operations",
  digitalops: "Digital Operations",
  designer: "Designer",
  employee: "Employee / intern",
};

export const DEPARTMENT_LABEL: Record<Department, string> = {
  technical: "Technical",
  business: "Business",
  digital: "Digital",
  creative: "Creative",
};

/** Only employees can be placed in any department. */
export const deptIsFixed = (role: Role) => role !== "employee";
export const deptForRole = (role: Role, requested?: Department): Department =>
  deptIsFixed(role) ? ROLE_DEFAULT_DEPT[role] : (requested ?? "technical");

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateNewUserInput(input: {
  email: string;
  name: string;
  password: string;
  confirmPassword: string;
}): string {
  const email = input.email.trim();
  const name = input.name.trim();
  if (!email || !name) return "Name and email are required.";
  if (!EMAIL.test(email)) return "Enter a valid work email.";
  if (name.length < 2) return "Display name must be at least 2 characters.";
  if (input.password.length < 14) return "Use at least 14 characters.";
  if (input.password !== input.confirmPassword)
    return "Passwords do not match.";
  return "";
}

export function validateProfileInput(input: {
  name: string;
  jobTitle: string;
  workEmail: string;
}): string {
  const name = input.name.trim();
  if (name.length < 2) return "Name must be at least 2 characters.";
  if (name.length > 120) return "Name is too long (120 characters max).";
  if (input.jobTitle.trim().length > 120)
    return "Job title is too long (120 characters max).";
  const email = input.workEmail.trim();
  if (!EMAIL.test(email) || email.length > 254)
    return "Enter a valid work email.";
  return "";
}

export function validateHrInput(input: {
  phone: string;
  employmentType: string;
  reportsTo: string;
  startDate: string;
  emergencyContact: string;
  hrNotes: string;
  selfUid: string;
}): string {
  if (input.phone.length > 40) return "Phone number is too long.";
  if (input.employmentType.length > 80) return "Employment type is too long.";
  if (input.reportsTo && input.reportsTo === input.selfUid)
    return "A person cannot report to themselves.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startDate))
    return "Enter a start date.";
  if (Number.isNaN(new Date(`${input.startDate}T00:00:00Z`).getTime()))
    return "Enter a valid start date.";
  if (input.emergencyContact.length > 500)
    return "Emergency contact is too long (500 characters max).";
  if (input.hrNotes.length > 4000) return "HR notes are too long.";
  return "";
}

export type AccessRow = { uid: string; role: Role; active: boolean };

/**
 * Firestore rules cannot count documents, so the "never lock everyone out"
 * guarantee lives here: a change may not leave zero active admins.
 */
export function validateAccessChange(
  rows: readonly AccessRow[],
  change: { uid: string; role: Role; active: boolean },
  actorUid: string,
): string {
  if (change.uid === actorUid)
    return "You cannot change your own access. Ask another admin.";
  const current = rows.find((row) => row.uid === change.uid);
  const wasActiveAdmin = Boolean(
    current && current.role === "admin" && current.active,
  );
  const staysActiveAdmin = change.role === "admin" && change.active;
  if (wasActiveAdmin && !staysActiveAdmin) {
    const remaining = rows.filter(
      (row) => row.uid !== change.uid && row.role === "admin" && row.active,
    ).length;
    if (remaining < 1) return "At least one active admin must remain.";
  }
  return "";
}

/** Cryptographically random password that passes the 14-character rule. */
export function generatePassword(length = 18): string {
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%*-_";
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  const limit = Math.floor(0x100000000 / alphabet.length) * alphabet.length;
  let out = "";
  for (const raw of bytes) {
    let value = raw;
    // Rejection sampling avoids modulo bias.
    while (value >= limit) {
      const retry = new Uint32Array(1);
      crypto.getRandomValues(retry);
      value = retry[0]!;
    }
    out += alphabet[value % alphabet.length];
  }
  return out;
}
