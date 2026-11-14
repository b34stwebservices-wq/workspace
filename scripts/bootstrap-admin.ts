import {
  assertDepartment,
  assertRole,
  getAuth,
  getFirestore,
  requireArg,
  setupAdmin,
  Timestamp,
} from "./admin.js";
async function main() {
  setupAdmin();
  const email = requireArg("email");
  const role = assertRole(
    process.argv.find((v) => v.startsWith("--role="))?.slice(7) ?? "admin",
  );
  if (role !== "admin")
    throw new Error("Bootstrap account must have admin role");
  const dept = assertDepartment(
    process.argv.find((v) => v.startsWith("--dept="))?.slice(7) ?? "technical",
  );
  const user = await getAuth().getUserByEmail(email);
  const now = Timestamp.now();
  const stamp = {
    createdAt: now,
    createdBy: user.uid,
    updatedAt: now,
    updatedBy: user.uid,
  };
  const db = getFirestore();
  const batch = db.batch();
  batch.create(db.doc(`roles/${user.uid}`), {
    role,
    dept,
    active: true,
    ...stamp,
  });
  // Without a profile the admin is missing from the directory and pickers.
  batch.set(
    db.doc(`users/${user.uid}`),
    {
      name: user.displayName || email.split("@")[0],
      jobTitle: "CTO",
      department: dept,
      workEmail: email.toLowerCase(),
      status: "active",
      ...stamp,
    },
    { merge: true },
  );
  await batch.commit();
  console.log(`Bootstrapped admin ${user.uid}`);
}
void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Bootstrap failed");
  process.exitCode = 1;
});
