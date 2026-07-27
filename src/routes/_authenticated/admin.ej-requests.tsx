import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell, useIsAdmin } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { Users, Check, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/ej-requests")({
  component: EjRequestsPage,
});

function EjRequestsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: isAdmin } = useIsAdmin();
  useEffect(() => {
    if (isAdmin === false) navigate({ to: "/" });
  }, [isAdmin, navigate]);

  const { data: requests = [] } = useQuery({
    queryKey: ["ej-change-requests"],
    queryFn: async () =>
      (
        await supabase
          .from("ej_change_requests" as any)
          .select("*")
          .order("created_at", { ascending: false })
      ).data ?? [],
  });

  const approve = async (id: string) => {
    const { error } = await supabase.rpc("approve_ej_change" as any, { _request_id: id } as any);
    if (error) return toast.error(error.message);
    toast.success("Aprovado");
    qc.invalidateQueries({ queryKey: ["ej-change-requests"] });
    qc.invalidateQueries({ queryKey: ["admin-profiles"] });
  };

  const reject = async (id: string) => {
    const notes = prompt("Motivo (opcional):") ?? undefined;
    const { error } = await supabase.rpc("reject_ej_change" as any, {
      _request_id: id,
      _notes: notes ?? null,
    } as any);
    if (error) return toast.error(error.message);
    toast.success("Rejeitado");
    qc.invalidateQueries({ queryKey: ["ej-change-requests"] });
  };

  const pending = (requests as any[]).filter((r) => r.status === "pending");
  const others = (requests as any[]).filter((r) => r.status !== "pending");

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-6 p-6 lg:p-10">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Trocas de EJ</h1>
            <p className="text-sm text-muted-foreground">
              Aprove ou rejeite solicitações de mudança de vínculo de EJ.
            </p>
          </div>
        </div>

        <Card className="space-y-2 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Pendentes ({pending.length})
          </h2>
          {pending.length === 0 && (
            <div className="p-3 text-center text-sm text-muted-foreground">
              Nenhuma solicitação pendente.
            </div>
          )}
          {pending.map((r: any) => (
            <div key={r.id} className="rounded-md border p-3 text-sm">
              <div className="mb-2">
                <div className="text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleString("pt-BR")}
                </div>
                <div>
                  De <span className="font-medium">{r.current_ej_name ?? "—"}</span> ({r.current_region ?? "—"})
                  {" → "}
                  <span className="font-medium">{r.requested_ej_name}</span> ({r.requested_region})
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => approve(r.id)}>
                  <Check className="mr-1 h-4 w-4" />Aprovar
                </Button>
                <Button size="sm" variant="outline" onClick={() => reject(r.id)}>
                  <X className="mr-1 h-4 w-4" />Rejeitar
                </Button>
              </div>
            </div>
          ))}
        </Card>

        {others.length > 0 && (
          <Card className="space-y-2 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Histórico
            </h2>
            {others.map((r: any) => (
              <div key={r.id} className="rounded-md border p-3 text-xs text-muted-foreground">
                <span className="mr-2 font-medium capitalize text-foreground">{r.status}</span>
                {r.current_ej_name ?? "—"} → {r.requested_ej_name} · {new Date(r.updated_at).toLocaleString("pt-BR")}
                {r.admin_notes ? ` · ${r.admin_notes}` : ""}
              </div>
            ))}
          </Card>
        )}
      </div>
    </AppShell>
  );
}
