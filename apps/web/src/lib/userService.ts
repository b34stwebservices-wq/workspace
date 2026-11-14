import {
  createUserWithEmailAndPassword,
  deleteUser,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
} from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  Timestamp,
  writeBatch,
  type WriteBatch,
} from "firebase/firestore";
import { invalidate } from "./cache";
import type { Department, Role } from "./enums";
import { adminAuth, auth, db } from "./firebase";
import { deptForRole } from "./userManagement";

export type StaffRow = {
  uid: string;
  /** Present only when a roles/{uid} document exists. */
  access: { role: Role; dept: Department; active: boolean } | null;
  /** Present only when a users/{uid} document exists. */
  profile: {
    name: string;
    jobTitle: string;
    department: string;
    workEmail: string;
    status: "active" | "inactive";
  } | null;
  /** Present only when a userPrivate/{uid} document exists. */
  hr: HrDetails | null;
};

export type HrDetails = {
  phone: string;
  employmentType: string;
  reportsTo: string;
  startDate: Date | null;
  emergencyContact: string;
  hrNotes: string;
};

export type ProfileInput = {
  name: string;
  jobTitle: string;
  workEmail: string;
};

const stampCreate = (actor: string) => ({
  createdAt: serverTimestamp(),
  createdBy: actor,
  updatedAt: serverTimestamp(),
  updatedBy: actor,
});
const stampUpdate = (actor: string) => ({
  updatedAt: serverTimestamp(),
  updatedBy: actor,
});

function audit(batch: WriteBatch, actor: string, action: string, targetId: string) {
  batch.set(doc(collection(db, "auditLogs")), {
    actorId: actor,
    action,
    targetType: "user",
    targetId,
    createdAt: serverTimestamp(),
  });
}

/** Loads roles, public profiles and HR details, joined by uid. */
export async function loadRoster(): Promise<StaffRow[]> {
  const [roles, users, hr] = await Promise.all([
    getDocs(collection(db, "roles")),
    getDocs(collection(db, "users")),
    getDocs(collection(db, "userPrivate")),
  ]);
  const map = new Map<string, StaffRow>();
  const row = (uid: string) => {
    let existing = map.get(uid);
    if (!existing) {
      existing = { uid, access: null, profile: null, hr: null };
      map.set(uid, existing);
    }
    return existing;
  };
  for (const d of roles.docs) {
    const data = d.data();
    row(d.id).access = {
      role: data.role as Role,
      dept: data.dept as Department,
      active: data.active === true,
    };
  }
  for (const d of users.docs) {
    const data = d.data();
    row(d.id).profile = {
      name: String(data.name ?? ""),
      jobTitle: String(data.jobTitle ?? ""),
      department: String(data.department ?? ""),
      workEmail: String(data.workEmail ?? ""),
      status: data.status === "inactive" ? "inactive" : "active",
    };
  }
  for (const d of hr.docs) {
    const data = d.data();
    row(d.id).hr = {
      phone: String(data.phone ?? ""),
      employmentType: String(data.employmentType ?? ""),
      reportsTo: String(data.reportsTo ?? ""),
      startDate:
        data.startDate instanceof Timestamp ? data.startDate.toDate() : null,
      emergencyContact: String(data.emergencyContact ?? ""),
      hrNotes: String(data.hrNotes ?? ""),
    };
  }
  return [...map.values()];
}

function profileDoc(input: ProfileInput, department: Department, active: boolean) {
  return {
    name: input.name.trim(),
    jobTitle: input.jobTitle.trim(),
    department,
    workEmail: input.workEmail.trim().toLowerCase(),
    status: active ? "active" : "inactive",
  };
}

/**
 * Creates the Auth account on a secondary app instance, then writes roles +
 * profile + audit atomically. If the Firestore write fails the Auth account is
 * deleted again so no orphan (account without a role/profile) is left behind.
 */
export async function createStaffAccount(
  actorUid: string,
  input: ProfileInput & {
    password: string;
    role: Role;
    department: Department;
  },
): Promise<{ uid: string }> {
  const dept = deptForRole(input.role, input.department);
  const created = await createUserWithEmailAndPassword(
    adminAuth,
    input.workEmail.trim(),
    input.password,
  );
  try {
    await updateProfile(created.user, { displayName: input.name.trim() });
    const uid = created.user.uid;
    const batch = writeBatch(db);
    batch.set(doc(db, "roles", uid), {
      role: input.role,
      dept,
      active: true,
      ...stampCreate(actorUid),
    });
    batch.set(doc(db, "users", uid), {
      ...profileDoc(input, dept, true),
      ...stampCreate(actorUid),
    });
    audit(batch, actorUid, "user.created", uid);
    await batch.commit();
    invalidate("users");
    return { uid };
  } catch (error) {
    try {
      await deleteUser(created.user);
    } catch {
      // Best effort. The admin is told below that cleanup may be needed.
    }
    throw error;
  } finally {
    await signOut(adminAuth).catch(() => undefined);
  }
}

/** Gives an existing Auth account (by UID) a role and a proper profile. */
export async function grantAccessToExistingAccount(
  actorUid: string,
  uid: string,
  input: ProfileInput & { role: Role; department: Department },
) {
  const dept = deptForRole(input.role, input.department);
  const batch = writeBatch(db);
  batch.set(doc(db, "roles", uid), {
    role: input.role,
    dept,
    active: true,
    ...stampCreate(actorUid),
  });
  batch.set(doc(db, "users", uid), {
    ...profileDoc(input, dept, true),
    ...stampCreate(actorUid),
  });
  audit(batch, actorUid, "user.access_granted", uid);
  await batch.commit();
  invalidate("users");
}

export type HrInput = Omit<HrDetails, "startDate"> & { startDate: string };

function hrPayload(details: HrInput) {
  return {
    phone: details.phone.trim(),
    employmentType: details.employmentType.trim(),
    reportsTo: details.reportsTo.trim(),
    startDate: Timestamp.fromDate(new Date(`${details.startDate}T00:00:00Z`)),
    emergencyContact: details.emergencyContact.trim(),
    hrNotes: details.hrNotes.trim(),
  };
}

export type SaveStaffInput = {
  uid: string;
  actorUid: string;
  profile: ProfileInput;
  /** Omit when the admin is editing their own row: roles/{self} is immutable. */
  access?: { role: Role; department: Department; active: boolean };
  /** Existing row state, so we create vs update correctly. */
  existing: Pick<StaffRow, "access" | "profile">;
  /** Department stored on the public profile when access is not edited. */
  fallbackDepartment: Department;
  /** Optional HR record, saved in the same atomic batch. */
  hr?: { details: HrInput; exists: boolean };
};

/** One atomic save of access + profile (+ audit). */
export async function saveStaff(input: SaveStaffInput) {
  const { uid, actorUid, profile, access, existing } = input;
  const batch = writeBatch(db);
  const dept = access
    ? deptForRole(access.role, access.department)
    : (existing.access?.dept ?? input.fallbackDepartment);
  const active = access?.active ?? existing.access?.active ?? true;

  if (access) {
    const payload = {
      role: access.role,
      dept,
      active: access.active,
    };
    if (existing.access)
      batch.update(doc(db, "roles", uid), { ...payload, ...stampUpdate(actorUid) });
    else batch.set(doc(db, "roles", uid), { ...payload, ...stampCreate(actorUid) });
  }

  const publicPayload = profileDoc(profile, dept, active);
  if (existing.profile)
    batch.update(doc(db, "users", uid), { ...publicPayload, ...stampUpdate(actorUid) });
  else batch.set(doc(db, "users", uid), { ...publicPayload, ...stampCreate(actorUid) });

  if (access && existing.access) {
    if (existing.access.active && !access.active)
      audit(batch, actorUid, "user.deactivated", uid);
    else if (!existing.access.active && access.active)
      audit(batch, actorUid, "user.reactivated", uid);
    if (existing.access.role !== access.role || existing.access.dept !== dept)
      audit(batch, actorUid, "role.updated", uid);
  } else if (access) {
    audit(batch, actorUid, "role.assigned", uid);
  }
  audit(batch, actorUid, "user.updated", uid);
  if (input.hr) {
    const payload = hrPayload(input.hr.details);
    if (input.hr.exists)
      batch.update(doc(db, "userPrivate", uid), { ...payload, ...stampUpdate(actorUid) });
    else batch.set(doc(db, "userPrivate", uid), { ...payload, ...stampCreate(actorUid) });
    audit(batch, actorUid, "hr.updated", uid);
  }
  await batch.commit();
  invalidate("users");
}

export async function sendStaffPasswordReset(email: string, actorUid: string, uid: string) {
  await sendPasswordResetEmail(auth, email.trim());
  const batch = writeBatch(db);
  audit(batch, actorUid, "user.password_reset_sent", uid);
  await batch.commit();
}
