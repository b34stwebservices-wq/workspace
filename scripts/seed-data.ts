import {
  getAuth,
  getFirestore,
  requireArg,
  setupAdmin,
  Timestamp,
} from "./admin.js";

const now = Timestamp.now();

async function ensureAdmin(email: string, password: string) {
  try {
    return await getAuth().getUserByEmail(email);
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "auth/user-not-found"
    ) {
      return getAuth().createUser({
        email,
        password,
        displayName: "Seed Administrator",
        emailVerified: true,
      });
    }
    throw error;
  }
}

async function main() {
  setupAdmin();
  const email = requireArg("admin-email");
  const password = requireArg("admin-password");
  if (password.length < 14)
    throw new Error("Use an admin password with at least 14 characters");
  const admin = await ensureAdmin(email, password);
  const db = getFirestore();
  const batch = db.batch();
  const stamp = {
    createdAt: now,
    createdBy: admin.uid,
    updatedAt: now,
    updatedBy: admin.uid,
  };

  batch.set(db.doc(`roles/${admin.uid}`), {
    role: "admin",
    dept: "technical",
    active: true,
    ...stamp,
  });
  batch.set(db.doc(`users/${admin.uid}`), {
    name: "Seed Administrator",
    jobTitle: "CTO",
    department: "technical",
    workEmail: email,
    status: "active",
    ...stamp,
  });
  batch.set(db.doc("announcements/welcome"), {
    title: "Welcome to B34ST Staff",
    body: "This is placeholder seed data. Replace it before staff use.",
    status: "published",
    ...stamp,
  });
  batch.set(db.doc("tasks/welcome-task"), {
    title: "Review workspace access",
    description: "Confirm your role and profile details.",
    department: "technical",
    assigneeId: admin.uid,
    status: "todo",
    ...stamp,
  });
  batch.set(db.doc("onboarding/welcome-checklist"), {
    subjectId: admin.uid,
    title: "Complete workspace orientation",
    status: "not_started",
    department: "technical",
    ...stamp,
  });
  batch.set(db.doc("auditLogs/seed-initialization"), {
    actorId: admin.uid,
    action: "seed.initialized",
    targetType: "workspace",
    targetId: "initial",
    createdAt: now,
  });
  await batch.commit();
  console.log(`Seeded placeholder data. Sign in as ${email}.`);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Seed failed");
  process.exitCode = 1;
});
