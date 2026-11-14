import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { useAuth } from "../../app/AuthProvider";
import { writeAudit } from "../../lib/audit";
import { db } from "../../lib/firebase";
import { canManageBusiness } from "../../lib/roles";
import { useToast } from "../../lib/toast";
import {
  Button,
  EmptyState,
  ErrorNote,
  LoadingState,
  Modal,
  PageHeader,
  SelectField,
  StatusPill,
  TextAreaField,
  TextField,
  type Tone,
} from "../../lib/ui";

type Client = {
  id: string;
  company: string;
  contactName: string;
  email: string;
  phone: string;
  industry: string;
  status: "active" | "inactive";
  notes: string;
};

const blank = (): ClientForm => ({
  company: "",
  contactName: "",
  email: "",
  phone: "",
  industry: "",
  status: "active",
  notes: "",
});

type ClientForm = Omit<Client, "id">;

function statusTone(status: Client["status"]): Tone {
  return status === "active" ? "green" : "slate";
}

export function ClientsPage() {
  const { user, role } = useAuth();
  const toast = useToast();
  const canManage = canManageBusiness(role);
  const [items, setItems] = useState<Client[]>([]);
  const [form, setForm] = useState(blank);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">(
    "all",
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function load() {
    const snap = await getDocs(
      query(collection(db, "clients"), orderBy("company"), limit(200)),
    );
    setItems(
      snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Client, "id">) })),
    );
  }

  useEffect(() => {
    setLoading(true);
    void load()
      .catch(() =>
        setError("Could not load clients. Check your access and connection."),
      )
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(
    () =>
      items.filter(
        (x) =>
          (statusFilter === "all" || x.status === statusFilter) &&
          `${x.company} ${x.contactName} ${x.industry} ${x.email}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [items, search, statusFilter],
  );

  const activeCount = items.filter((x) => x.status === "active").length;

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!user || !form.company.trim() || !form.contactName.trim()) return;
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setError("Enter a valid email address or leave it blank.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (editingId) {
        await updateDoc(doc(db, "clients", editingId), {
          company: form.company.trim(),
          contactName: form.contactName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          industry: form.industry.trim(),
          status: form.status,
          notes: form.notes.trim(),
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        });
        await writeAudit(user.uid, "client.updated", "client", editingId);
        setEditingId(null);
        setCreateOpen(false);
        setForm(blank());
        await load();
        toast("Client updated.", "success");
        return;
      }
      const ref = await addDoc(collection(db, "clients"), {
        company: form.company.trim(),
        contactName: form.contactName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        industry: form.industry.trim(),
        status: form.status,
        notes: form.notes.trim(),
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
      });
      await writeAudit(user.uid, "client.created", "client", ref.id);
      setForm(blank());
      setCreateOpen(false);
      await load();
      toast("Client saved.", "success");
    } catch {
      setError(
        "Client could not be saved. Verify your role and required fields.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Business development"
        title="Clients"
        description={
          canManage
            ? "Organisation directory for Admin and BizOps. Used by projects and finance records."
            : "Your access to the client registry is restricted."
        }
        actions={
          <Button
            onClick={() => {
              setForm(blank());
              setEditingId(null);
              setCreateOpen(true);
            }}
          >
            Add client
          </Button>
        }
      />

      {error && <ErrorNote>{error}</ErrorNote>}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="metric-card">
          <p className="text-xs text-slate-500">Clients</p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {items.length}
          </p>
        </div>
        <div className="metric-card">
          <p className="text-xs text-slate-500">Active</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-300">
            {activeCount}
          </p>
        </div>
        <div className="metric-card">
          <p className="text-xs text-slate-500">Inactive</p>
          <p className="mt-2 text-2xl font-semibold text-slate-300">
            {items.length - activeCount}
          </p>
        </div>
      </div>

      <div className="panel flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <TextField
            label="Search"
            placeholder="Organisation, contact or industry…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="sm:w-48">
          <SelectField
            label="Status"
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as "all" | "active" | "inactive")
            }
            options={[
              { value: "all", label: "All" },
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
            ]}
          />
        </div>
      </div>

      {loading ? (
        <LoadingState label="Loading clients…" rows={4} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No client records found"
          text="Add a client organisation to link projects and invoices."
          action={
            <Button
              onClick={() => {
                setForm(blank());
                setEditingId(null);
                setCreateOpen(true);
              }}
            >
              Add client
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filtered.map((x) => (
            <article key={x.id} className="panel p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-white">{x.company}</h3>
                  <p className="mt-1 text-sm text-slate-400">{x.contactName}</p>
                </div>
                <StatusPill tone={statusTone(x.status)}>{x.status}</StatusPill>
              </div>
              <div className="mt-4 grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
                <p>{x.email || "No email recorded"}</p>
                <p>{x.phone || "No phone recorded"}</p>
                <p>{x.industry || "Industry not specified"}</p>
              </div>
              {x.notes && (
                <p className="mt-3 border-t border-slate-800 pt-3 text-sm text-slate-400">
                  {x.notes}
                </p>
              )}
              <div className="mt-4">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setForm({
                      company: x.company,
                      contactName: x.contactName,
                      email: x.email,
                      phone: x.phone,
                      industry: x.industry,
                      status: x.status,
                      notes: x.notes,
                    });
                    setEditingId(x.id);
                    setCreateOpen(true);
                  }}
                >
                  Edit
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      {createOpen && (
        <Modal
          title={editingId ? "Edit client" : "Add client"}
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
              <Button type="submit" form="client-create-form" disabled={busy}>
                {busy ? "Saving…" : editingId ? "Save changes" : "Save client"}
              </Button>
            </>
          }
        >
          <form
            id="client-create-form"
            onSubmit={create}
            className="grid gap-4 sm:grid-cols-2"
          >
            <TextField
              label="Company / organisation"
              required
              maxLength={160}
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
            />
            <TextField
              label="Primary contact"
              required
              maxLength={160}
              value={form.contactName}
              onChange={(e) =>
                setForm({ ...form, contactName: e.target.value })
              }
            />
            <TextField
              label="Email address"
              type="email"
              maxLength={254}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <TextField
              label="Phone number"
              maxLength={40}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
            <TextField
              label="Industry"
              maxLength={120}
              value={form.industry}
              onChange={(e) => setForm({ ...form, industry: e.target.value })}
            />
            <SelectField
              label="Status"
              value={form.status}
              onChange={(e) =>
                setForm({
                  ...form,
                  status: e.target.value as "active" | "inactive",
                })
              }
              options={[
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
              ]}
            />
            <div className="sm:col-span-2">
              <TextAreaField
                label="Relationship notes"
                rows={3}
                maxLength={3000}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
