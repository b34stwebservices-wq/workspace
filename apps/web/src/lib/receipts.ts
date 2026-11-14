import type { Timestamp } from "firebase/firestore";
import { auth } from "./firebase";

/** Written only by the server (api/send-receipt). Staff can read it, never write it. */
export type ReceiptInfo = {
  id: string; // same as the payment id
  receiptNumber: string;
  status: "pending" | "sent" | "failed";
  sentTo?: string;
  sentAt?: Timestamp;
  sendCount?: number;
};

export class ReceiptError extends Error {}

export async function sendReceipt(paymentId: string, resend = false) {
  const user = auth.currentUser;
  if (!user) throw new ReceiptError("Sign in again and retry.");
  let res: Response;
  try {
    res = await fetch("/api/send-receipt", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${await user.getIdToken()}`,
      },
      body: JSON.stringify({ paymentId, resend }),
    });
  } catch {
    throw new ReceiptError(
      "Could not reach the server. Check your connection.",
    );
  }
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    receiptNumber?: string;
    sentTo?: string;
  };
  if (!res.ok)
    throw new ReceiptError(data.error || "Could not send the receipt.");
  return data as { receiptNumber: string; sentTo: string };
}
