import {
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../../app/AuthProvider";
import { auth } from "../../lib/firebase";
export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  if (!loading && user) return <Navigate to="/" replace />;
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      navigate("/");
    } catch (error) {
      const code =
        typeof error === "object" && error !== null && "code" in error
          ? String((error as { code: unknown }).code)
          : "";
      setMessage(
        code === "auth/user-disabled"
          ? "This account has been disabled. Contact an administrator."
          : code === "auth/too-many-requests"
            ? "Too many attempts. Wait a few minutes or reset your password."
            : "We could not sign you in. Check your details and try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function reset() {
    if (!email) return setMessage("Enter your work email first.");
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setMessage("If that account exists, a reset email has been sent.");
    } catch {
      setMessage("We could not send a reset email.");
    }
  }
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-slate-950 p-5">
      <div className="absolute -left-24 top-0 h-80 w-80 rounded-full bg-cyan-400/15 blur-3xl" />
      <div className="absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-indigo-500/15 blur-3xl" />
      <section className="app-card relative w-full max-w-md p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-cyan-400 font-bold text-slate-950">
            B
          </div>
          <div>
            <p className="font-semibold">B34ST Staff</p>
            <p className="text-xs text-slate-400">Internal workspace</p>
          </div>
        </div>
        <p className="eyebrow mt-9">Secure sign in</p>
        <h1 className="mt-2 text-2xl font-semibold">Welcome back</h1>
        <p className="mt-2 text-sm text-slate-300">
          Use your work account to access staff tools.
        </p>
        <form className="mt-7 space-y-4" onSubmit={submit}>
          <label className="block">
            Work email
            <input
              className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/70 p-3"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="block">
            Password
            <input
              className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/70 p-3"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button
            className="w-full rounded-xl bg-cyan-400 p-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-50"
            disabled={busy}
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <button
          className="mt-4 text-cyan-300 underline"
          type="button"
          onClick={reset}
        >
          Reset password
        </button>
        {message && (
          <p role="status" className="mt-4 text-sm text-slate-200">
            {message}
          </p>
        )}
      </section>
    </main>
  );
}
