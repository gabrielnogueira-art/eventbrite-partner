import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, useCurrentProfile } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { fmtBRL, fmtDateTime } from "@/lib/format";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, ArrowRightLeft } from "lucide-react";
import {
  ParticipantFields,
  REGIONS_REQUIRING_CARAVAN,
  validateCaravan,
  type ParticipantData,
} from "@/components/ParticipantFields";

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
  const qc = useQueryClient();
  const { data: profile } = useCurrentProfile();
  const requireCaravan = REGIONS_REQUIRING_CARAVAN.includes(profile?.region ?? "");

  const { data: orders = [] } = useQuery({
    queryKey: ["my-orders"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const { data, error } = await supabase
        .from("orders")
        .select(
          "*, events(title, starts_at, location_name, transfer_deadline), ticket_lots(name), order_participants(*)",
        )
        .eq("user_id", u.user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const [editing, setEditing] = useState<{
    participant: ParticipantData & { id: string };
    eventStartsAt: string;
    transferDeadline: string | null;
  } | null>(null);
  const [transferring, setTransferring] = useState<{
    id: string;
    eventStartsAt: string;
    transferDeadline: string | null;
  } | null>(null);
  const [transferEmail, setTransferEmail] = useState("");

  const canTransfer = (deadline: string | null, starts: string) => {
    const limit = deadline ? new Date(deadline) : new Date(starts);
    return new Date() < limit;
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (requireCaravan) {
      const err = validateCaravan(editing.participant);
      if (err) return toast.error("Preencha todos os campos da caravana");
    }
    const { id, ...rest } = editing.participant;
    const { error } = await supabase
      .from("order_participants")
      .update(rest)
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Dados atualizados");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["my-orders"] });
  };

  const doTransfer = async () => {
    if (!transferring || !transferEmail) return;
    const { error } = await supabase.rpc("transfer_participant", {
      _participant_id: transferring.id,
      _target_email: transferEmail.trim(),
    });
    if (error) return toast.error(error.message);
    toast.success("Ingresso transferido");
    setTransferring(null);
    setTransferEmail("");
    qc.invalidateQueries({ queryKey: ["my-orders"] });
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl p-6 lg:p-10">
        <h1 className="mb-2 text-2xl font-bold tracking-tight">Meus ingressos</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Edite os dados de um participante ou transfira a titularidade para outra EJ até o prazo
          definido pelo organizador.
        </p>
        {orders.length === 0 ? (
          <Card className="p-10 text-center text-sm text-muted-foreground">
            Você ainda não comprou nenhum ingresso.
          </Card>
        ) : (
          <div className="space-y-4">
            {orders.map((o: any) => {
              const s = statusLabel[o.status] ?? statusLabel.pending;
              const transferable = canTransfer(
                o.events?.transfer_deadline ?? null,
                o.events?.starts_at,
              );
              return (
                <Card key={o.id} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{o.events?.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {o.events?.starts_at && fmtDateTime(o.events.starts_at)} ·{" "}
                        {o.events?.location_name}
                      </div>
                      {o.events?.transfer_deadline && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          Prazo para transferência: {fmtDateTime(o.events.transfer_deadline)}
                        </div>
                      )}
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
                    <div className="mt-3 space-y-2 border-t pt-3">
                      {o.order_participants.map((p: any) => (
                        <div
                          key={p.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-xs"
                        >
                          <div>
                            <div className="font-medium text-foreground">{p.full_name}</div>
                            <div className="text-muted-foreground">{p.email}</div>
                            {p.transferred_at && (
                              <div className="mt-0.5 text-[10px] uppercase tracking-wider text-primary">
                                Transferido em {fmtDateTime(p.transferred_at)}
                              </div>
                            )}
                          </div>
                          {o.status === "paid" && transferable && (
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  setEditing({
                                    participant: p,
                                    eventStartsAt: o.events.starts_at,
                                    transferDeadline: o.events.transfer_deadline,
                                  })
                                }
                              >
                                <Pencil className="mr-1 h-3 w-3" />
                                Editar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  setTransferring({
                                    id: p.id,
                                    eventStartsAt: o.events.starts_at,
                                    transferDeadline: o.events.transfer_deadline,
                                  })
                                }
                              >
                                <ArrowRightLeft className="mr-1 h-3 w-3" />
                                Transferir
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                      {o.status === "paid" && !transferable && (
                        <div className="text-xs text-muted-foreground">
                          Prazo para alterações/transferência encerrado.
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar participante</DialogTitle>
            <DialogDescription>
              Atualize os dados do participante. As alterações são imediatas.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <ParticipantFields
              value={editing.participant}
              onChange={(next) =>
                setEditing({ ...editing, participant: { ...next, id: editing.participant.id } })
              }
              requireCaravan={requireCaravan}
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button onClick={saveEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!transferring} onOpenChange={(v) => !v && setTransferring(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Transferir ingresso para outra EJ</DialogTitle>
            <DialogDescription>
              Informe o e-mail de login da EJ destino. Após confirmar, esta EJ perde acesso ao
              ingresso e a EJ destino passa a poder editá-lo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>E-mail da EJ destino</Label>
            <Input
              type="email"
              value={transferEmail}
              onChange={(e) => setTransferEmail(e.target.value)}
              placeholder="outra-ej@portalej.test"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferring(null)}>
              Cancelar
            </Button>
            <Button onClick={doTransfer}>Confirmar transferência</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
