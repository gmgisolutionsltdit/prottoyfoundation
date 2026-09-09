import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Role = "admin" | "super_admin" | "viewer";

interface AdminProfile {
  is_active: boolean;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isViewer: boolean;
  adminProfile: AdminProfile | null;
  profileLoaded: boolean;
  canAccessApp: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [loading, setLoading] = useState(true);

  // Which user we've already loaded a profile for. Used to tell a genuine
  // sign-in apart from a background token refresh.
  const loadedForUserId = useRef<string | null>(null);

  const loadUserContext = async (userId: string) => {
    const [rolesRes, profileRes] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("admin_profiles").select("is_active").eq("user_id", userId).maybeSingle(),
    ]);
    setRoles((rolesRes.data ?? []).map((r) => r.role as Role));
    setAdminProfile((profileRes.data as AdminProfile | null) ?? null);
    loadedForUserId.current = userId;
    setProfileLoaded(true);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        // Supabase fires TOKEN_REFRESHED / SIGNED_IN whenever the tab regains
        // focus or the token auto-refreshes. Blanking profileLoaded on those
        // makes ProtectedRoute swap the page for a spinner, which unmounts
        // everything — losing open forms and filter selections. Only block
        // the UI when this is a user we haven't loaded a profile for yet;
        // otherwise refresh roles quietly in the background.
        if (loadedForUserId.current !== newSession.user.id) {
          setProfileLoaded(false);
        }
        setTimeout(() => loadUserContext(newSession.user.id), 0);
      } else {
        loadedForUserId.current = null;
        setRoles([]);
        setAdminProfile(null);
        setProfileLoaded(true);
      }
    });

    supabase.auth.getSession().then(({ data: { session: existing } }) => {
      setSession(existing);
      setUser(existing?.user ?? null);
      if (existing?.user) {
        loadUserContext(existing.user.id);
      } else {
        setProfileLoaded(true);
      }
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const isAdmin = roles.includes("admin") || roles.includes("super_admin");
  const isSuperAdmin = roles.includes("super_admin");
  const isViewer = !isAdmin && roles.includes("viewer");
  const canAccessApp = (isAdmin || isViewer) && adminProfile?.is_active === true;

  return (
    <AuthContext.Provider
      value={{ user, session, loading, isAdmin, isSuperAdmin, isViewer, adminProfile, profileLoaded, canAccessApp, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
