import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../../app/AuthProvider";
import { db } from "../../lib/firebase";
import { canViewStaffProfile, isAdmin } from "../../lib/roles";

type PublicProfile = {
  name: string;
  jobTitle: string;
  department: string;
  workEmail: string;
  status: "active" | "inactive";
};
type PrivateProfile = {
  phone?: string;
  employmentType?: string;
  reportsTo?: string;
  startDate?: { toDate?: () => Date };
  emergencyContact?: string;
  hrNotes?: string;
};

const departments: Record<string, string> = {
  technical: "Technical",
  business: "Business operations",
  digital: "Digital operations",
  creative: "Creative",
};

export function StaffProfilePage() {
  const { uid = "" } = useParams();
  const { user, role } = useAuth();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [privateProfile, setPrivateProfile] = useState<PrivateProfile | null>(null);
  const [privateAvailable, setPrivateAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const publicSnapshot = await getDoc(doc(db, "users", uid));
        if (!publicSnapshot.exists()) throw new Error("missing");
        if (!mounted) return;
        setProfile(publicSnapshot.data() as PublicProfile);
        if (canViewStaffProfile(role, user?.uid, uid)) {
          try {
            const privateSnapshot = await getDoc(doc(db, "userPrivate", uid));
            if (mounted && privateSnapshot.exists()) {
              setPrivateProfile(privateSnapshot.data() as PrivateProfile);
              setPrivateAvailable(true);
            }
          } catch {
            // Private HR data is intentionally not required for a public profile.
            if (mounted) setPrivateAvailable(false);
          }
        }
      } catch {
        if (mounted) setError("This staff profile could not be found or is not available to your account.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [uid, role, user?.uid]);

  const startDate = privateProfile?.startDate?.toDate?.();
  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <Link to="/directory" className="inline-flex min-h-10 items-center text-sm text-sky-300 hover:text-white">← Back to staff directory</Link>
      {loading ? <div className="panel p-10 text-center text-sm text-slate-500">Loading staff profile…</div> : error ? <div role="alert" className="panel p-8 text-sm text-rose-200">{error}</div> : profile ? <>
        <div className="panel overflow-hidden">
          <div className="h-2 bg-gradient-to-r from-sky-400 via-cyan-300 to-blue-500" />
          <div className="p-6 sm:p-8">
            <div className="flex flex-wrap items-start gap-4"><div className="grid h-16 w-16 place-items-center rounded-2xl border border-sky-400/20 bg-sky-400/10 text-2xl font-semibold text-sky-200">{(profile.name || "?").split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-3"><h1 className="text-2xl font-semibold tracking-tight text-white">{profile.name}</h1><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${profile.status === "active" ? "bg-emerald-400/10 text-emerald-300" : "bg-slate-700 text-slate-300"}`}>{profile.status}</span></div><p className="mt-1 text-sm text-slate-400">{profile.jobTitle || "Staff member"}</p><p className="mt-2 text-xs font-medium text-sky-300">{departments[profile.department] || profile.department}</p></div></div>
            <div className="mt-7 grid gap-4 border-t border-slate-800 pt-6 sm:grid-cols-2"><div><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Work email</p><a className="mt-1 block break-all text-sm text-slate-200 hover:text-sky-300" href={`mailto:${profile.workEmail}`}>{profile.workEmail || "Not provided"}</a></div><div><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Department</p><p className="mt-1 text-sm text-slate-200">{departments[profile.department] || profile.department || "Not assigned"}</p></div></div>
          </div>
        </div>
        {canViewStaffProfile(role, user?.uid, uid) && <div className="panel p-6 sm:p-8"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="eyebrow">RESTRICTED HR INFORMATION</p><h2 className="mt-2 text-lg font-semibold text-white">Employment details</h2><p className="mt-1 text-xs text-slate-500">Visible only to the employee and authorised administrators.</p></div><span className="rounded-full border border-slate-700 px-2.5 py-1 text-[10px] text-slate-400">Private</span></div>
          {privateAvailable && privateProfile ? <div className="mt-6 grid gap-5 sm:grid-cols-2">{[
            ["Phone", privateProfile.phone],
            ["Employment type", privateProfile.employmentType],
            ["Reports to (staff UID)", privateProfile.reportsTo],
            ["Start date", startDate ? startDate.toLocaleDateString("en-ZM", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lusaka" }) : ""],
          ].map(([label, value]) => <div key={label}><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 break-words text-sm text-slate-200">{value || "Not recorded"}</p></div>)}<div className="sm:col-span-2"><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Emergency contact</p><p className="mt-1 whitespace-pre-wrap text-sm text-slate-200">{privateProfile.emergencyContact || "Not recorded"}</p></div>{isAdmin(role) && <div className="sm:col-span-2"><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">HR notes</p><p className="mt-1 whitespace-pre-wrap text-sm text-slate-200">{privateProfile.hrNotes || "No HR notes"}</p></div>}</div> : <p className="mt-5 rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-400">No private employment record has been created for this staff member yet.</p>}
        </div>}
      </> : null}
    </section>
  );
}
