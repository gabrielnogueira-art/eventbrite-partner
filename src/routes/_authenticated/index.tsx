import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Search, Calendar, MapPin } from "lucide-react";
import { useState, useMemo } from "react";
import { fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/")({
  component: EventsListPage,
});

function EventsListPage() {
  const [q, setQ] = useState("");

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("is_published", true)
        .order("starts_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(
    () =>
      events.filter((e) =>
        [e.title, e.organizer, e.location_name].join(" ").toLowerCase().includes(q.toLowerCase()),
      ),
    [events, q],
  );

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl p-6 lg:p-10">
        <div className="mb-6 flex items-baseline justify-between">
          <h1 className="text-2xl font-bold tracking-tight">
            Eventos <span className="text-muted-foreground">({events.length})</span>
          </h1>
        </div>

        <Card className="mb-6 p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Busca textual"
              className="pl-9 border-0 shadow-none focus-visible:ring-0"
            />
          </div>
        </Card>

        {isLoading ? (
          <div className="text-sm text-muted-foreground">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed p-12 text-center text-sm text-muted-foreground">
            Nenhum evento encontrado.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((e) => (
              <Link key={e.id} to="/events/$id" params={{ id: e.id }} className="group">
                <Card className="overflow-hidden p-0 transition hover:shadow-lg hover:-translate-y-0.5">
                  <div className="aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-primary/30 to-accent">
                    {e.cover_url ? (
                      <img
                        src={e.cover_url}
                        alt={e.title}
                        className="h-full w-full object-cover transition group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-3xl font-black text-primary/40">
                        {e.title.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2 p-4">
                    <div className="text-xs font-bold uppercase tracking-wider text-primary">
                      {e.organizer}
                    </div>
                    <h3 className="line-clamp-2 font-semibold leading-snug">{e.title}</h3>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      {fmtDate(e.starts_at)}
                    </div>
                    {e.location_name && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" />
                        {e.location_name}
                      </div>
                    )}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
