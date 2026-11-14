import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";
import { clearCache } from "../lib/cache";
import { auth, db } from "../lib/firebase";
import { ROLES, type Role } from "../lib/enums";

type AuthState = {
  user: User | null;
  role: Role | null;
  active: boolean;
  loading: boolean;
};

const SIGNED_OUT: AuthState = {
  user: null,
  role: null,
  active: false,
  loading: false,
};

const AuthContext = createContext<AuthState>({ ...SIGNED_OUT, loading: true });

const isRole = (value: unknown): value is Role =>
  typeof value === "string" && (ROLES as readonly string[]).includes(value);

export function AuthProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<AuthState>({ ...SIGNED_OUT, loading: true });

  useEffect(() => {
    let stopRole: (() => void) | undefined;
    const stopAuth = onAuthStateChanged(auth, (user) => {
      stopRole?.();
      stopRole = undefined;
      clearCache();
      if (!user) {
        setState(SIGNED_OUT);
        return;
      }
      setState({ user, role: null, active: false, loading: true });
      // Live subscription: removing or changing someone's access takes effect
      // in their open session immediately instead of at their next reload.
      stopRole = onSnapshot(
        doc(db, "roles", user.uid),
        (snapshot) => {
          const data = snapshot.data();
          const allowed = data?.active === true && isRole(data.role);
          setState({
            user,
            role: allowed ? (data!.role as Role) : null,
            active: allowed,
            loading: false,
          });
        },
        // Rules deny reads once the role doc is inactive: treat as no access.
        () => setState({ user, role: null, active: false, loading: false }),
      );
    });
    return () => {
      stopRole?.();
      stopAuth();
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
