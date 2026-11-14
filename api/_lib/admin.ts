import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

/**
 * FIREBASE_SERVICE_ACCOUNT_JSON holds the service-account JSON, either raw or
 * base64-encoded (base64 avoids newline problems in the Vercel env editor).
 * It is a server-only variable: never prefix it with VITE_.
 */
function credentials() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not set");
  const json = raw.startsWith("{")
    ? raw
    : Buffer.from(raw, "base64").toString("utf8");
  const parsed = JSON.parse(json) as {
    project_id: string;
    client_email: string;
    private_key: string;
  };
  return cert({
    projectId: parsed.project_id,
    clientEmail: parsed.client_email,
    privateKey: parsed.private_key.replace(/\\n/g, "\n"),
  });
}

function app(): App {
  return getApps()[0] ?? initializeApp({ credential: credentials() });
}

export const adminAuth = () => getAuth(app());
export const adminDb = () => getFirestore(app());
