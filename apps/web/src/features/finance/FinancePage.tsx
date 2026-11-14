import { fmtDateTime, toDate, todayKey } from "../../lib/format";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  collection,
  doc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { useAuth } from "../../app/AuthProvider";
import { writeAudit } from "../../lib/audit";
import { db } from "../../lib/firebase";
import { sendReceipt, type ReceiptInfo } from "../../lib/receipts";
import { useToast } from "../../lib/toast";
import {
  Button,
  EmptyState,
  EntityPicker,
  ErrorNote,
  LoadingState,
  Modal,
  PageHeader,
  SelectField,
  StatusPill,
  TextAreaField,
  TextField,
  type EntityOption,
  type Tone,
} from "../../lib/ui";

type RecordItem = {
  id: string;
  kind: "quotation" | "invoice";
  number: string;
  clientId: string;
  clientName: string;
  title: string;
  description: string;
  amountZmw: number;
  paidAmountZmw: number;
  issueDate: string;
  dueDate: string;
  status: string;
};

type Client = { id: string; company: string };

type PaymentEntry = {
  id: string;
  invoiceId: string;
  amountZmw: number;
  date: string;
  method: string;
  reference: string;
};

type CreateForm = {
  kind: "quotation" | "invoice";
  clientId: string;
  title: string;
  description: string;
  amountZmw: string;
  issueDate: string;
  dueDate: string;
};

const blankForm = (): CreateForm => ({
  kind: "quotation",
  clientId: "",
  title: "",
  description: "",
  amountZmw: "",
  issueDate: todayKey(),
  dueDate: "",
});

const money = (n: number) =>
  new Intl.NumberFormat("en-ZM", {
    style: "currency",
    currency: "ZMW",
    maximumFractionDigits: 2,
  }).format(n || 0);

const quotationStatuses = ["draft", "sent", "accepted", "rejected"] as const;
// Partial/paid are derived from recorded payments and cannot be set by hand.
const invoiceManualStatuses = ["unpaid", "overdue", "void"] as const;
const round2 = (n: number) => Math.round(n * 100) / 100;

function statusTone(status: string): Tone {
  if (status === "paid" || status === "accepted") return "green";
  if (status === "partial" || status === "sent") return "blue";
  if (status === "rejected" || status === "void" || status === "unpaid")
    return status === "unpaid" ? "amber" : "red";
  return "slate";
}

export function FinancePage() {
  const { user } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState<RecordItem[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [receipts, setReceipts] = useState<Record<string, ReceiptInfo>>({});
  const [sendingId, setSendingId] = useState("");
  const [emailReceipt, setEmailReceipt] = useState(true);
  const [form, setForm] = useState<CreateForm>(blankForm);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<"all" | "quotation" | "invoice">("all");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [paying, setPaying] = useState<RecordItem | null>(null);
  const [payment, setPayment] = useState({
    amount: "",
    date: todayKey(),
    method: "Bank transfer",
    reference: "",
  });

  async function load() {
    const [recordsSnap, clientsSnap, paymentsSnap, receiptsSnap] =
      await Promise.all([
        getDocs(
          query(
            collection(db, "financeRecords"),
            orderBy("updatedAt", "desc"),
            limit(250),
          ),
        ),
        getDocs(
          query(collection(db, "clients"), orderBy("company"), limit(250)),
        ),
        getDocs(
          query(
            collection(db, "financePayments"),
            orderBy("createdAt", "desc"),
            limit(500),
          ),
        ),
        // Receipts are written by the server; if the rule is not deployed yet, the
        // rest of the page should still work.
        getDocs(query(collection(db, "receipts"), limit(500))).catch(
          () => null,
        ),
      ]);
    setReceipts(
      Object.fromEntries(
        (receiptsSnap?.docs ?? []).map((d) => [
          d.id,
          { id: d.id, ...d.data() } as ReceiptInfo,
        ]),
      ),
    );
    setItems(
      recordsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as RecordItem),
    );
    setClients(
      clientsSnap.docs.map((d) => ({
        id: d.id,
        company: String(d.data().company || ""),
      })),
    );
    setPayments(
      paymentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as PaymentEntry),
    );
  }

  useEffect(() => {
    setLoading(true);
    void load()
      .catch(() =>
        setError(
          "Could not load finance records. Check access and Firestore rules.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  const clientOptions: EntityOption[] = useMemo(
    () =>
      clients
        .map((c) => ({ id: c.id, label: c.company || c.id }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [clients],
  );

  const filtered = useMemo(
    () =>
      items.filter(
        (x) =>
          (kind === "all" || x.kind === kind) &&
          `${x.number} ${x.clientName} ${x.title}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [items, kind, search],
  );

  const invoices = items.filter((x) => x.kind === "invoice");
  const paidTotal = invoices.reduce((sum, x) => sum + x.paidAmountZmw, 0);
  const outstanding = invoices.reduce(
    (sum, x) => sum + Math.max(0, x.amountZmw - x.paidAmountZmw),
    0,
  );
  const overdueCount = invoices.filter((x) => {
    const balance = x.amountZmw - x.paidAmountZmw;
    return balance > 0 && x.dueDate && x.dueDate < todayKey();
  }).length;

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!user || !form.clientId || !form.title.trim() || !form.dueDate) return;
    const amount = round2(Number(form.amountZmw));
    const client = clients.find((c) => c.id === form.clientId);
    if (!client || !Number.isFinite(amount) || amount <= 0) {
      setError("Select a client and enter an amount greater than zero.");
      return;
    }
    if (form.dueDate < form.issueDate) {
      setError("The due date cannot be before the issue date.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      // The number comes from a counter that Firestore rules tie to this exact commit,
      // so two people saving at once can never be given the same number.
      const prefix = form.kind === "invoice" ? "B34ST-INV-" : "B34ST-QUO-";
      const taken = new Set(
        items
          .filter((x) => x.kind === form.kind)
          .map((x) => x.number.toLowerCase()),
      );
      const counterRef = doc(db, "financeCounters", form.kind);
      const recordRef = doc(collection(db, "financeRecords"));
      const number = await runTransaction(db, async (tx) => {
        const snap = await tx.get(counterRef);
        let last = snap.exists() ? Number(snap.data().last) : 0;
        let candidate: string;
        do {
          last += 1;
          candidate = `${prefix}${String(last).padStart(3, "0")}`;
        } while (taken.has(candidate.toLowerCase()));
        tx.set(counterRef, {
          last,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        });
        tx.set(recordRef, {
          kind: form.kind,
          number: candidate,
          clientId: form.clientId,
          clientName: client.company,
          title: form.title.trim(),
          description: form.description.trim(),
          amountZmw: amount,
          paidAmountZmw: 0,
          issueDate: form.issueDate,
          dueDate: form.dueDate,
          status: form.kind === "quotation" ? "draft" : "unpaid",
          createdAt: serverTimestamp(),
          createdBy: user.uid,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        });
        return candidate;
      });
      const ref = recordRef;
      await writeAudit(user.uid, `${form.kind}.created`, form.kind, ref.id);
      setForm(blankForm());
      setCreateOpen(false);
      await load();
      toast(
        `${form.kind === "quotation" ? "Quotation" : "Invoice"} ${number} created.`,
        "success",
      );
    } catch {
      setError("Could not create record. Check your role and Firestore rules.");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(item: RecordItem, status: string) {
    if (!user || status === item.status) return;
    try {
      await updateDoc(doc(db, "financeRecords", item.id), {
        status,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
      });
      await writeAudit(
        user.uid,
        `${item.kind}.status_changed`,
        item.kind,
        item.id,
      );
      await load();
      toast("Status updated.", "success");
    } catch {
      setError("Status update failed. Check your permissions.");
    }
  }

  async function recordPayment(e: FormEvent) {
    e.preventDefault();
    if (!user || !paying) return;
    const amount = round2(Number(payment.amount));
    const balance = round2(paying.amountZmw - paying.paidAmountZmw);
    if (!Number.isFinite(amount) || amount <= 0 || amount > balance) {
      setError(
        `Payment must be greater than zero and no more than ${money(balance)}.`,
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      const batch = writeBatch(db);
      const paymentRef = doc(collection(db, "financePayments"));
      const nextPaid = round2(paying.paidAmountZmw + amount);
      batch.set(paymentRef, {
        invoiceId: paying.id,
        invoiceNumber: paying.number,
        clientName: paying.clientName,
        amountZmw: amount,
        date: payment.date,
        method: payment.method,
        reference: payment.reference.trim(),
        createdAt: serverTimestamp(),
        createdBy: user.uid,
      });
      batch.update(doc(db, "financeRecords", paying.id), {
        paidAmountZmw: increment(amount),
        status: nextPaid >= paying.amountZmw ? "paid" : "partial",
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
      });
      await batch.commit();
      await writeAudit(
        user.uid,
        "invoice.payment_recorded",
        "invoice",
        paying.id,
      );
      const sendAfter = emailReceipt;
      setPaying(null);
      setPayment({
        amount: "",
        date: todayKey(),
        method: "Bank transfer",
        reference: "",
      });
      await load();
      toast("Payment recorded. No money transfer was processed.", "success");
      // The payment is already saved; a failed email must never undo it.
      if (sendAfter) await deliverReceipt(paymentRef.id, false);
    } catch {
      setError(
        "Could not record payment. Check your permissions and connection.",
      );
    } finally {
      setBusy(false);
    }
  }

  /** Emails the PDF receipt to the email on the invoice's client record (resolved server-side). */
  async function deliverReceipt(paymentId: string, resend: boolean) {
    setSendingId(paymentId);
    try {
      const sent = await sendReceipt(paymentId, resend);
      toast(
        `Receipt ${sent.receiptNumber} emailed to ${sent.sentTo}.`,
        "success",
      );
      await load();
    } catch (err) {
      toast(
        err instanceof Error
          ? `Payment saved, but the receipt was not sent: ${err.message}`
          : "The receipt was not sent.",
        "error",
      );
      await load().catch(() => undefined);
    } finally {
      setSendingId("");
    }
  }

  const statusOptions = (item: RecordItem) => {
    const base: readonly string[] =
      item.kind === "quotation" ? quotationStatuses : invoiceManualStatuses;
    const values = base.includes(item.status) ? base : [item.status, ...base];
    return values.map((value) => ({ value, label: value }));
  };
  /** Once money is recorded the status follows the payments, not a dropdown. */
  const statusLocked = (item: RecordItem) =>
    item.kind === "invoice" && item.paidAmountZmw > 0;

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Finance & administration"
        title="Quotations & invoices"
        description="Manage client billing and payment records in Zambian kwacha. This is a ledger only — it does not move money."
        actions={
          <Button
            onClick={() => {
              setForm(blankForm());
              setCreateOpen(true);
            }}
          >
            New record
          </Button>
        }
      />

      {error && <ErrorNote>{error}</ErrorNote>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="metric-card">
          <p className="text-xs text-slate-500">Invoices issued</p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {invoices.length}
          </p>
        </div>
        <div className="metric-card">
          <p className="text-xs text-slate-500">Payments recorded</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-300">
            {money(paidTotal)}
          </p>
        </div>
        <div className="metric-card">
          <p className="text-xs text-slate-500">Outstanding balance</p>
          <p className="mt-2 text-2xl font-semibold text-amber-200">
            {money(outstanding)}
          </p>
        </div>
        <div className="metric-card">
          <p className="text-xs text-slate-500">Overdue invoices</p>
          <p className="mt-2 text-2xl font-semibold text-red-300">
            {overdueCount}
          </p>
        </div>
      </div>

      <div className="panel flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <TextField
            label="Search"
            placeholder="Number, client or title…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="sm:w-48">
          <SelectField
            label="Type"
            value={kind}
            onChange={(e) =>
              setKind(e.target.value as "all" | "quotation" | "invoice")
            }
            options={[
              { value: "all", label: "All records" },
              { value: "quotation", label: "Quotations" },
              { value: "invoice", label: "Invoices" },
            ]}
          />
        </div>
      </div>

      {loading ? (
        <LoadingState label="Loading finance records…" rows={4} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No matching finance records"
          text="Create a quotation or invoice, or clear the search filters."
          action={
            <Button
              onClick={() => {
                setForm(blankForm());
                setCreateOpen(true);
              }}
            >
              New record
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((item) => {
            const balance = Math.max(0, item.amountZmw - item.paidAmountZmw);
            const itemPayments = payments.filter(
              (p) => p.invoiceId === item.id,
            );
            return (
              <article key={item.id} className="panel flex flex-col p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      {item.kind} · {item.number}
                    </p>
                    <h3 className="mt-1 text-base font-semibold text-white">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-sm text-slate-400">
                      {item.clientName}
                    </p>
                  </div>
                  <StatusPill tone={statusTone(item.status)}>
                    {item.status}
                  </StatusPill>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-slate-500">Amount</p>
                    <p className="font-medium text-white">
                      {money(item.amountZmw)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">
                      {item.kind === "invoice" ? "Balance due" : "Value"}
                    </p>
                    <p className="font-medium text-amber-200">
                      {item.kind === "invoice"
                        ? money(balance)
                        : money(item.amountZmw)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Issued</p>
                    <p className="text-slate-300">{item.issueDate || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Due</p>
                    <p className="text-slate-300">{item.dueDate || "—"}</p>
                  </div>
                </div>

                {item.description && (
                  <p className="mt-3 text-sm leading-6 text-slate-400">
                    {item.description}
                  </p>
                )}

                <div className="mt-4 grid gap-3 border-t border-slate-800 pt-4 sm:grid-cols-[1fr_auto] sm:items-end">
                  <SelectField
                    label="Update status"
                    value={item.status}
                    disabled={statusLocked(item)}
                    hint={
                      statusLocked(item)
                        ? "Follows recorded payments."
                        : undefined
                    }
                    onChange={(e) => void setStatus(item, e.target.value)}
                    options={statusOptions(item)}
                  />
                  {item.kind === "invoice" &&
                    item.status !== "void" &&
                    balance > 0 && (
                      <Button
                        variant="subtle"
                        className="sm:mb-0.5"
                        onClick={() => {
                          setPayment({
                            amount: balance.toFixed(2),
                            date: todayKey(),
                            method: "Bank transfer",
                            reference: "",
                          });
                          setEmailReceipt(true);
                          setPaying(item);
                        }}
                      >
                        Record payment
                      </Button>
                    )}
                </div>

                {item.kind === "invoice" && itemPayments.length > 0 && (
                  <div className="mt-4 border-t border-slate-800 pt-4">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Payment history
                    </p>
                    <div className="space-y-2">
                      {itemPayments.map((p) => {
                        const r = receipts[p.id];
                        const sentAt = toDate(r?.sentAt);
                        const sent = r?.status === "sent";
                        return (
                          <div key={p.id} className="text-xs text-slate-400">
                            <div className="flex flex-wrap justify-between gap-2">
                              <span>
                                {p.date} · {p.method}
                                {p.reference ? ` · ${p.reference}` : ""}
                              </span>
                              <span className="font-medium text-emerald-300">
                                {money(p.amountZmw)}
                              </span>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                              <span className="text-slate-500">
                                {sent
                                  ? `Receipt ${r.receiptNumber} sent to ${r.sentTo}${sentAt ? ` · ${fmtDateTime(sentAt)}` : ""}`
                                  : r?.status === "failed"
                                    ? `Receipt ${r.receiptNumber} failed to send`
                                    : "Receipt not sent"}
                              </span>
                              <Button
                                variant="subtle"
                                className="!min-h-8 !px-3 text-xs"
                                disabled={sendingId === p.id}
                                onClick={() => void deliverReceipt(p.id, sent)}
                              >
                                {sendingId === p.id
                                  ? "Sending…"
                                  : sent
                                    ? "Resend receipt"
                                    : "Send receipt"}
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {createOpen && (
        <Modal
          title="Create quotation or invoice"
          onClose={() => !busy && setCreateOpen(false)}
          footer={
            <>
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" form="finance-create-form" disabled={busy}>
                {busy ? "Saving…" : "Create record"}
              </Button>
            </>
          }
        >
          <form
            id="finance-create-form"
            onSubmit={create}
            className="grid gap-4 sm:grid-cols-2"
          >
            <SelectField
              label="Type"
              value={form.kind}
              onChange={(e) =>
                setForm({
                  ...form,
                  kind: e.target.value as CreateForm["kind"],
                })
              }
              options={[
                { value: "quotation", label: "Quotation" },
                { value: "invoice", label: "Invoice" },
              ]}
            />
            <p className="self-end pb-2 text-xs text-slate-500">
              The reference number is assigned automatically when you save.
            </p>
            <div className="sm:col-span-2">
              <EntityPicker
                label="Client"
                value={form.clientId}
                onChange={(id) => setForm({ ...form, clientId: id })}
                options={clientOptions}
                placeholder="Select client…"
                required
                hint={
                  clientOptions.length
                    ? undefined
                    : "No clients found. Add clients under Business first."
                }
              />
            </div>
            <TextField
              label="Amount (ZMW)"
              required
              type="number"
              min="0.01"
              step="0.01"
              value={form.amountZmw}
              onChange={(e) => setForm({ ...form, amountZmw: e.target.value })}
            />
            <TextField
              label="Service / title"
              required
              maxLength={180}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <TextField
              label="Issue date"
              required
              type="date"
              value={form.issueDate}
              onChange={(e) => setForm({ ...form, issueDate: e.target.value })}
            />
            <TextField
              label="Due date"
              required
              type="date"
              min={form.issueDate}
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            />
            <div className="sm:col-span-2">
              <TextAreaField
                label="Notes"
                rows={3}
                maxLength={2500}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </div>
          </form>
        </Modal>
      )}

      {paying && (
        <Modal
          title="Record invoice payment"
          onClose={() => !busy && setPaying(null)}
          footer={
            <>
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => setPaying(null)}
              >
                Cancel
              </Button>
              <Button type="submit" form="finance-payment-form" disabled={busy}>
                {busy ? "Saving…" : "Save payment"}
              </Button>
            </>
          }
        >
          <p className="mb-4 text-sm text-slate-400">
            {paying.number} · {paying.clientName} · Balance{" "}
            <span className="font-medium text-amber-200">
              {money(paying.amountZmw - paying.paidAmountZmw)}
            </span>
          </p>
          <form
            id="finance-payment-form"
            onSubmit={recordPayment}
            className="grid gap-4"
          >
            <TextField
              label="Amount received (ZMW)"
              required
              type="number"
              min="0.01"
              max={(paying.amountZmw - paying.paidAmountZmw).toFixed(2)}
              step="0.01"
              value={payment.amount}
              onChange={(e) =>
                setPayment({ ...payment, amount: e.target.value })
              }
            />
            <TextField
              label="Payment date"
              required
              type="date"
              value={payment.date}
              onChange={(e) => setPayment({ ...payment, date: e.target.value })}
            />
            <SelectField
              label="Method"
              value={payment.method}
              onChange={(e) =>
                setPayment({ ...payment, method: e.target.value })
              }
              options={[
                "Bank transfer",
                "Mobile money",
                "Cash",
                "Card",
                "Other",
              ].map((value) => ({ value, label: value }))}
            />
            <TextField
              label="Reference"
              maxLength={100}
              value={payment.reference}
              onChange={(e) =>
                setPayment({ ...payment, reference: e.target.value })
              }
              hint="Optional bank or mobile-money reference."
            />
            <label className="flex items-start gap-3 text-sm text-slate-300">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-[#2E9BFF]"
                checked={emailReceipt}
                onChange={(e) => setEmailReceipt(e.target.checked)}
              />
              <span>
                Email a PDF receipt to {paying.clientName} after saving
                <span className="block text-xs text-slate-500">
                  Sent to the email on the client record. If none is recorded,
                  the payment is still saved and you can send it later.
                </span>
              </span>
            </label>
          </form>
        </Modal>
      )}
    </section>
  );
}
