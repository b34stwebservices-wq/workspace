import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { loadUsers, type Profile } from "../../lib/data";
import { db } from "../../lib/firebase";

type Audit = {
  id: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  createdAt?: { toDate?: () => Date } | string | null;
};

const formatDate = (value: Audit["createdAt"]) => {
  if (!value) return "Unknown time";
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? "Unknown time" : parsed.toLocaleString();
  }
  if (typeof value.toDate === "function") {
    return value.toDate().toLocaleString();
  }
  return "Unknown time";
};

export function AuditLogPage() {
  const [items, setItems] = useState<Audit[]>([]);
  const [staffById, setStaffById] = useState<Record<string, Profile>>({});
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const result = await getDocs(
          query(
            collection(db, "auditLogs"),
            orderBy("createdAt", "desc"),
            limit(100),
          ),
        );
        setItems(
          result.docs.map((item) => ({
            id: item.id,
            ...(item.data() as Omit<Audit, "id">),
          })),
        );
      } catch {
        setError("Could not load audit history.");
      }
    })();
  }, []);

  useEffect(() => {
    void loadUsers()
      .then((profiles) => {
        const map: Record<string, Profile> = {};
        for (const profile of profiles) map[profile.id] = profile;
        setStaffById(map);
      })
      .catch(() => setStaffById({}));
  }, []);

  const actionOptions = useMemo(
    () => ["all", ...new Set(items.map((item) => item.action))],
    [items],
  );

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((item) => {
      const actionMatch = actionFilter === "all" || item.action === actionFilter;
      const searchMatch =
        !term ||
        [item.action, item.targetType, item.targetId, item.actorId, staffById[item.actorId]?.name, staffById[item.actorId]?.workEmail]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      return actionMatch && searchMatch;
    });
  }, [items, staffById, actionFilter, search]);

  const actorCount = new Set(items.map((item) => item.actorId)).size;
  const recent = visible.slice(0, 12);

  return (
    <section className="space-y-6">
      <div>
        <p className="eyebrow">ADMIN</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Audit history</h1>
        <p className="mt-2 text-sm text-slate-400">Review the most recent actions across the staff workspace and trace who changed key records.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="panel p-4">
          <p className="text-xs text-slate-500">Entries loaded</p>
          <p className="mt-2 text-2xl font-semibold text-white">{items.length}</p>
        </div>
        <div className="panel p-4">
          <p className="text-xs text-slate-500">Unique actors</p>
          <p className="mt-2 text-2xl font-semibold text-sky-300">{actorCount}</p>
        </div>
        <div className="panel p-4">
          <p className="text-xs text-slate-500">Recent view</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-300">{recent.length}</p>
        </div>
      </div>

      <div className="panel p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_220px]">
          <label className="block text-xs font-medium text-slate-400">
            Search audit trail
            <input
              className="mt-2 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-sky-400"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Action, target, actor or UID…"
            />
          </label>
          <label className="block text-xs font-medium text-slate-400">
            Action
            <select
              className="mt-2 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white"
              value={actionFilter}
              onChange={(event) => setActionFilter(event.target.value)}
            >
              {actionOptions.map((value) => (
                <option key={value} value={value}>
                  {value === "all" ? "All actions" : value}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {error && <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p>}
      {!error && !visible.length && <div className="panel px-6 py-14 text-center"><h2 className="font-semibold text-white">No audit entries match the current filters</h2><p className="mt-2 text-sm text-slate-500">Try clearing the search or showing all actions.</p></div>}

      {!error && visible.length > 0 && (
        <div className="panel overflow-hidden">
          <div className="border-b border-slate-800 px-5 py-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Most recent actions</p>
          </div>
          <ul className="divide-y divide-slate-800/80">
            {visible.map((item) => {
              const actor = staffById[item.actorId];
              return (
                <li key={item.id} className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-white">{item.action}</p>
                      <p className="mt-1 text-sm text-slate-400">
                        {item.targetType} · {staffById[item.targetId]?.name ?? item.targetId}
                      </p>
                    </div>
                    <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-[10px] uppercase tracking-wide text-slate-300">
                      {formatDate(item.createdAt)}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>Actor:</span>
                    <span className="text-slate-200">{actor?.name || item.actorId}</span>
                    {actor?.workEmail && <span className="text-slate-400">({actor.workEmail})</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
