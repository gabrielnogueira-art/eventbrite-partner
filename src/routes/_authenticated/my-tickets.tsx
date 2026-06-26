import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { fmtBRL, fmtDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/my-tickets")({
  component: MyTicketsPage,
});

const statusLabel: Record<string, { label: string; cls: string }> = {
  paid: { label: "Pago", cls: "bg-success/15 text-success" },
  pending: { label: "Pagamento pendente", cls: "bg-amber-500/15 text-amber-700" },
  expired: { label: "Expirado", cls: "bg-muted text-muted-foreground" },
  cancelled: { label: "Cancelado", cls: "bg-destructive/10 text-destructive" },
};

function MyTicketsPage() {
  const { data: orders = [] } = useQuery({
    queryKey: ["my-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "*, events(title, starts_at, location_name), ticket_lots(name), order_participants(full_name, email)",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl p-6 lg:p-10">
        <h1 className="mb-6 text-2xl font-bold tracking-tight">Meus ingressos</h1>
        {orders.length === 0 ? (
          <Card className="p-10 text-center text-sm text-muted-foreground">
            Você ainda não comprou nenhum ingresso.
          </Card>
        ) : (
          <div className="space-y-4">
            {orders.map((o: any) => {
              const s = statusLabel[o.status] ?? statusLabel.pending;
              return (
                <Card key={o.id} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{o.events?.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {o.events?.starts_at && fmtDateTime(o.events.starts_at)} ·{" "}
                        {o.events?.location_name}
                      </div>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${s.cls}`}>
                      {s.label}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <div>
                      <span className="font-medium">{o.ticket_lots?.name}</span> · {o.quantity}{" "}
                      ingresso(s)
                    </div>
                    <div className="font-semibold">{fmtBRL(o.total_cents)}</div>
                  </div>
                  {o.order_participants?.length > 0 && (
                    <div className="mt-3 border-t pt-3 text-xs text-muted-foreground">
                      {o.order_participants.map((p: any, i: number) => (
                        <div key={i}>
                          {p.full_name} — {p.email}
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
