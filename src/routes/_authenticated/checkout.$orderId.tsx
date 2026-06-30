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
import { Clock, ShieldCheck, Copy, Upload, CheckCircle2 } from "lucide-react";
import { signedUrl, fileExt } from "@/lib/storage";
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
  const { data: profile } = useCurrentProfile();
  const requireCaravan = REGIONS_REQUIRING_CARAVAN.includes(profile?.region ?? "");
  const [participants, setParticipants] = useState<ParticipantData[]>([]);
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
  const [busy, setBusy] = useState(false);
  const [proofFile, setProofFile] = useState<File | null>(null);

  const { data: order, refetch: refetchOrder } = useQuery({
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

  const { data: settings } = useQuery({
    queryKey: ["app-settings-public"],
    queryFn: async () =>
      (await supabase.from("app_settings").select("*").eq("id", 1).maybeSingle()).data,
  });

  const [qrPreview, setQrPreview] = useState<string | null>(null);
  useEffect(() => {
    if (settings?.pix_qr_url)
      signedUrl("pix-assets", settings.pix_qr_url, 3600).then(setQrPreview);
  }, [settings]);

  useEffect(() => {
    if (!order) return;
    setParticipants((prev) =>
      prev.length === order.quantity
        ? prev
        : Array.from({ length: order.quantity }, (_, i) => prev[i] ?? emptyParticipant()),
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

  if (order.status === "paid") {
    return (
      <AppShell>
        <div className="mx-auto max-w-md p-10 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
          <h2 className="mt-3 text-xl font-semibold">Pedido pago</h2>
          <Button className="mt-4" onClick={() => navigate({ to: "/my-tickets" })}>
            Ver meus ingressos
          </Button>
        </div>
      </AppShell>
    );
  }

  if (order.status === "awaiting_review") {
    return (
      <AppShell>
        <div className="mx-auto max-w-md p-10 text-center">
          <Clock className="mx-auto h-12 w-12 text-amber-500" />
          <h2 className="mt-3 text-xl font-semibold">Comprovante em análise</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Recebemos seu comprovante. Assim que o admin confirmar o pagamento, o link de resgate
            será liberado em "Meus Ingressos".
          </p>
          <Button className="mt-4" onClick={() => navigate({ to: "/my-tickets" })}>
            Ir para meus ingressos
          </Button>
        </div>
      </AppShell>
    );
  }

  if (order.status !== "pending") {
    return (
      <AppShell>
        <div className="mx-auto max-w-md p-10 text-center">
          <h2 className="text-xl font-semibold">Pedido {order.status}</h2>
          <Button className="mt-4" onClick={() => navigate({ to: "/" })}>
            Voltar
          </Button>
        </div>
      </AppShell>
    );
  }

  const totalSecs = Math.max(0, remaining);
  const hh = String(Math.floor(totalSecs / 3600)).padStart(2, "0");
  const mm = String(Math.floor((totalSecs % 3600) / 60)).padStart(2, "0");
  const ss = String(totalSecs % 60).padStart(2, "0");
  const expired = remaining === 0;

  const copyPix = () => {
    if (!settings?.pix_key) return;
    navigator.clipboard.writeText(settings.pix_key);
    toast.success("Chave PIX copiada");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (participants.some((p) => !p.full_name || !p.email))
      return toast.error("Preencha todos os participantes");
    if (requireCaravan) {
      for (const p of participants) {
        const err = validateCaravan(p);
        if (err) return toast.error(`Dados de caravana incompletos: ${p.full_name || "—"}`);
      }
    }
    if (
      !billing.doc ||
      !billing.zip ||
      !billing.street ||
      !billing.number ||
      !billing.city ||
      !billing.state
    )
      return toast.error("Preencha os dados de cobrança");
    if (!proofFile) return toast.error("Envie o comprovante do PIX");

    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) throw new Error("Sessão expirada");

      await supabase.from("order_participants").delete().eq("order_id", orderId);
      const sanitized = participants.map((p) => {
        const row: any = { ...p, order_id: orderId };
        for (const k of Object.keys(row)) if (row[k] === "") row[k] = null;
        return row;
      });
      const { error: pErr } = await supabase.from("order_participants").insert(sanitized);
      if (pErr) throw pErr;

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
        })
        .eq("id", orderId);

      const path = `${uid}/${orderId}-${Date.now()}.${fileExt(proofFile.name)}`;
      const { error: upErr } = await supabase.storage
        .from("payment-proofs")
        .upload(path, proofFile, { contentType: proofFile.type, upsert: false });
      if (upErr) throw upErr;

      const { error: rpcErr } = await supabase.rpc("submit_payment_proof", {
        _order_id: orderId,
        _proof_url: path,
      });
      if (rpcErr) throw rpcErr;

      toast.success("Comprovante enviado! Aguarde a confirmação do admin.");
      await refetchOrder();
      navigate({ to: "/my-tickets" });
    } catch (err: any) {
      toast.error(err?.message || "Falha ao enviar comprovante");
    } finally {
      setBusy(false);
    }
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
            Pagamento por PIX
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
                {requireCaravan
                  ? `Sua EJ é da região ${profile?.region?.toUpperCase()}. Marque a caixa em cada participante interessado na caravana para liberar os campos adicionais.`
                  : "Preencha os dados como devem aparecer no ingresso."}
              </p>
              <div className="space-y-6">
                {participants.map((p, i) => (
                  <div key={i} className="rounded-lg border p-4">
                    <div className="mb-3 text-sm font-semibold">Participante #{i + 1}</div>
                    <ParticipantFields
                      value={p}
                      onChange={(next) =>
                        setParticipants((s) => s.map((x, j) => (j === i ? next : x)))
                      }
                      requireCaravan={requireCaravan}
                    />
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
                Pagamento via PIX
              </div>
              <h2 className="text-lg font-semibold">Pague {fmtBRL(order.total_cents)} via PIX</h2>
              {order.admin_notes && (
                <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
                  <strong>Aviso do admin:</strong> {order.admin_notes}
                </div>
              )}

              {!settings?.pix_key ? (
                <div className="mt-4 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm text-amber-800">
                  O administrador ainda não cadastrou os dados PIX. Aguarde a configuração para
                  realizar o pagamento.
                </div>
              ) : (
                <div className="mt-4 grid gap-4 sm:grid-cols-[200px_1fr]">
                  <div>
                    {qrPreview ? (
                      <img
                        src={qrPreview}
                        alt="QR Code PIX"
                        className="h-48 w-48 rounded-lg border bg-white object-contain p-2"
                      />
                    ) : (
                      <div className="flex h-48 w-48 items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">
                        QR Code não disponível
                      </div>
                    )}
                  </div>
                  <div className="space-y-3 text-sm">
                    <div>
                      <div className="text-xs uppercase tracking-wider text-muted-foreground">
                        Tipo de chave
                      </div>
                      <div className="font-medium">
                        {settings.pix_key_type?.toUpperCase() ?? "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wider text-muted-foreground">
                        Chave PIX
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 truncate rounded bg-muted px-2 py-1 text-xs">
                          {settings.pix_key}
                        </code>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={copyPix}
                        >
                          <Copy className="mr-1 h-3 w-3" /> Copiar
                        </Button>
                      </div>
                    </div>
                    {settings.pix_recipient_name && (
                      <div>
                        <div className="text-xs uppercase tracking-wider text-muted-foreground">
                          Recebedor
                        </div>
                        <div>{settings.pix_recipient_name}</div>
                      </div>
                    )}
                    {settings.pix_instructions && (
                      <div className="rounded-md border bg-muted/30 p-2 text-xs text-muted-foreground">
                        {settings.pix_instructions}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-6 space-y-2">
                <Label>Comprovante da transferência *</Label>
                <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-3 text-sm hover:bg-accent">
                  <Upload className="h-4 w-4" />
                  <span className="flex-1 truncate">
                    {proofFile ? proofFile.name : "Selecionar imagem ou PDF do comprovante"}
                  </span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                  />
                </label>
                <p className="text-xs text-muted-foreground">
                  Após o envio, o admin confere o valor e libera o link de resgate em "Meus
                  Ingressos".
                </p>
              </div>
            </Card>

            <Card className="flex items-center justify-between p-4">
              <div className="text-sm text-muted-foreground">
                Revise os dados, envie o comprovante e aguarde a aprovação.
              </div>
              <Button type="submit" disabled={busy || expired || !settings?.pix_key}>
                {expired
                  ? "Reserva expirada"
                  : busy
                    ? "Enviando..."
                    : "Enviar comprovante"}
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
                  {hh}:{mm}:{ss}
                </div>
                <div className="text-xs text-muted-foreground">
                  {expired
                    ? "Reserva liberada. Reinicie a compra."
                    : "Tempo restante para enviar o comprovante."}
                </div>
              </div>
            </Card>
          </aside>
        </form>
      </div>
    </AppShell>
  );
}
