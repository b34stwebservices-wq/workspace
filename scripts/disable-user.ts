import {
  getAuth,
  getFirestore,
  requireArg,
  setupAdmin,
  Timestamp,
} from "./admin.js";
async function main() {
  setupAdmin();
  const uid = requireArg("uid");
  const actorId = requireArg("actor-id");
  const db = getFirestore();
  const now = Timestamp.now();
  await db.runTransaction(async (tx) => {
    const role = db.doc(`roles/${uid}`);
    const profile = db.doc(`users/${uid}`);
    const [roleSnap, profileSnap] = await Promise.all([tx.get(role), tx.get(profile)]);
    if (!roleSnap.exists) throw new Error("Role document not found");
    tx.update(role, { active: false, updatedAt: now, updatedBy: actorId });
    if (profileSnap.exists)
      tx.update(profile, { status: "inactive", updatedAt: now, updatedBy: actorId });
    tx.create(db.collection("auditLogs").doc(), {
      actorId,
      action: "user.disabled",
      targetType: "role",
      targetId: uid,
      createdAt: now,
    });
  });
  await getAuth().updateUser(uid, { disabled: true });
  await getAuth().revokeRefreshTokens(uid);
  console.log(`Disabled ${uid} and revoked refresh tokens.`);
}
void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Disable user failed");
  process.exitCode = 1;
});
