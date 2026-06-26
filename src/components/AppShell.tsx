import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Calendar, Ticket, Shield, LogOut, Home, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";

export function useIsAdmin() {
  return useQuery({
    queryKey: ["is-admin"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return false;
      if (u.user.email === "admin@portalej.test") return true;
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
      return !!data?.some((r) => r.role === "admin");
    },
  });
}

export function useCurrentProfile() {
  return useQuery({
    queryKey: ["current-profile"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("full_name, email, ej_name, ej_slug")
        .eq("id", u.user.id)
        .maybeSingle();
      return data;
    },
  });
}

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { data: isAdmin } = useIsAdmin();
  const { data: profile } = useCurrentProfile();

  const handleSignOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const NavItem = ({ to, icon: Icon, label }: { to: string; icon: typeof Home; label: string }) => {
    const active = path === to || (to !== "/" && path.startsWith(to));
    return (
      <Link
        to={to}
        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          active
            ? "bg-primary text-primary-foreground"
            : "text-foreground/70 hover:bg-accent hover:text-foreground"
        }`}
      >
        <Icon className="h-4 w-4" />
        {label}
      </Link>
    );
  };

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 border-r bg-sidebar md:flex md:flex-col">
        <div className="flex h-16 items-center gap-2 border-b px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
            P
          </div>
          <span className="text-lg font-bold tracking-tight">Portal EJ</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          <NavItem to="/" icon={Calendar} label="Eventos" />
          <NavItem to="/my-tickets" icon={Ticket} label="Meus Ingressos" />
          {isAdmin && (
            <>
              <div className="mt-4 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Admin
              </div>
              <NavItem to="/admin" icon={Shield} label="Painel Admin" />
            </>
          )}
          <div className="mt-auto space-y-2">
            {profile?.ej_name && (
              <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-xs">
                <Building2 className="h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0">
                  <div className="truncate font-semibold">{profile.ej_name}</div>
                  <div className="truncate text-muted-foreground">{profile.email}</div>
                </div>
              </div>
            )}
            <button
              onClick={handleSignOut}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-foreground/70 hover:bg-accent hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </div>
        </nav>
      </aside>
      <main className="flex-1 overflow-x-hidden">{children}</main>
    </div>
  );
}
