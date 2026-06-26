import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Minus, Plus } from "lucide-react";
import { fmtBRL, fmtDateTime } from "@/lib/format";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/events/$id")({
  component: EventPage,
});

function EventPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [qty, setQty] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);

  const { data: event } = useQuery({
    queryKey: ["event", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: lots = [] } = useQuery({
    queryKey: ["event-lots", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_lots")
        .select("*")
        .eq("event_id", id)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  if (!event)
    return (
      <AppShell>
        <div className="p-10 text-sm text-muted-foreground">Carregando...</div>
      </AppShell>
    );

  const max = event.max_tickets_per_user;
  const now = new Date();

  const handleReserve = async (lotId: string) => {
    const q = qty[lotId] ?? 0;
    if (q < 1) return toast.error("Selecione ao menos 1 ingresso");
    setBusy(true);
    const { data, error } = await supabase.rpc("create_reservation", {
      _lot_id: lotId,
      _quantity: q,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    navigate({ to: "/checkout/$orderId", params: { orderId: data as string } });
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl">
        <div className="aspect-[21/9] w-full overflow-hidden bg-gradient-to-br from-primary/40 to-accent">
          {event.cover_url ? (
            <img src={event.cover_url} alt={event.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-6xl font-black text-primary/40">
              {event.title.slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>
        <div className="p-6 lg:p-10">
          <h1 className="text-3xl font-bold tracking-tight">{event.title}</h1>
          <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              De {fmtDateTime(event.starts_at)} até {fmtDateTime(event.ends_at)}
            </div>
            {event.location_name && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {event.location_name}
              </div>
            )}
          </div>

          <h2 className="mt-8 text-lg font-semibold">Ingressos</h2>
          <div className="mt-3 space-y-3">
            {lots.length === 0 && (
              <div className="text-sm text-muted-foreground">Nenhum lote disponível.</div>
            )}
            {lots.map((l) => {
              const opens = new Date(l.opens_at);
              const closes = new Date(l.closes_at);
              const available = l.total_quantity - l.sold_quantity - l.reserved_quantity;
              const isOpen = now >= opens && now <= closes && available > 0;
              const status =
                available <= 0
                  ? "Esgotado"
                  : now < opens
                    ? `Abre em ${fmtDateTime(l.opens_at)}`
                    : now > closes
                      ? "Encerrado"
                      : null;
              const current = qty[l.id] ?? 0;
              return (
                <Card
                  key={l.id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-2.5 w-2.5 rounded-full ${isOpen ? "bg-success" : "bg-muted-foreground/40"}`}
                    />
                    <div>
                      <div className="font-medium">{l.name}</div>
                      {status && <div className="text-xs text-muted-foreground">{status}</div>}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-4 sm:gap-6">
                    <div className="text-right">
                      <div className="font-semibold">{fmtBRL(l.price_cents)}</div>
                      <div className="text-xs text-muted-foreground">{available} disponíveis</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="icon"
                        variant="outline"
                        disabled={!isOpen || current <= 0}
                        onClick={() =>
                          setQty((s) => ({ ...s, [l.id]: Math.max(0, (s[l.id] ?? 0) - 1) }))
                        }
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </Button>
                      <span className="w-6 text-center font-medium">{current}</span>
                      <Button
                        size="icon"
                        variant="outline"
                        disabled={!isOpen || current >= Math.min(max, available)}
                        onClick={() =>
                          setQty((s) => ({
                            ...s,
                            [l.id]: Math.min(max, available, (s[l.id] ?? 0) + 1),
                          }))
                        }
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <Button
                      disabled={!isOpen || current < 1 || busy}
                      onClick={() => handleReserve(l.id)}
                    >
                      Comprar
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Máximo de {max} ingressos por usuário. Reserva válida por 15 minutos após selecionar.
          </p>

          <div className="mt-10 grid gap-8 md:grid-cols-2">
            <section>
              <h2 className="mb-3 text-lg font-semibold">Descrição</h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/80">
                {event.description}
              </p>
              {event.cancellation_policy && (
                <>
                  <h2 className="mb-3 mt-8 text-lg font-semibold">Políticas de cancelamento</h2>
                  <p className="text-sm leading-relaxed text-foreground/80">
                    {event.cancellation_policy}
                  </p>
                </>
              )}
            </section>
            <section>
              <h2 className="mb-3 text-lg font-semibold">Local</h2>
              <Card className="p-4">
                <div className="font-medium">{event.location_name}</div>
                <div className="mt-1 text-sm text-muted-foreground">{event.address}</div>
              </Card>
            </section>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
