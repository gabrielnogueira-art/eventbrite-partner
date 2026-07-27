import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell, useIsAdmin } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { REGIONS } from "@/lib/regions";
import { Users, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/ejs")({
  component: AdminEjsPage,
});

function AdminEjsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: isAdmin } = useIsAdmin();
  useEffect(() => {
    if (isAdmin === false) navigate({ to: "/" });
  }, [isAdmin, navigate]);

  const [q, setQ] = useState("");
  const { data: profiles = [] } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () =>
      (await supabase.from("profiles").select("id, email, full_name, ej_name, ej_slug, region").order("ej_name"))
        .data ?? [],
  });

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return profiles;
    return profiles.filter((p: any) =>
      [p.ej_name, p.email, p.region, p.full_name].filter(Boolean).some((s: string) => s.toLowerCase().includes(t)),
    );
  }, [profiles, q]);

  const updateRegion = async (id: string, region: string) => {
    const { error } = await supabase.from("profiles").update({ region }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Região atualizada");
    qc.invalidateQueries({ queryKey: ["admin-profiles"] });
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl p-6 lg:p-10 space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">EJs cadastradas</h1>
            <p className="text-sm text-muted-foreground">Usuárias com login neste portal. Ajuste a região se necessário.</p>
          </div>
        </div>

        <Card className="p-4">
          <div className="relative mb-3">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por EJ, email ou região" className="pl-8" />
          </div>
          <div className="space-y-2">
            {filtered.map((p: any) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-sm">
                <div className="min-w-0">
                  <div className="font-medium">{p.ej_name ?? "(sem EJ cadastrada)"}</div>
                  <div className="text-xs text-muted-foreground">{p.email}</div>
                </div>
                <div className="w-56">
                  <Select value={p.region ?? ""} onValueChange={(v) => updateRegion(p.id, v)}>
                    <SelectTrigger><SelectValue placeholder="Sem região" /></SelectTrigger>
                    <SelectContent>
                      {REGIONS.map((r) => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="p-4 text-center text-sm text-muted-foreground">Nenhuma EJ encontrada.</div>
            )}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
