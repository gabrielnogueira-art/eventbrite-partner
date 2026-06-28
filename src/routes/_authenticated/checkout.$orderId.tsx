import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, useCurrentProfile } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { fmtBRL } from "@/lib/format";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Clock, ShieldCheck } from "lucide-react";
import {
  ParticipantFields,
  emptyParticipant,
  validateCaravan,
  REGIONS_REQUIRING_CARAVAN,
  type ParticipantData,
} from "@/components/ParticipantFields";

export const Route = createFileRoute("/_authenticated/checkout/$orderId")({
  component: CheckoutPage,
});

function CheckoutPage() {
  const { orderId } = Route.useParams();
  const navigate = useNavigate();
  const [remaining, setRemaining] = useState<number>(0);
  const [participants, setParticipants] = useState<{ full_name: string; email: string }[]>([]);
  const [billing, setBilling] = useState({
    doc_type: "cpf",
    doc: "",
    phone: "",
    zip: "",
    street: "",
    number: "",
    district: "",
    state: "",
    city: "",
    complement: "",
  });
  const [method, setMethod] = useState<"pix" | "credit_card">("pix");
  const [busy, setBusy] = useState(false);

  const { data: order } = useQuery({
    queryKey: ["order", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, events(title, cover_url), ticket_lots(name, price_cents)")
        .eq("id", orderId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!order) return;
    setParticipants((prev) =>
      prev.length === order.quantity
        ? prev
        : Array.from({ length: order.quantity }, (_, i) => prev[i] ?? { full_name: "", email: "" }),
    );
  }, [order]);

  useEffect(() => {
    if (!order) return;
    const tick = () => {
      const r = Math.max(
        0,
        Math.floor((new Date(order.reserved_until).getTime() - Date.now()) / 1000),
      );
      setRemaining(r);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [order]);

  if (!order)
    return (
      <AppShell>
        <div className="p-10 text-sm text-muted-foreground">Carregando...</div>
      </AppShell>
    );

  if (order.status !== "pending") {
    return (
      <AppShell>
        <div className="mx-auto max-w-md p-10 text-center">
          <h2 className="text-xl font-semibold">
            Pedido {order.status === "paid" ? "pago" : order.status}
          </h2>
          <Button className="mt-4" onClick={() => navigate({ to: "/my-tickets" })}>
            Ver meus ingressos
          </Button>
        </div>
      </AppShell>
    );
  }

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const expired = remaining === 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (participants.some((p) => !p.full_name || !p.email))
      return toast.error("Preencha todos os participantes");
    if (
      !billing.doc ||
      !billing.zip ||
      !billing.street ||
      !billing.number ||
      !billing.city ||
      !billing.state
    )
      return toast.error("Preencha os dados de cobrança");
    setBusy(true);

    await supabase.from("order_participants").delete().eq("order_id", orderId);
    const { error: pErr } = await supabase
      .from("order_participants")
      .insert(participants.map((p) => ({ ...p, order_id: orderId })));
    if (pErr) {
      setBusy(false);
      return toast.error(pErr.message);
    }

    await supabase
      .from("orders")
      .update({
        billing_doc_type: billing.doc_type,
        billing_doc: billing.doc,
        billing_phone: billing.phone,
        billing_zip: billing.zip,
        billing_street: billing.street,
        billing_number: billing.number,
        billing_district: billing.district,
        billing_state: billing.state,
        billing_city: billing.city,
        billing_complement: billing.complement,
        payment_method: method,
      })
      .eq("id", orderId);

    const { error } = await supabase.rpc("confirm_payment", {
      _order_id: orderId,
      _method: method,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Pagamento confirmado!");
    navigate({ to: "/my-tickets" });
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl p-6 lg:p-10">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-primary">Checkout</div>
            <h1 className="text-xl font-semibold">{order.events?.title}</h1>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-success/10 px-3 py-1.5 text-xs font-medium text-success">
            <ShieldCheck className="h-3.5 w-3.5" />
            Pagamento em ambiente protegido
          </div>
        </div>

        <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            <Card className="p-6">
              <div className="mb-1 inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                Participantes
              </div>
              <h2 className="text-lg font-semibold">Informações do participante</h2>
              <p className="mb-4 text-sm text-muted-foreground">
                Preencha os dados como devem aparecer no ingresso.
              </p>
              <div className="space-y-4">
                {participants.map((p, i) => (
                  <div key={i} className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label>Participante #{i + 1} — Nome</Label>
                      <Input
                        value={p.full_name}
                        onChange={(e) =>
                          setParticipants((s) =>
                            s.map((x, j) => (j === i ? { ...x, full_name: e.target.value } : x)),
                          )
                        }
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>E-mail</Label>
                      <Input
                        type="email"
                        value={p.email}
                        onChange={(e) =>
                          setParticipants((s) =>
                            s.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)),
                          )
                        }
                        required
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <div className="mb-1 inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                Cobrança
              </div>
              <h2 className="text-lg font-semibold">Dados de faturamento</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Tipo de documento</Label>
                  <RadioGroup
                    value={billing.doc_type}
                    onValueChange={(v) => setBilling({ ...billing, doc_type: v })}
                    className="flex gap-4"
                  >
                    <label className="flex items-center gap-2">
                      <RadioGroupItem value="cpf" /> CPF
                    </label>
                    <label className="flex items-center gap-2">
                      <RadioGroupItem value="cnpj" /> CNPJ
                    </label>
                  </RadioGroup>
                </div>
                <div className="space-y-1">
                  <Label>Documento *</Label>
                  <Input
                    value={billing.doc}
                    onChange={(e) => setBilling({ ...billing, doc: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label>Telefone</Label>
                  <Input
                    value={billing.phone}
                    onChange={(e) => setBilling({ ...billing, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>CEP *</Label>
                  <Input
                    value={billing.zip}
                    onChange={(e) => setBilling({ ...billing, zip: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label>Rua/Av. *</Label>
                  <Input
                    value={billing.street}
                    onChange={(e) => setBilling({ ...billing, street: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label>Número *</Label>
                  <Input
                    value={billing.number}
                    onChange={(e) => setBilling({ ...billing, number: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label>Bairro</Label>
                  <Input
                    value={billing.district}
                    onChange={(e) => setBilling({ ...billing, district: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Estado *</Label>
                  <Input
                    value={billing.state}
                    onChange={(e) => setBilling({ ...billing, state: e.target.value })}
                    required
                    maxLength={2}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Cidade *</Label>
                  <Input
                    value={billing.city}
                    onChange={(e) => setBilling({ ...billing, city: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label>Complemento</Label>
                  <Input
                    value={billing.complement}
                    onChange={(e) => setBilling({ ...billing, complement: e.target.value })}
                  />
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="mb-1 inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                Pagamento
              </div>
              <h2 className="text-lg font-semibold">Escolha como deseja pagar</h2>
              <RadioGroup
                value={method}
                onValueChange={(v) => setMethod(v as "pix" | "credit_card")}
                className="mt-4 space-y-3"
              >
                <label
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 ${method === "pix" ? "border-primary bg-primary/5" : ""}`}
                >
                  <RadioGroupItem value="pix" />
                  <div>
                    <div className="font-medium">PIX</div>
                    <div className="text-xs text-muted-foreground">Aprovação imediata</div>
                  </div>
                </label>
                <label
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 ${method === "credit_card" ? "border-primary bg-primary/5" : ""}`}
                >
                  <RadioGroupItem value="credit_card" />
                  <div>
                    <div className="font-medium">Cartão de crédito</div>
                    <div className="text-xs text-muted-foreground">Em até 12x</div>
                  </div>
                </label>
              </RadioGroup>
            </Card>

            <Card className="flex items-center justify-between p-4">
              <div className="text-sm text-muted-foreground">
                Revise os dados e conclua sua reserva com segurança.
              </div>
              <Button type="submit" disabled={busy || expired}>
                {expired ? "Reserva expirada" : busy ? "Processando..." : "Finalizar compra"}
              </Button>
            </Card>
          </div>

          <aside className="space-y-4">
            <Card className="overflow-hidden p-0">
              <div className="aspect-[16/9] bg-gradient-to-br from-primary/40 to-accent">
                {order.events?.cover_url && (
                  <img src={order.events.cover_url} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="p-4">
                <div className="text-sm font-medium">{order.events?.title}</div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium text-muted-foreground">Resumo do pedido</div>
                <div className="text-lg font-bold">{fmtBRL(order.total_cents)}</div>
              </div>
              <div className="mt-3 flex items-center justify-between border-t pt-3 text-sm">
                <div>
                  <div className="font-medium">{order.ticket_lots?.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {fmtBRL(order.ticket_lots?.price_cents ?? 0)} × {order.quantity}
                  </div>
                </div>
                <div className="rounded-md border px-2 py-0.5 text-xs">{order.quantity}</div>
              </div>
            </Card>
            <Card className={`flex items-center gap-3 p-4 ${expired ? "border-destructive" : ""}`}>
              <Clock className={`h-5 w-5 ${expired ? "text-destructive" : "text-primary"}`} />
              <div>
                <div className="text-lg font-bold tabular-nums">
                  {mm}:{ss}
                </div>
                <div className="text-xs text-muted-foreground">
                  {expired
                    ? "Reserva liberada. Reinicie a compra."
                    : "Após esse tempo, os itens são liberados."}
                </div>
              </div>
            </Card>
          </aside>
        </form>
      </div>
    </AppShell>
  );
}
