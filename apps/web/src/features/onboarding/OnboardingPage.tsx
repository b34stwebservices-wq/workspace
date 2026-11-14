import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "../../app/AuthProvider";
import { writeAudit } from "../../lib/audit";
import { loadUsers, type Profile } from "../../lib/data";
import { EntityPicker } from "../../lib/ui";
import { db } from "../../lib/firebase";
import { canManageOnboarding } from "../../lib/roles";

type Item = { id: string; title: string; status: "not_started" | "in_progress" | "complete"; subjectId: string; department: string };

type FormState = {
  title: string;
  subjectId: string;
  department: "technical" | "business" | "digital" | "creative";
  status: Item["status"];
};

const initialForm: FormState = {
  title: "",
  subjectId: "",
  department: "technical",
  status: "not_started",
};

export function OnboardingPage() {
  const { user, role } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [staffById, setStaffById] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState<FormState>(initialForm);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user || !role) return;
    setLoading(true);
    setError("");
    try {
      const constraints = canManageOnboarding(role)
        ? [limit(100)]
        : [where("subjectId", "==", user.uid), limit(100)];
      const result = await getDocs(query(collection(db, "onboarding"), ...constraints));
      setItems(result.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<Item, "id">) })));
    } catch {
      setError("Could not load onboarding items available to your account.");
    } finally {
      setLoading(false);
    }
  }, [user, role]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    void loadUsers()
      .then((profiles) => {
        const map: Record<string, Profile> = {};
        for (const profile of profiles) map[profile.id] = profile;
        setStaffById(map);
      })
      .catch(() => setStaffById({}));
  }, []);

  const complete = useMemo(() => items.filter((item) => item.status === "complete").length, [items]);
  const progress = items.length ? Math.round((complete / items.length) * 100) : 0;
  const statusStyle: Record<Item["status"], string> = {
    not_started: "bg-slate-700 text-slate-300",
    in_progress: "bg-sky-400/10 text-sky-300",
    complete: "bg-emerald-400/10 text-emerald-300",
  };

  const staffName = (id: string) => staffById[id]?.name || staffById[id]?.workEmail || id;

  async function createItem(event: FormEvent) {
    event.preventDefault();
    if (!user || !canManageOnboarding(role) || !form.title.trim() || !form.subjectId.trim()) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      const ref = await addDoc(collection(db, "onboarding"), {
        title: form.title.trim(),
        subjectId: form.subjectId.trim(),
        department: form.department,
        status: form.status,
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
      });
      await writeAudit(user.uid, "onboarding.created", "onboarding", ref.id);
      setForm(initialForm);
      await load();
    } catch {
      setError("The onboarding item could not be created.");
    } finally {
      setBusy(false);
    }
  }

  async function updateStatus(item: Item, status: Item["status"]) {
    if (!user || !canManageOnboarding(role) || item.status === status) return;
    try {
      await updateDoc(doc(db, "onboarding", item.id), {
        status,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
      });
      await writeAudit(user.uid, "onboarding.status_changed", "onboarding", item.id);
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, status } : entry));
    } catch {
      setError("That checklist item could not be updated.");
    }
  }

  return (
    <section className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">PEOPLE & HR</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Onboarding</h1><p className="mt-2 text-sm text-slate-400">Track induction and setup activities for new team members.</p></div><button className="secondary-action" onClick={() => void load()} disabled={loading}>↻ &nbsp; Refresh</button></div>
      {canManageOnboarding(role) && (
        <form onSubmit={createItem} className="panel space-y-4 p-5 sm:p-6">
          <div>
            <p className="eyebrow">MANAGE CHECKLIST</p>
            <h2 className="mt-1 text-lg font-semibold text-white">Add onboarding item</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm text-slate-300">
              Title
              <input className="mt-2 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-sky-400" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Equipment setup" />
            </label>
            <EntityPicker label="Staff member" staff value={form.subjectId} onChange={(id) => setForm((current) => ({ ...current, subjectId: id }))} required />
            <label className="block text-sm text-slate-300">
              Department
              <select className="mt-2 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-sky-400" value={form.department} onChange={(event) => setForm((current) => ({ ...current, department: event.target.value as FormState["department"] }))}>
                <option value="technical">Technical</option>
                <option value="business">Business</option>
                <option value="digital">Digital</option>
                <option value="creative">Creative</option>
              </select>
            </label>
            <label className="block text-sm text-slate-300">
              Status
              <select className="mt-2 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-sky-400" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as Item["status"] }))}>
                <option value="not_started">Not started</option>
                <option value="in_progress">In progress</option>
                <option value="complete">Complete</option>
              </select>
            </label>
          </div>
          <div className="flex justify-end">
            <button type="submit" className="primary-action" disabled={busy || !form.title.trim() || !form.subjectId.trim()}>{busy ? "Saving…" : "Create item"}</button>
          </div>
        </form>
      )}
      <div className="panel p-5 sm:p-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs text-slate-500">Checklist completion</p><p className="mt-1 text-2xl font-semibold text-white">{loading ? "—" : `${progress}%`}</p></div><p className="text-xs text-slate-400">{loading ? "Loading…" : `${complete} of ${items.length} items complete`}</p></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-sky-400 transition-all" style={{ width: `${progress}%` }} /></div></div>
      {error && <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p>}
      {loading ? <div className="panel p-8 text-center text-sm text-slate-500">Loading checklist…</div> : items.length ? <div className="panel divide-y divide-slate-800">{items.map((item) => <article className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5" key={item.id}><div className="min-w-0"><h2 className="font-medium text-white">{item.title}</h2><p className="mt-1 text-xs capitalize text-slate-500">{item.department} department · {staffName(item.subjectId)} {canManageOnboarding(role) ? `· UID ${item.subjectId}` : ""}</p></div>{canManageOnboarding(role) ? <div className="flex items-center gap-2"><select className="min-h-11 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white" value={item.status} onChange={(event) => void updateStatus(item, event.target.value as Item["status"])}><option value="not_started">Not started</option><option value="in_progress">In progress</option><option value="complete">Complete</option></select><span className={`rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide ${statusStyle[item.status]}`}>{item.status.replace("_", " ")}</span></div> : <span className={`rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide ${statusStyle[item.status]}`}>{item.status.replace("_", " ")}</span>}</article>)}</div> : <div className="panel px-6 py-14 text-center"><h2 className="font-semibold text-white">No onboarding items yet</h2><p className="mx-auto mt-2 max-w-md text-sm text-slate-500">When a checklist is assigned to a staff member, its progress will appear here.</p></div>}
    </section>
  );
}
