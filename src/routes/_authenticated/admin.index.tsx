import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, useIsAdmin } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Calendar } from "lucide-react";
import { fmtDate, fmtBRL } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminHome,
});

function AdminHome() {
  const navigate = useNavigate();
  const { data: isAdmin, isLoading: roleLoading } = useIsAdmin();
  useEffect(() => {
    if (!roleLoading && isAdmin === false) navigate({ to: "/" });
  }, [isAdmin, roleLoading, navigate]);

  const { data: events = [] } = useQuery({
    queryKey: ["admin-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select(
          "*, ticket_lots(sold_quantity, price_cents, total_quantity), orders(total_cents, status)",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!isAdmin,
  });

  if (!isAdmin)
    return (
      <AppShell>
        <div className="p-10 text-sm text-muted-foreground">Verificando permissão...</div>
      </AppShell>
    );

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl p-6 lg:p-10">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-primary">
              Painel Admin
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Gestão de eventos</h1>
          </div>
          <Button onClick={() => navigate({ to: "/admin/events/new" })}>
            <Plus className="mr-2 h-4 w-4" />
            Novo evento
          </Button>
        </div>

        <div className="grid gap-4">
          {events.map((e: any) => {
            const sold = (e.ticket_lots ?? []).reduce(
              (a: number, l: any) => a + l.sold_quantity,
              0,
            );
            const total = (e.ticket_lots ?? []).reduce(
              (a: number, l: any) => a + l.total_quantity,
              0,
            );
            const revenue = (e.orders ?? [])
              .filter((o: any) => o.status === "paid")
              .reduce((a: number, o: any) => a + o.total_cents, 0);
            return (
              <Link key={e.id} to="/admin/events/$id" params={{ id: e.id }}>
                <Card className="flex flex-wrap items-center gap-4 p-4 transition hover:shadow-md">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Calendar className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold uppercase tracking-wider text-primary">
                      {e.organizer}
                    </div>
                    <div className="truncate font-semibold">{e.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {fmtDate(e.starts_at)} · {e.location_name}
                    </div>
                  </div>
                  <div className="flex gap-6 text-right text-sm">
                    <div>
                      <div className="text-xs text-muted-foreground">Vendidos</div>
                      <div className="font-semibold">
                        {sold}/{total}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Receita</div>
                      <div className="font-semibold">{fmtBRL(revenue)}</div>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
          {events.length === 0 && (
            <Card className="p-10 text-center text-sm text-muted-foreground">
              Nenhum evento criado ainda.
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}
