import { collection, getDocs, limit, query } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../../lib/firebase";
import { DEPARTMENTS } from "../../lib/enums";

type UserProfile = {
  id: string;
  name: string;
  jobTitle: string;
  department: string;
  workEmail: string;
  status: "active" | "inactive";
};

const departmentNames: Record<string, string> = {
  technical: "Technical",
  business: "Business operations",
  digital: "Digital operations",
  creative: "Creative",
};

export function DirectoryPage() {
  const [items, setItems] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("all");
  const [status, setStatus] = useState("active");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    void (async () => {
      setLoading(true);
      try {
        // The directory contains public work profiles only. Private HR data is
        // deliberately fetched on the individual profile screen under rules.
        const result = await getDocs(query(collection(db, "users"), limit(200)));
        if (!mounted) return;
        setItems(result.docs.map((item) => ({
          id: item.id,
          ...(item.data() as Omit<UserProfile, "id">),
        })));
      } catch {
        if (mounted) setError("Could not load the staff directory. Check your access or try again.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((item) =>
      (status === "all" || item.status === status) &&
      (department === "all" || item.department === department) &&
      (!term || [item.name, item.jobTitle, item.workEmail, item.department].some((value) => value?.toLowerCase().includes(term))),
    ).sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
  }, [items, search, department, status]);

  const activeCount = items.filter((item) => item.status === "active").length;
  const departmentCount = new Set(items.filter((item) => item.status === "active").map((item) => item.department)).size;

  return (
    <section className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="eyebrow">PEOPLE & HR</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Staff directory</h1><p className="mt-2 max-w-xl text-sm text-slate-400">Find colleagues, understand team structure and open staff work profiles.</p></div>
        <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-300">{loading ? "Loading staff…" : `${activeCount} active staff`}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="panel p-4"><p className="text-xs text-slate-500">Staff records</p><p className="mt-2 text-2xl font-semibold text-white">{loading ? "—" : items.length}</p></div>
        <div className="panel p-4"><p className="text-xs text-slate-500">Active colleagues</p><p className="mt-2 text-2xl font-semibold text-white">{loading ? "—" : activeCount}</p></div>
        <div className="panel p-4"><p className="text-xs text-slate-500">Departments represented</p><p className="mt-2 text-2xl font-semibold text-white">{loading ? "—" : departmentCount}</p></div>
      </div>
      <div className="panel grid gap-3 p-4 md:grid-cols-[1fr_210px_150px]">
        <label className="block text-xs font-medium text-slate-400">Search colleagues<input className="mt-2 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-sky-400" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, role, email or department" /></label>
        <label className="block text-xs font-medium text-slate-400">Department<select className="mt-2 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white" value={department} onChange={(event) => setDepartment(event.target.value)}><option value="all">All departments</option>{DEPARTMENTS.map((value) => <option key={value} value={value}>{departmentNames[value]}</option>)}</select></label>
        <label className="block text-xs font-medium text-slate-400">Staff status<select className="mt-2 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white" value={status} onChange={(event) => setStatus(event.target.value)}><option value="active">Active</option><option value="inactive">Inactive</option><option value="all">All statuses</option></select></label>
      </div>
      {error && <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p>}
      {loading ? <div className="panel p-10 text-center text-sm text-slate-500">Loading staff profiles…</div> : visible.length ? <>
        <div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-white">Colleagues</h2><p className="text-xs text-slate-500">{visible.length} shown</p></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{visible.map((item) => <Link key={item.id} to={`/directory/${item.id}`} className="panel group p-5 transition hover:-translate-y-0.5 hover:border-sky-500/40 focus:outline-none focus:ring-2 focus:ring-sky-400">
          <div className="flex items-start gap-3"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-sky-400/20 bg-sky-400/10 text-lg font-semibold text-sky-200">{(item.name || "?").split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h3 className="truncate font-semibold text-white group-hover:text-sky-200">{item.name}</h3><span className={`h-2 w-2 shrink-0 rounded-full ${item.status === "active" ? "bg-emerald-400" : "bg-slate-500"}`} /></div><p className="mt-1 truncate text-sm text-slate-400">{item.jobTitle || "Staff member"}</p></div></div>
          <div className="mt-5 border-t border-slate-800 pt-4"><p className="text-xs font-medium text-sky-300">{departmentNames[item.department] || item.department || "Unassigned"}</p><p className="mt-1 truncate text-xs text-slate-500">{item.workEmail}</p><p className="mt-4 text-xs text-slate-400">View work profile <span aria-hidden="true">→</span></p></div>
        </Link>)}</div>
      </> : <div className="panel px-6 py-14 text-center"><h3 className="font-semibold text-white">No matching staff profiles</h3><p className="mt-2 text-sm text-slate-500">Try changing your search or filters.</p><button className="mt-4 text-sm text-sky-300" onClick={() => { setSearch(""); setDepartment("all"); setStatus("all"); }}>Clear filters</button></div>}
    </section>
  );
}
