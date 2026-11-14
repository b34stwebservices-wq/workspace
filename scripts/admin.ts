import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { readFileSync } from "node:fs";
export const roles = [
  "admin",
  "bizops",
  "digitalops",
  "designer",
  "employee",
] as const;
export type Role = (typeof roles)[number];
export const departments = [
  "technical",
  "business",
  "digital",
  "creative",
] as const;
export type Department = (typeof departments)[number];
export function requireArg(name: string) {
  const found = process.argv.find((value) => value.startsWith(`--${name}=`));
  if (!found) throw new Error(`Missing --${name}=…`);
  return found.slice(name.length + 3);
}
export function setupAdmin() {
  if (getApps().length) return;
  const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  let serviceAccount: Record<string, unknown> | undefined;
  if (keyPath) {
    try {
      serviceAccount = JSON.parse(readFileSync(keyPath, "utf8")) as Record<
        string,
        unknown
      >;
    } catch {
      throw new Error(
        "Could not parse FIREBASE_SERVICE_ACCOUNT_PATH. Download a fresh JSON key from Google Cloud Console and do not edit or paste it into this project.",
      );
    }
    if (
      serviceAccount.type !== "service_account" ||
      typeof serviceAccount.project_id !== "string" ||
      typeof serviceAccount.private_key !== "string"
    ) {
      throw new Error(
        "The service-account file is not a valid Firebase Admin SDK JSON key.",
      );
    }
  }
  initializeApp(
    serviceAccount
      ? { credential: cert(serviceAccount) }
      : { credential: applicationDefault() },
  );
}
export function assertRole(value: string): Role {
  if (!roles.includes(value as Role)) throw new Error("Invalid role");
  return value as Role;
}
export function assertDepartment(value: string): Department {
  if (!departments.includes(value as Department))
    throw new Error("Invalid department");
  return value as Department;
}
export { getAuth, getFirestore, Timestamp };
