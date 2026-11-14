import { Navigate, Outlet } from "react-router-dom";
import type { Role } from "../lib/enums";
import { hasRole } from "../lib/roles";
import { useAuth } from "./AuthProvider";
export function RequireRole({ allowed }: { allowed: readonly Role[] }) {
  const { user, role, active, loading } = useAuth();
  if (loading) return <p className="p-6">Loading your account…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (!active || !hasRole(role, allowed))
    return <Navigate to="/access-denied" replace />;
  return <Outlet />;
}
