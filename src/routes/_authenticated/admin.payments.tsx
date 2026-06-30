import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, useIsAdmin } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { fmtBRL, fmtDateTime } from "@/lib/format";
import { toast } from "sonner";
import { ExternalLink, CheckCircle2, XCircle, Eye } from "lucide-react";
import { signedUrl } from "@/lib/storage";

export const Route = createFileRoute("/_authenticated/admin/payments")({
  component: AdminPaymentsPage,
});

function AdminPaymentsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: isAdmin, isLoading } = useIsAdmin();
  useEffect(() => {
    if (!isLoading && isAdmin === false) navigate({ to: "/" });
  }, [isAdmin, isLoading, navigate]);

  const { data: pending = [] } = useQuery({
    queryKey: ["admin-pending-payments"],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("*, events(title, starts_at), ticket_lots(name, price_cents)")
        .eq("status", "awaiting_review")
        .order("payment_proof_submitted_at", { ascending: true });
      return data ?? [];
    },
    enabled: !!isAdmin,
  });

  const userIds = Array.from(new Set(pending.map((o: any) => o.user_id))).filter(Boolean);
  const { data: profiles = [] } = useQuery({
    queryKey: ["pending-payers", userIds.sort().join(",")],
    queryFn: async () => {
      if (userIds.length === 0) return [];
      const { data } = await supabase
        .from("profiles")
        .select("id, ej_name, email, region")
        .in("id", userIds);
      return data ?? [];
    },
    enabled: userIds.length > 0,
  });
  const profileMap = new Map(profiles.map((p: any) => [p.id, p]));

  const [approving, setApproving] = useState<any | null>(null);
  const [rejecting, setRejecting] = useState<any | null>(null);
  const [redemptionLink, setRedemptionLink] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [proofUrl, setProofUrl] = useState<string | null>(null);

  const openApprove = async (order: any) => {
    setApproving(order);
    setRedemptionLink(order.redemption_link ?? "");
    setAdminNotes(order.admin_notes ?? "");
    setProofUrl(await signedUrl("payment-proofs", order.payment_proof_url ?? "", 3600));
  };

  const openReject = (order: any) => {
    setRejecting(order);
    setRejectReason("");
  };

  const openProof = async (path: string) => {
    const url = await signedUrl("payment-proofs", path, 3600);
    if (url) window.open(url, "_blank");
  };

  const confirmApprove = async () => {
    if (!approving) return;
    if (!redemptionLink.trim()) return toast.error("Informe o link de resgate");
    const { error } = await supabase.rpc("approve_order_by_admin", {
      _order_id: approving.id,
      _redemption_link: redemptionLink.trim(),
      _notes: adminNotes.trim() || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Pagamento aprovado e link liberado");
    setApproving(null);
    qc.invalidateQueries({ queryKey: ["admin-pending-payments"] });
  };

  const confirmReject = async () => {
    if (!rejecting) return;
    if (!rejectReason.trim()) return toast.error("Explique o motivo da rejeição");
    const { error } = await supabase.rpc("reject_payment_proof", {
      _order_id: rejecting.id,
      _notes: rejectReason.trim(),
    });
    if (error) return toast.error(error.message);
    toast.success("Pagamento rejeitado. A EJ poderá enviar novo comprovante.");
    setRejecting(null);
    qc.invalidateQueries({ queryKey: ["admin-pending-payments"] });
  };

  if (!isAdmin)
    return (
      <AppShell>
        <div className="p-10 text-sm text-muted-foreground">Verificando permissão...</div>
      </AppShell>
    );

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl p-6 lg:p-10 space-y-6">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-primary">Admin</div>
          <h1 className="text-2xl font-bold tracking-tight">Pagamentos pendentes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Confira o valor pago, o número de ingressos e libere o link de resgate.
          </p>
        </div>

        {pending.length === 0 ? (
          <Card className="p-10 text-center text-sm text-muted-foreground">
            Nenhum pagamento aguardando análise.
          </Card>
        ) : (
          <div className="space-y-3">
            {pending.map((o: any) => {
              const ej: any = profileMap.get(o.user_id) ?? {};
              return (
                <Card key={o.id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold">{o.events?.title}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {o.events?.starts_at && fmtDateTime(o.events.starts_at)}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary font-medium">
                          {ej.ej_name ?? "—"}
                        </span>
                        <span className="text-muted-foreground">{ej.email}</span>
                        {ej.region && (
                          <span className="text-muted-foreground">
                            Região: {ej.region.toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 text-sm">
                        <span className="font-medium">{o.quantity}</span> ingresso(s) ·{" "}
                        <span className="font-medium">{o.ticket_lots?.name}</span> ·{" "}
                        <span className="font-bold">{fmtBRL(o.total_cents)}</span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Comprovante enviado em {fmtDateTime(o.payment_proof_submitted_at)}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openProof(o.payment_proof_url)}
                      >
                        <Eye className="mr-1 h-3 w-3" /> Ver comprovante
                      </Button>
                      <Button size="sm" onClick={() => openApprove(o)}>
                        <CheckCircle2 className="mr-1 h-3 w-3" /> Aprovar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => openReject(o)}
                      >
                        <XCircle className="mr-1 h-3 w-3" /> Rejeitar
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          <Link to="/admin/settings" className="underline">
            Editar chave PIX e QR Code
          </Link>
        </div>
      </div>

      <Dialog open={!!approving} onOpenChange={(v) => !v && setApproving(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Aprovar pagamento</DialogTitle>
            <DialogDescription>
              Confirme que recebeu o valor de{" "}
              <strong>{approving && fmtBRL(approving.total_cents)}</strong> referente a{" "}
              <strong>{approving?.quantity}</strong> ingresso(s) e libere o link de resgate.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {proofUrl && (
              <a
                href={proofUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary underline"
              >
                <ExternalLink className="h-3 w-3" /> Abrir comprovante em nova aba
              </a>
            )}
            <div className="space-y-1">
              <Label>Link de resgate dos ingressos *</Label>
              <Input
                value={redemptionLink}
                onChange={(e) => setRedemptionLink(e.target.value)}
                placeholder="https://..."
              />
              <p className="text-xs text-muted-foreground">
                Esse link aparecerá em "Meus Ingressos" da EJ assim que você aprovar.
              </p>
            </div>
            <div className="space-y-1">
              <Label>Observações (opcional)</Label>
              <Textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproving(null)}>
              Cancelar
            </Button>
            <Button onClick={confirmApprove}>Confirmar aprovação</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejecting} onOpenChange={(v) => !v && setRejecting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rejeitar comprovante</DialogTitle>
            <DialogDescription>
              A EJ verá o motivo e poderá enviar um novo comprovante.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label>Motivo *</Label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="Ex.: valor incorreto, comprovante ilegível, etc."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmReject}>
              Rejeitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
