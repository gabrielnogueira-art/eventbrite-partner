import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, useIsAdmin } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fmtBRL, fmtDateTime } from "@/lib/format";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2, Plus, Pencil, X, Check, Download, AlertTriangle } from "lucide-react";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/_authenticated/admin/events/$id")({
  component: AdminEventPage,
});

const toLocalInput = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function AdminEventPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: isAdmin } = useIsAdmin();
  useEffect(() => {
    if (isAdmin === false) navigate({ to: "/" });
  }, [isAdmin, navigate]);

  const { data: event } = useQuery({
    queryKey: ["admin-event", id],
    queryFn: async () =>
      (await supabase.from("events").select("*").eq("id", id).maybeSingle()).data,
  });
  const { data: lots = [] } = useQuery({
    queryKey: ["admin-lots", id],
    queryFn: async () =>
      (await supabase.from("ticket_lots").select("*").eq("event_id", id).order("sort_order"))
        .data ?? [],
  });
  const { data: orders = [] } = useQuery({
    queryKey: ["admin-orders", id],
    queryFn: async () =>
      (
        await supabase
          .from("orders")
          .select("*, order_participants(*), ticket_lots(name)")
          .eq("event_id", id)
          .order("created_at", { ascending: false })
      ).data ?? [],
  });

  // Lookup EJ names for participants
  const ownerIds = Array.from(
    new Set(
      orders.flatMap((o: any) =>
        (o.order_participants ?? []).map((p: any) => p.ej_owner_id).filter(Boolean),
      ),
    ),
  );
  const { data: ejProfiles = [] } = useQuery({
    queryKey: ["ej-profiles", ownerIds.sort().join(",")],
    queryFn: async () => {
      if (ownerIds.length === 0) return [];
      const { data } = await supabase
        .from("profiles")
        .select("id, ej_name, email")
        .in("id", ownerIds);
      return data ?? [];
    },
    enabled: ownerIds.length > 0,
  });
  const ejMap = new Map(ejProfiles.map((p: any) => [p.id, p]));

  const [newLot, setNewLot] = useState({ name: "", price: "", total: "", opens: "", closes: "" });
  const [editingLot, setEditingLot] = useState<any>(null);
  const [transferDeadline, setTransferDeadline] = useState("");
  useEffect(() => {
    if (event) setTransferDeadline(toLocalInput(event.transfer_deadline));
  }, [event]);

  const saveTransferDeadline = async () => {
    const value = transferDeadline ? new Date(transferDeadline).toISOString() : null;
    const { error } = await supabase
      .from("events")
      .update({ transfer_deadline: value })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Prazo de transferência salvo");
    qc.invalidateQueries({ queryKey: ["admin-event", id] });
  };

  const addLot = async () => {
    if (!newLot.name || !newLot.price || !newLot.total || !newLot.opens || !newLot.closes)
      return toast.error("Preencha todos os campos do lote");
    if (new Date(newLot.closes) <= new Date(newLot.opens))
      return toast.error("A data de fechamento deve ser posterior à abertura.");
    const { error } = await supabase.from("ticket_lots").insert({
      event_id: id,
      name: newLot.name,
      price_cents: Math.round(parseFloat(newLot.price) * 100),
      total_quantity: parseInt(newLot.total),
      opens_at: new Date(newLot.opens).toISOString(),
      closes_at: new Date(newLot.closes).toISOString(),
      sort_order: lots.length + 1,
    });
    if (error) return toast.error(error.message);
    toast.success("Lote criado");
    setNewLot({ name: "", price: "", total: "", opens: "", closes: "" });
    qc.invalidateQueries({ queryKey: ["admin-lots", id] });
  };

  const updateLot = async () => {
    if (
      !editingLot.name ||
      !editingLot.price ||
      !editingLot.total ||
      !editingLot.opens ||
      !editingLot.closes
    )
      return toast.error("Preencha todos os campos");
    if (new Date(editingLot.closes) <= new Date(editingLot.opens))
      return toast.error("O fechamento deve ser posterior à abertura.");
    const currentLot = lots.find((l: any) => l.id === editingLot.id);
    if (currentLot && parseInt(editingLot.total) < currentLot.sold_quantity)
      return toast.error(
        `A quantidade não pode ser menor que as vendas (${currentLot.sold_quantity}).`,
      );

    const { error } = await supabase
      .from("ticket_lots")
      .update({
        name: editingLot.name,
        price_cents: Math.round(parseFloat(editingLot.price) * 100),
        total_quantity: parseInt(editingLot.total),
        opens_at: new Date(editingLot.opens).toISOString(),
        closes_at: new Date(editingLot.closes).toISOString(),
      })
      .eq("id", editingLot.id);

    if (error) return toast.error(error.message);
    toast.success("Lote atualizado");
    setEditingLot(null);
    qc.invalidateQueries({ queryKey: ["admin-lots", id] });
  };

  const removeLot = async (lot: any) => {
    if (lot.sold_quantity > 0)
      return toast.error(
        "Não é possível remover um lote que já possui vendas. Edite-o e mude sua data de fechamento.",
      );
    if (!confirm("Remover este lote?")) return;
    const { error } = await supabase.from("ticket_lots").delete().eq("id", lot.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-lots", id] });
  };

  const paidParticipants = orders
    .filter((o: any) => o.status === "paid")
    .flatMap((o: any) =>
      (o.order_participants ?? []).map((p: any) => ({ ...p, _order: o })),
    );

  const deleteEvent = async () => {
    const paidCount = orders.filter((o: any) => o.status === "paid").length;
    const isPast = event && new Date(event.starts_at) < new Date();
    if (paidCount > 0 && !isPast) {
      const msg = `⚠️ ATENÇÃO: este evento ainda não aconteceu e tem ${paidCount} pedido(s) pago(s) (${paidParticipants.length} participante(s)). Excluir cancela todos os ingressos vendidos sem aviso aos compradores.\n\nPara confirmar, digite EXCLUIR no próximo prompt.`;
      if (!confirm(msg)) return;
      const typed = prompt('Digite "EXCLUIR" em maiúsculas para confirmar:');
      if (typed !== "EXCLUIR") return toast.info("Exclusão cancelada");
    } else if (!confirm("Excluir este evento e todos os ingressos/pedidos?")) {
      return;
    }
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Evento excluído");
    navigate({ to: "/admin" });
  };

  const exportXLSX = () => {
    if (paidParticipants.length === 0) return toast.info("Nenhum participante pago para exportar");
    const rows = paidParticipants.map((p: any, idx: number) => {
      const owner: any = ejMap.get(p.ej_owner_id) ?? {};
      return {
        "Nº": idx + 1,
        Lote: p._order.ticket_lots?.name ?? "",
        "EJ Titular": owner.ej_name ?? "—",
        "Email EJ": owner.email ?? "",
        "Nome Completo": p.full_name,
        Email: p.email,
        CPF: p.cpf ?? "",
        RG: p.rg ?? "",
        "Órgão Emissor": p.rg_issuer ?? "",
        "Data Nascimento": p.birth_date ?? "",
        Telefone: p.phone ?? "",
        CEP: p.address_zip ?? "",
        Rua: p.address_street ?? "",
        Número: p.address_number ?? "",
        Bairro: p.address_district ?? "",
        "Contato Emergência": p.emergency_contact_name ?? "",
        "Telefone Emergência": p.emergency_contact_phone ?? "",
        Matrícula: p.university_id ?? "",
        Curso: p.course_name ?? "",
        "Transferido em": p.transferred_at ? fmtDateTime(p.transferred_at) : "",
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Participantes");
    const safe = (event?.title ?? "evento").replace(/[^a-z0-9-_]+/gi, "_");
    XLSX.writeFile(wb, `participantes_${safe}.xlsx`);
  };

  if (!event)
    return (
      <AppShell>
        <div className="p-10 text-sm text-muted-foreground">Carregando...</div>
      </AppShell>
    );

  const paidCount = orders.filter((o: any) => o.status === "paid").length;
  const revenue = orders
    .filter((o: any) => o.status === "paid")
    .reduce((a: number, o: any) => a + o.total_cents, 0);
  const isUpcoming = new Date(event.starts_at) > new Date();
  const dangerDelete = isUpcoming && paidCount > 0;

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl p-6 lg:p-10 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-primary">
              {event.organizer}
            </div>
            <h1 className="text-2xl font-bold tracking-tight">{event.title}</h1>
            <div className="mt-1 text-sm text-muted-foreground">
              {fmtDateTime(event.starts_at)} · {event.location_name}
            </div>
          </div>
          <Button variant="destructive" onClick={deleteEvent}>
            <Trash2 className="mr-2 h-4 w-4" />
            Excluir evento
          </Button>
        </div>

        {dangerDelete && (
          <Card className="flex items-start gap-3 border-amber-500/40 bg-amber-500/5 p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <div className="font-semibold text-amber-900 dark:text-amber-200">
                Evento futuro com vendas confirmadas
              </div>
              <div className="text-amber-900/80 dark:text-amber-200/80">
                Este evento tem {paidCount} pedido(s) pago(s) e ainda não aconteceu. A exclusão é
                permitida apenas com confirmação dupla.
              </div>
            </div>
          </Card>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Pedidos pagos</div>
            <div className="text-2xl font-bold">{paidCount}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Receita</div>
            <div className="text-2xl font-bold">{fmtBRL(revenue)}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Máx por usuário</div>
            <div className="text-2xl font-bold">{event.max_tickets_per_user}</div>
          </Card>
        </div>

        <Card className="p-6">
          <h2 className="mb-2 text-lg font-semibold">Prazo de transferência de ingressos</h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Data limite para que uma EJ possa transferir um ingresso para outra EJ. Se vazio, o
            limite passa a ser o início do evento.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Limite</Label>
              <Input
                type="datetime-local"
                value={transferDeadline}
                onChange={(e) => setTransferDeadline(e.target.value)}
              />
            </div>
            <Button onClick={saveTransferDeadline}>Salvar prazo</Button>
            {transferDeadline && (
              <Button variant="ghost" onClick={() => setTransferDeadline("")}>
                Limpar
              </Button>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold">Lotes</h2>
          <div className="space-y-2">
            {lots.map((l: any) =>
              editingLot?.id === l.id ? (
                <div key={l.id} className="grid gap-3 rounded-lg border p-4 bg-muted/30">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <div className="space-y-1">
                      <Label className="text-xs">Nome</Label>
                      <Input
                        value={editingLot.name}
                        onChange={(e) => setEditingLot({ ...editingLot, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Preço (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={editingLot.price}
                        onChange={(e) => setEditingLot({ ...editingLot, price: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Qtd. Total</Label>
                      <Input
                        type="number"
                        value={editingLot.total}
                        onChange={(e) => setEditingLot({ ...editingLot, total: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Abre em</Label>
                      <Input
                        type="datetime-local"
                        value={editingLot.opens}
                        onChange={(e) => setEditingLot({ ...editingLot, opens: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Fecha em</Label>
                      <Input
                        type="datetime-local"
                        value={editingLot.closes}
                        onChange={(e) => setEditingLot({ ...editingLot, closes: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-2">
                    <Button size="sm" variant="ghost" onClick={() => setEditingLot(null)}>
                      <X className="mr-2 h-4 w-4" />
                      Cancelar
                    </Button>
                    <Button size="sm" onClick={updateLot}>
                      <Check className="mr-2 h-4 w-4" />
                      Salvar
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  key={l.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm hover:border-primary/50 transition-colors"
                >
                  <div className="font-medium min-w-[120px]">{l.name}</div>
                  <div className="text-muted-foreground">
                    {fmtBRL(l.price_cents)} · {l.sold_quantity}/{l.total_quantity} vendidos
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {fmtDateTime(l.opens_at)} → {fmtDateTime(l.closes_at)}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setEditingLot({
                          id: l.id,
                          name: l.name,
                          price: (l.price_cents / 100).toFixed(2),
                          total: l.total_quantity.toString(),
                          opens: toLocalInput(l.opens_at),
                          closes: toLocalInput(l.closes_at),
                        })
                      }
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => removeLot(l)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ),
            )}
            {lots.length === 0 && (
              <div className="text-sm text-muted-foreground">Nenhum lote ainda.</div>
            )}
          </div>
          <div className="mt-6 rounded-lg border border-dashed p-4">
            <div className="mb-3 text-sm font-medium">Adicionar novo lote</div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="space-y-1">
                <Label className="text-xs">Nome</Label>
                <Input
                  value={newLot.name}
                  onChange={(e) => setNewLot({ ...newLot, name: e.target.value })}
                  placeholder="Lote 1"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Preço (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newLot.price}
                  onChange={(e) => setNewLot({ ...newLot, price: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Quantidade</Label>
                <Input
                  type="number"
                  value={newLot.total}
                  onChange={(e) => setNewLot({ ...newLot, total: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Abre em</Label>
                <Input
                  type="datetime-local"
                  value={newLot.opens}
                  onChange={(e) => setNewLot({ ...newLot, opens: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fecha em</Label>
                <Input
                  type="datetime-local"
                  value={newLot.closes}
                  onChange={(e) => setNewLot({ ...newLot, closes: e.target.value })}
                />
              </div>
            </div>
            <Button className="mt-3" onClick={addLot}>
              <Plus className="mr-2 h-4 w-4" />
              Adicionar lote
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">
              Participantes pagos ({paidParticipants.length})
            </h2>
            <Button onClick={exportXLSX} disabled={paidParticipants.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Exportar XLSX
            </Button>
          </div>
          <div className="space-y-2">
            {paidParticipants.map((p: any, i: number) => {
              const owner: any = ejMap.get(p.ej_owner_id) ?? {};
              return (
                <div key={p.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-medium">
                        {i + 1}. {p.full_name}
                      </div>
                      <div className="text-xs text-muted-foreground">{p.email}</div>
                    </div>
                    <div className="text-xs">
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                        {owner.ej_name ?? "—"}
                      </span>
                      {p.transferred_at && (
                        <span className="ml-2 rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-700">
                          Transferido
                        </span>
                      )}
                    </div>
                  </div>
                  {(p.cpf || p.phone || p.course_name) && (
                    <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 border-t pt-2 text-xs text-muted-foreground sm:grid-cols-3">
                      {p.cpf && <div>CPF: {p.cpf}</div>}
                      {p.rg && <div>RG: {p.rg}</div>}
                      {p.birth_date && <div>Nasc.: {p.birth_date}</div>}
                      {p.phone && <div>Tel.: {p.phone}</div>}
                      {p.course_name && <div>Curso: {p.course_name}</div>}
                      {p.university_id && <div>Matrícula: {p.university_id}</div>}
                      {p.emergency_contact_name && (
                        <div className="sm:col-span-3">
                          Emergência: {p.emergency_contact_name} ({p.emergency_contact_phone})
                        </div>
                      )}
                      {p.address_street && (
                        <div className="sm:col-span-3">
                          End.: {p.address_street}, {p.address_number} — {p.address_district},{" "}
                          {p.address_zip}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {paidParticipants.length === 0 && (
              <div className="text-sm text-muted-foreground">Nenhum participante pago ainda.</div>
            )}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
