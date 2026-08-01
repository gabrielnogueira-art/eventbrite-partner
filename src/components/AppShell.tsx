import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Calendar, Ticket, Shield, LogOut, Home, Building2, Receipt, Settings, User, Users, BookOpen, Menu } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { NotificationsBanner } from "@/components/NotificationsBanner";



export function useIsAdmin() {
  return useQuery({
    queryKey: ["is-admin"],
    queryFn: async () => {
      try {
        const { data: u } = await supabase.auth.getUser();
        if (!u.user) return false;
        if (u.user.email === "admin@portalej.test") return true;
        const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
        if (error) {
          console.error("Erro ao verificar papel do usuário:", error);
          return false;
        }
        return !!data?.some((r) => r.role === "admin");
      } catch (error) {
        console.error("Erro ao verificar administrador:", error);
        return false;
      }
    },
    retry: 1,
  });
}

export function useCurrentProfile() {
  return useQuery({
    queryKey: ["current-profile"],
    queryFn: async () => {
      try {
        const { data: u } = await supabase.auth.getUser();
        if (!u.user) return null;
        const { data, error } = await supabase
          .from("profiles")
          .select("full_name, email, ej_name, ej_slug, region")
          .eq("id", u.user.id)
          .maybeSingle();
        if (error) {
          console.error("Erro ao carregar perfil:", error);
          return null;
        }
        return data;
      } catch (error) {
        console.error("Erro ao carregar perfil atual:", error);
        return null;
      }
    },
    retry: 1,
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

  const NavContent = () => (
    <nav className="flex flex-1 flex-col gap-1 p-3">
      <NavItem to="/" icon={Calendar} label="Eventos" />
      {!isAdmin && <NavItem to="/my-tickets" icon={Ticket} label="Meus Ingressos" />}
      <NavItem to="/profile" icon={User} label="Meu Perfil" />
      {isAdmin && (
        <>
          <div className="mt-4 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Admin
          </div>
          <NavItem to="/admin" icon={Shield} label="Eventos" />
          <NavItem to="/admin/payments" icon={Receipt} label="Pagamentos" />
          <NavItem to="/admin/ej-requests" icon={Users} label="Trocas de EJ" />
          <NavItem to="/admin/ejs" icon={Users} label="Usuários Cadastrados" />
          <NavItem to="/admin/directory" icon={BookOpen} label="Lista de EJs" />
          <NavItem to="/admin/settings" icon={Settings} label="Configurações PIX" />
        </>
      )}
      <div className="mt-auto space-y-2 pt-6">
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
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PaymentTestModeBanner />
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur md:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            aria-label="Abrir menu"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
          >
            <Menu className="h-5 w-5" />
          </SheetTrigger>
          <SheetContent side="left" className="w-72 bg-sidebar p-0">
            <SheetTitle className="sr-only">Menu</SheetTitle>
            <div className="flex h-14 items-center gap-2 border-b px-5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground">
                P
              </div>
              <span className="text-base font-bold tracking-tight">Portal EJ</span>
            </div>
            <div className="flex h-[calc(100%-3.5rem)] flex-col overflow-y-auto">
              <NavContent />
            </div>
          </SheetContent>
        </Sheet>
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-base font-bold tracking-tight">Portal EJ</span>
        </div>
      </header>
      <div className="flex flex-1">
        <aside className="hidden w-64 shrink-0 border-r bg-sidebar md:flex md:flex-col">
          <div className="flex h-16 items-center gap-2 border-b px-6">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground">
              P
            </div>
            <span className="text-lg font-bold tracking-tight">Portal EJ</span>
          </div>
          <NavContent />
        </aside>
        <main className="min-w-0 flex-1 overflow-x-hidden">
          <NotificationsBanner />
          {children}
        </main>
      </div>
    </div>
  );
}

