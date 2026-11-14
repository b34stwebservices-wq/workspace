import {
  getAuth,
  getFirestore,
  requireArg,
  setupAdmin,
  Timestamp,
} from "./admin.js";
// Reverses disable-user: re-enables the sign-in and restores directory status.
// Role access itself is restored from the app (Staff access → Restore access).
async function main() {
  setupAdmin();
  const uid = requireArg("uid");
  const actorId = requireArg("actor-id");
  const db = getFirestore();
  const now = Timestamp.now();
  await getAuth().updateUser(uid, { disabled: false });
  const batch = db.batch();
  batch.update(db.doc(`roles/${uid}`), {
    active: true,
    updatedAt: now,
    updatedBy: actorId,
  });
  const profile = db.doc(`users/${uid}`);
  if ((await profile.get()).exists)
    batch.update(profile, { status: "active", updatedAt: now, updatedBy: actorId });
  batch.create(db.collection("auditLogs").doc(), {
    actorId,
    action: "user.reactivated",
    targetType: "role",
    targetId: uid,
    createdAt: now,
  });
  await batch.commit();
  console.log(`Re-enabled ${uid}.`);
}
void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Enable user failed");
  process.exitCode = 1;
});
