import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
export async function writeAudit(
  actorId: string,
  action: string,
  targetType: string,
  targetId: string,
) {
  await addDoc(collection(db, "auditLogs"), {
    actorId,
    action,
    targetType,
    targetId,
    createdAt: serverTimestamp(),
  });
}
