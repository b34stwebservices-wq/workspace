import { todayKey } from "../../lib/format";
import {
  collection,
  getDocs,
  limit,
  query,
  where,
  type QueryConstraint,
} from "firebase/firestore";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../app/AuthProvider";
import { db } from "../../lib/firebase";
import { canManageBusiness, canManageDigital } from "../../lib/roles";
import {
  Button,
  EmptyState,
  ErrorNote,
  LoadingState,
  PageHeader,
} from "../../lib/ui";

type Row = Record<string, unknown> & { id: string };
type Dataset = {
  tasks: Row[];
  projects: Row[];
  finance: Row[];
  leads: Row[];
  campaigns: Row[];
  posts: Row[];
  requests: Row[];
};

const empty: Dataset = {
  tasks: [],
  projects: [],
  finance: [],
  leads: [],
  campaigns: [],
  posts: [],
  requests: [],
};

const today = () => todayKey();

const money = (value: number) =>
  new Intl.NumberFormat("en-ZM", {
    style: "currency",
    currency: "ZMW",
    maximumFractionDigits: 2,
  }).format(value);

function csvCell(value: unknown) {
  const raw = String(value ?? "").replace(/[\r\n]+/g, " ");
  return `"${(/^[=+\-@]/.test(raw) ? `'${raw}` : raw).replace(/"/g, '""')}"`;
}

function downloadCsv(name: string, rows: Array<Record<string, unknown>>) {
  if (!rows.length) return;
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const csv = [
    headers.map(csvCell).join(","),
    ...rows.map((row) => headers.map((key) => csvCell(row[key])).join(",")),
  ].join("\r\n");
  const url = URL.createObjectURL(
    new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ReportsPage() {
  const { user, role } = useAuth();
  const canBusiness = canManageBusiness(role);
  const canDigital = canManageDigital(role);
  const [data, setData] = useState<Dataset>(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!user || !role) return;
    setLoading(true);
    setError("");
    try {
      const failed: string[] = [];
      const read = async (
        key: keyof Dataset,
        name: string,
        constraints: QueryConstraint[] = [],
      ): Promise<[keyof Dataset, Row[]]> => {
        try {
          const snap = await getDocs(
            query(collection(db, name), ...constraints, limit(500)),
          );
          return [
            key,
            snap.docs.map((d) => ({ id: d.id, ...d.data() })),
          ];
        } catch {
          failed.push(name);
          return [key, []];
        }
      };

      const jobs: Array<Promise<[keyof Dataset, Row[]]>> = [
        read(
          "tasks",
          "tasks",
          role === "admin"
            ? []
            : [
                where(
                  "department",
                  "==",
                  role === "bizops"
                    ? "business"
                    : role === "digitalops"
                      ? "digital"
                      : "creative",
                ),
              ],
        ),
      ];
      if (canBusiness) {
        jobs.push(read("projects", "projects"));
        jobs.push(read("finance", "financeRecords"));
        jobs.push(read("leads", "leads"));
      }
      if (canDigital) {
        jobs.push(read("campaigns", "digitalCampaigns"));
        jobs.push(read("posts", "socialPosts"));
        jobs.push(read("requests", "websiteRequests"));
      }

      const next = { ...empty };
      for (const [key, rows] of await Promise.all(jobs)) next[key] = rows;
      setData(next);
      if (failed.length)
        setError(
          `Some data could not be loaded (${failed.join(", ")}). Figures below may be incomplete.`,
        );
    } catch {
      setError("Report data could not be loaded for your role.");
    } finally {
      setLoading(false);
    }
  }, [user, role, canBusiness, canDigital]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => {
    const invoices = data.finance.filter(
      (r) => r.kind === "invoice" && r.status !== "void",
    );
    const outstanding = invoices.reduce(
      (s, r) =>
        s +
        Math.max(
          0,
          Number(r.amountZmw || 0) - Number(r.paidAmountZmw || 0),
        ),
      0,
    );
    const overdue = invoices.filter(
      (r) =>
        String(r.dueDate || "") < today() &&
        Number(r.amountZmw || 0) > Number(r.paidAmountZmw || 0),
    ).length;
    const impressions = data.campaigns.reduce(
      (s, r) => s + Number(r.impressions || 0),
      0,
    );
    const clicks = data.campaigns.reduce(
      (s, r) => s + Number(r.clicks || 0),
      0,
    );
    return {
      done: data.tasks.filter((r) => r.status === "done").length,
      total: data.tasks.length,
      outstanding,
      overdue,
      activeProjects: data.projects.filter((r) => r.status === "active")
        .length,
      ctr: impressions ? (clicks / impressions) * 100 : 0,
      leads: data.campaigns.reduce((s, r) => s + Number(r.leads || 0), 0),
      conversions: data.campaigns.reduce(
        (s, r) => s + Number(r.conversions || 0),
        0,
      ),
      openRequests: data.requests.filter(
        (r) => !["completed", "rejected"].includes(String(r.status)),
      ).length,
      impressions,
      clicks,
    };
  }, [data]);

  const exportAll = () => {
    const rows = [
      ...data.tasks.map((r) => ({
        type: "task",
        id: r.id,
        title: r.title,
        status: r.status,
      })),
      ...data.projects.map((r) => ({
        type: "project",
        id: r.id,
        name: r.name,
        status: r.status,
      })),
      ...data.finance.map((r) => ({
        type: "finance",
        id: r.id,
        kind: r.kind,
        number: r.number,
        status: r.status,
        amountZmw: r.amountZmw,
      })),
      ...data.leads.map((r) => ({
        type: "lead",
        id: r.id,
        company: r.company,
        stage: r.stage,
      })),
      ...data.campaigns.map((r) => ({
        type: "campaign",
        id: r.id,
        name: r.name,
        status: r.status,
        impressions: r.impressions,
        clicks: r.clicks,
      })),
      ...data.requests.map((r) => ({
        type: "website_request",
        id: r.id,
        title: r.title,
        status: r.status,
      })),
    ];
    downloadCsv(`b34st-report-${today()}.csv`, rows);
  };

  const taskStatuses = ["todo", "in_progress", "done"] as const;
  const maxTask = Math.max(
    1,
    ...taskStatuses.map(
      (status) => data.tasks.filter((r) => r.status === status).length,
    ),
  );

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Management intelligence"
        title="Reports"
        description="Snapshot of records your role can already read. Not live analytics — capped collection reads with CSV export."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => void load()} disabled={loading}>
              Refresh
            </Button>
            <Button
              variant="subtle"
              onClick={exportAll}
              disabled={loading}
            >
              Export CSV
            </Button>
          </div>
        }
      />

      {error && <ErrorNote>{error}</ErrorNote>}

      {loading ? (
        <LoadingState label="Building report…" rows={5} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="metric-card">
              <p className="text-xs text-slate-500">Tasks completed</p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {summary.done}/{summary.total}
              </p>
            </div>
            {canBusiness && (
              <>
                <div className="metric-card">
                  <p className="text-xs text-slate-500">Outstanding</p>
                  <p className="mt-2 text-2xl font-semibold text-amber-200">
                    {money(summary.outstanding)}
                  </p>
                </div>
                <div className="metric-card">
                  <p className="text-xs text-slate-500">Overdue invoices</p>
                  <p className="mt-2 text-2xl font-semibold text-rose-300">
                    {summary.overdue}
                  </p>
                </div>
                <div className="metric-card">
                  <p className="text-xs text-slate-500">Active projects</p>
                  <p className="mt-2 text-2xl font-semibold text-sky-300">
                    {summary.activeProjects}
                  </p>
                </div>
              </>
            )}
            {canDigital && (
              <>
                <div className="metric-card">
                  <p className="text-xs text-slate-500">Campaign CTR</p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {summary.ctr.toFixed(2)}%
                  </p>
                </div>
                <div className="metric-card">
                  <p className="text-xs text-slate-500">Open website requests</p>
                  <p className="mt-2 text-2xl font-semibold text-amber-200">
                    {summary.openRequests}
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <section className="panel p-5">
              <p className="eyebrow">Delivery</p>
              <h2 className="section-title mt-1">Task completion</h2>
              {summary.total === 0 ? (
                <div className="mt-4">
                  <EmptyState
                    title="No tasks in scope"
                    text="Task figures only include records visible to your role."
                  />
                </div>
              ) : (
                <div className="mt-5 space-y-3">
                  {taskStatuses.map((status) => {
                    const count = data.tasks.filter(
                      (r) => r.status === status,
                    ).length;
                    const pct = Math.round((count / maxTask) * 100);
                    const color =
                      status === "done"
                        ? "bg-emerald-400"
                        : status === "in_progress"
                          ? "bg-sky-400"
                          : "bg-amber-400";
                    return (
                      <div key={status}>
                        <div className="flex justify-between text-xs text-slate-400">
                          <span className="capitalize">
                            {status.replace("_", " ")}
                          </span>
                          <span>{count}</span>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-slate-800">
                          <div
                            className={`h-2 rounded-full ${color}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {canDigital && (
              <section className="panel p-5">
                <p className="eyebrow">Digital performance</p>
                <h2 className="section-title mt-1">Campaign funnel</h2>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  {[
                    ["Impressions", summary.impressions],
                    ["Clicks", summary.clicks],
                    ["Leads", summary.leads],
                    ["Conversions", summary.conversions],
                  ].map(([label, value]) => (
                    <div
                      key={String(label)}
                      className="rounded-xl bg-slate-900/70 p-4"
                    >
                      <p className="text-xs text-slate-500">{label}</p>
                      <p className="mt-2 text-2xl font-semibold text-white">
                        {Number(value).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-xs text-slate-500">
                  Campaign metrics are manually maintained, not live platform
                  analytics.
                </p>
              </section>
            )}

            {canBusiness && (
              <section className="panel p-5">
                <p className="eyebrow">Finance</p>
                <h2 className="section-title mt-1">Receivables snapshot</h2>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-slate-900/70 p-4">
                    <p className="text-xs text-slate-500">Invoices</p>
                    <p className="mt-2 text-2xl font-semibold text-white">
                      {
                        data.finance.filter((r) => r.kind === "invoice")
                          .length
                      }
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-900/70 p-4">
                    <p className="text-xs text-slate-500">Overdue</p>
                    <p className="mt-2 text-2xl font-semibold text-rose-300">
                      {summary.overdue}
                    </p>
                  </div>
                </div>
                <p className="mt-4 text-sm text-slate-300">
                  Outstanding:{" "}
                  <strong className="text-white">
                    {money(summary.outstanding)}
                  </strong>
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Invoice amount less recorded payments.
                </p>
              </section>
            )}

            {canBusiness && (
              <section className="panel p-5">
                <p className="eyebrow">Business development</p>
                <h2 className="section-title mt-1">Lead pipeline</h2>
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
                  {["New", "Contacted", "Proposal", "Won", "Lost"].map(
                    (stage) => (
                      <div
                        key={stage}
                        className="rounded-xl bg-slate-900/70 p-3"
                      >
                        <p className="text-xs text-slate-500">{stage}</p>
                        <p className="mt-1 text-xl font-semibold text-white">
                          {
                            data.leads.filter((r) => r.stage === stage)
                              .length
                          }
                        </p>
                      </div>
                    ),
                  )}
                </div>
              </section>
            )}
          </div>

          <p className="text-xs text-slate-600">
            Report generated {new Date().toLocaleString()} · Data is limited to
            records your account can read · CSV export includes only loaded
            records.
          </p>
        </>
      )}
    </section>
  );
}
