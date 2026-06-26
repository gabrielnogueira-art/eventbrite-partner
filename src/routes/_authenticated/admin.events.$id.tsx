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
import { Trash2, Plus, Pencil, X, Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/events/$id")({
  component: AdminEventPage,
});

const toLocalInput = (iso: string) => {
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
          .select("*, order_participants(full_name, email)")
          .eq("event_id", id)
          .order("created_at", { ascending: false })
      ).data ?? [],
  });

  const [newLot, setNewLot] = useState({ name: "", price: "", total: "", opens: "", closes: "" });
  const [editingLot, setEditingLot] = useState<any>(null);

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

  const deleteEvent = async () => {
    if (!confirm("Excluir este evento e todos os ingressos/pedidos?")) return;
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Evento excluído");
    navigate({ to: "/admin" });
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
          <div className="mt-4 text-xs text-muted-foreground">
            Início padrão de evento de exemplo: {toLocalInput(event.starts_at)}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold">Pedidos ({orders.length})</h2>
          <div className="space-y-2">
            {orders.map((o: any) => (
              <div
                key={o.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
              >
                <div>
                  <div className="font-medium">{o.order_participants?.[0]?.full_name ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">
                    {o.order_participants?.[0]?.email}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {o.quantity}× · {fmtBRL(o.total_cents)}
                </div>
                <span className="rounded-full bg-accent px-2 py-0.5 text-xs">{o.status}</span>
              </div>
            ))}
            {orders.length === 0 && (
              <div className="text-sm text-muted-foreground">Nenhum pedido ainda.</div>
            )}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
