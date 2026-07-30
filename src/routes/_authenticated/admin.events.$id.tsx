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
import { Trash2, Plus, Pencil, X, Check, Download, AlertTriangle, Image as ImageIcon, Plane, Info, GripVertical, Users, ListChecks } from "lucide-react";
import { FormBuilder } from "@/components/FormBuilder";
import { parseSchema, answerToText, isQuestion, type FormItem } from "@/lib/form-schema";

import * as XLSX from "xlsx";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { REGIONS } from "@/lib/regions";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";

function SortableLotRow({
  id,
  children,
}: {
  id: string;
  children: (args: {
    listeners: SyntheticListenerMap | undefined;
    setActivatorNodeRef: (node: HTMLElement | null) => void;
  }) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      {children({ listeners, setActivatorNodeRef })}
    </div>
  );
}


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

  const [newLot, setNewLot] = useState({ name: "", price: "", total: "", opens: "", closes: "", assigned_ej_slug: "__all__" });
  const [editingLot, setEditingLot] = useState<any>(null);
  const [transferDeadline, setTransferDeadline] = useState("");
  const [caravanRegions, setCaravanRegions] = useState<string[]>([]);
  const [coverBusy, setCoverBusy] = useState(false);
  const [eventKind, setEventKind] = useState<"portal_bj" | "independent">("portal_bj");
  const [info, setInfo] = useState({
    title: "",
    organizer: "",
    description: "",
    location_name: "",
    address: "",
    starts_at: "",
    ends_at: "",
    cancellation_policy: "",
    max_tickets_per_user: 5,
  });
  const [infoBusy, setInfoBusy] = useState(false);
  const [kindBusy, setKindBusy] = useState(false);

  const { data: directory = [] } = useQuery({
    queryKey: ["ej-directory-admin"],
    queryFn: async () =>
      (await supabase.from("ej_directory").select("slug, name, region").order("name")).data ?? [],
  });

  useEffect(() => {
    if (event) {
      setTransferDeadline(toLocalInput(event.transfer_deadline));
      setCaravanRegions(((event as any).caravan_regions ?? []) as string[]);
      setEventKind(((event as any).event_kind ?? "portal_bj") as "portal_bj" | "independent");
      setInfo({
        title: event.title ?? "",
        organizer: event.organizer ?? "",
        description: event.description ?? "",
        location_name: event.location_name ?? "",
        address: event.address ?? "",
        starts_at: toLocalInput(event.starts_at),
        ends_at: toLocalInput(event.ends_at),
        cancellation_policy: event.cancellation_policy ?? "",
        max_tickets_per_user: event.max_tickets_per_user ?? 5,
      });
    }
  }, [event]);

  const saveInfo = async () => {
    if (!info.title || !info.organizer || !info.starts_at || !info.ends_at)
      return toast.error("Preencha os campos obrigatórios do evento");
    if (new Date(info.ends_at) <= new Date(info.starts_at))
      return toast.error("O término deve ser posterior ao início.");
    setInfoBusy(true);
    const { error } = await supabase
      .from("events")
      .update({
        title: info.title,
        organizer: info.organizer,
        description: info.description || null,
        location_name: info.location_name || null,
        address: info.address || null,
        starts_at: new Date(info.starts_at).toISOString(),
        ends_at: new Date(info.ends_at).toISOString(),
        cancellation_policy: info.cancellation_policy || null,
        max_tickets_per_user: Number(info.max_tickets_per_user) || 5,
      })
      .eq("id", id);
    setInfoBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Informações do evento atualizadas");
    qc.invalidateQueries({ queryKey: ["admin-event", id] });
  };

  const saveEventKind = async () => {
    setKindBusy(true);
    const { error } = await supabase.from("events").update({ event_kind: eventKind }).eq("id", id);
    setKindBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Tipo do evento atualizado");
    qc.invalidateQueries({ queryKey: ["admin-event", id] });
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const handleDragEnd = async (evt: DragEndEvent) => {
    const { active, over } = evt;
    if (!over || active.id === over.id) return;
    const list = [...lots] as any[];
    const oldIdx = list.findIndex((l) => l.id === active.id);
    const newIdx = list.findIndex((l) => l.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const reordered = arrayMove(list, oldIdx, newIdx);
    // Persist sequential sort_order 1..n
    const updates = reordered.map((l, i) =>
      supabase.from("ticket_lots").update({ sort_order: i + 1 }).eq("id", l.id),
    );
    const results = await Promise.all(updates);
    const err = results.find((r) => r.error);
    if (err?.error) return toast.error(err.error.message);
    qc.invalidateQueries({ queryKey: ["admin-lots", id] });
  };

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

  const saveCaravanRegions = async () => {
    const { error } = await supabase
      .from("events")
      .update({ caravan_regions: caravanRegions })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Regiões da caravana atualizadas");
    qc.invalidateQueries({ queryKey: ["admin-event", id] });
  };

  const changeCover = async (file: File) => {
    setCoverBusy(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from("event-covers").upload(path, file);
      if (up.error) throw up.error;
      const { data } = await supabase.storage
        .from("event-covers")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      const cover_url = data?.signedUrl ?? null;
      const { error } = await supabase.from("events").update({ cover_url }).eq("id", id);
      if (error) throw error;
      toast.success("Capa atualizada");
      qc.invalidateQueries({ queryKey: ["admin-event", id] });
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao atualizar capa");
    } finally {
      setCoverBusy(false);
    }
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
      assigned_ej_slug: newLot.assigned_ej_slug && newLot.assigned_ej_slug !== "__all__" ? newLot.assigned_ej_slug : null,
    });
    if (error) return toast.error(error.message);
    toast.success("Lote criado");
    setNewLot({ name: "", price: "", total: "", opens: "", closes: "", assigned_ej_slug: "__all__" });
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
        assigned_ej_slug: editingLot.assigned_ej_slug && editingLot.assigned_ej_slug !== "__all__" ? editingLot.assigned_ej_slug : null,
      })
      .eq("id", editingLot.id);

    if (error) return toast.error(error.message);
    toast.success("Lote atualizado");
    setEditingLot(null);
    qc.invalidateQueries({ queryKey: ["admin-lots", id] });
  };

  const removeLot = async (lot: any) => {
    const hasSales = lot.sold_quantity > 0 || lot.reserved_quantity > 0;
    if (hasSales) {
      const ok = confirm(
        `⚠️ O lote "${lot.name}" possui ${lot.sold_quantity} ingresso(s) vendido(s) e ${lot.reserved_quantity} reservado(s).\n\n` +
          "Ao excluir, os pedidos serão cancelados e os compradores receberão um aviso de que o lote foi cancelado e que serão contatados em breve.\n\nDeseja continuar?",
      );
      if (!ok) return;
      const typed = prompt('Digite "EXCLUIR" em maiúsculas para confirmar:');
      if (typed !== "EXCLUIR") return toast.info("Exclusão cancelada");
      const custom = prompt(
        "Mensagem enviada aos compradores (deixe em branco para usar o aviso padrão):",
        "",
      );
      const { error } = await supabase.rpc("delete_lot_by_admin", {
        _lot_id: lot.id,
        _message: custom && custom.trim() ? custom.trim() : undefined,
      });
      if (error) return toast.error(error.message);
      toast.success("Lote excluído e compradores notificados");
    } else {
      if (!confirm("Remover este lote?")) return;
      const { error } = await supabase.from("ticket_lots").delete().eq("id", lot.id);
      if (error) return toast.error(error.message);
      toast.success("Lote removido");
    }
    qc.invalidateQueries({ queryKey: ["admin-lots", id] });
    qc.invalidateQueries({ queryKey: ["admin-orders", id] });
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
          <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold">
            <ImageIcon className="h-5 w-5" /> Capa do evento
          </h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Você pode trocar a imagem de capa a qualquer momento.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            {event.cover_url ? (
              <img
                src={event.cover_url}
                alt="Capa atual"
                className="h-24 w-40 rounded-md border object-cover"
              />
            ) : (
              <div className="flex h-24 w-40 items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">
                Sem capa
              </div>
            )}
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm hover:bg-accent">
              <ImageIcon className="h-4 w-4" />
              {coverBusy ? "Enviando..." : "Selecionar nova imagem"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={coverBusy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) changeCover(f);
                  e.currentTarget.value = "";
                }}
              />
            </label>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold">
            <Plane className="h-5 w-5" /> Regiões com caravana
          </h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Selecione as regiões cujas EJs verão a opção de caravana no checkout deste evento.
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            {REGIONS.map((r) => (
              <label key={r} className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm">
                <Checkbox
                  checked={caravanRegions.includes(r)}
                  onCheckedChange={(c) =>
                    setCaravanRegions((prev) =>
                      c === true ? [...prev, r] : prev.filter((x) => x !== r),
                    )
                  }
                />
                <span>{r}</span>
              </label>
            ))}
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={saveCaravanRegions}>Salvar regiões</Button>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold">
            <Info className="h-5 w-5" /> Informações do evento
          </h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Edite qualquer informação do evento a qualquer momento.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Título *</Label>
              <Input value={info.title} onChange={(e) => setInfo({ ...info, title: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Organizador *</Label>
              <Input value={info.organizer} onChange={(e) => setInfo({ ...info, organizer: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Máx. ingressos por usuário</Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={info.max_tickets_per_user}
                onChange={(e) => setInfo({ ...info, max_tickets_per_user: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Descrição</Label>
              <Textarea rows={4} value={info.description} onChange={(e) => setInfo({ ...info, description: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Início *</Label>
              <Input type="datetime-local" value={info.starts_at} onChange={(e) => setInfo({ ...info, starts_at: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Término *</Label>
              <Input type="datetime-local" value={info.ends_at} onChange={(e) => setInfo({ ...info, ends_at: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Nome do local</Label>
              <Input value={info.location_name} onChange={(e) => setInfo({ ...info, location_name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Endereço</Label>
              <Input value={info.address} onChange={(e) => setInfo({ ...info, address: e.target.value })} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Política de cancelamento</Label>
              <Textarea rows={3} value={info.cancellation_policy} onChange={(e) => setInfo({ ...info, cancellation_policy: e.target.value })} />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={saveInfo} disabled={infoBusy}>{infoBusy ? "Salvando..." : "Salvar alterações"}</Button>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold">
            <Info className="h-5 w-5" /> Tipo do evento
          </h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Evento paralelo ao Portal BJ exige link de resgate para liberar os ingressos. Evento
            independente apenas confirma a presença da EJ.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className={`flex cursor-pointer flex-col rounded-md border p-3 text-sm ${eventKind === "portal_bj" ? "border-primary bg-primary/5" : ""}`}>
              <div className="flex items-center gap-2">
                <input type="radio" checked={eventKind === "portal_bj"} onChange={() => setEventKind("portal_bj")} />
                <span className="font-medium">Paralelo ao Portal BJ</span>
              </div>
              <span className="ml-6 text-xs text-muted-foreground">Admin libera link de resgate após aprovar o pagamento.</span>
            </label>
            <label className={`flex cursor-pointer flex-col rounded-md border p-3 text-sm ${eventKind === "independent" ? "border-primary bg-primary/5" : ""}`}>
              <div className="flex items-center gap-2">
                <input type="radio" checked={eventKind === "independent"} onChange={() => setEventKind("independent")} />
                <span className="font-medium">Evento independente</span>
              </div>
              <span className="ml-6 text-xs text-muted-foreground">Sem link de resgate — presença confirmada automaticamente.</span>
            </label>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={saveEventKind} disabled={kindBusy}>{kindBusy ? "Salvando..." : "Salvar tipo"}</Button>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold">
            <ListChecks className="h-5 w-5" /> Formulário do evento
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Monte o formulário que cada participante responderá no checkout, como em um Google
            Forms: perguntas (resposta curta, parágrafo, múltipla escolha, caixas de seleção, lista
            suspensa, escala linear, data e horário) e blocos de título, imagem, vídeo e seção.
            Os campos básicos (nome, e-mail, telefone e caravana) continuam sempre presentes.
          </p>
          <FormBuilder items={formItems} onChange={setFormItems} />
          <div className="mt-4 flex justify-end">
            <Button onClick={saveForm} disabled={formBusy}>
              {formBusy ? "Salvando..." : "Salvar formulário"}
            </Button>
          </div>
        </Card>



        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold">Lotes</h2>
          <div className="space-y-2">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={(lots as any[]).map((l) => l.id)} strategy={verticalListSortingStrategy}>
                {lots.map((l: any) => (
                  <SortableLotRow key={l.id} id={l.id}>
                    {({ listeners, setActivatorNodeRef }) =>
                      editingLot?.id === l.id ? (
                        <div className="grid gap-3 rounded-lg border p-4 bg-muted/30">
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
                            <div className="space-y-1 sm:col-span-2 lg:col-span-5">
                              <Label className="text-xs flex items-center gap-1"><Users className="h-3 w-3" /> EJ vinculada (opcional)</Label>
                              <Select
                                value={editingLot.assigned_ej_slug ?? "__all__"}
                                onValueChange={(v) => setEditingLot({ ...editingLot, assigned_ej_slug: v })}
                              >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__all__">Todas as EJs</SelectItem>
                                  {(directory as any[]).map((d) => (
                                    <SelectItem key={d.slug} value={d.slug}>{d.name} · {d.region}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <p className="text-[11px] text-muted-foreground">Se selecionada, apenas essa EJ verá este lote no checkout.</p>
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
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm hover:border-primary/50 transition-colors">
                          <button
                            ref={setActivatorNodeRef}
                            {...listeners}
                            type="button"
                            className="flex h-8 w-8 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-accent active:cursor-grabbing"
                            title="Arraste para reordenar"
                          >
                            <GripVertical className="h-4 w-4" />
                          </button>
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="font-medium min-w-[120px]">{l.name}</div>
                            {l.assigned_ej_slug && (
                              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                                EJ: {(directory as any[]).find((d) => d.slug === l.assigned_ej_slug)?.name ?? l.assigned_ej_slug}
                              </span>
                            )}
                          </div>
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
                                  assigned_ej_slug: l.assigned_ej_slug ?? "__all__",
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
                      )
                    }
                  </SortableLotRow>
                ))}
              </SortableContext>
            </DndContext>
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
              <div className="space-y-1 sm:col-span-2 lg:col-span-5">
                <Label className="text-xs flex items-center gap-1"><Users className="h-3 w-3" /> EJ vinculada (opcional)</Label>
                <Select
                  value={newLot.assigned_ej_slug}
                  onValueChange={(v) => setNewLot({ ...newLot, assigned_ej_slug: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todas as EJs</SelectItem>
                    {(directory as any[]).map((d) => (
                      <SelectItem key={d.slug} value={d.slug}>{d.name} · {d.region}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">Deixe em "Todas as EJs" para pacotes gerais. Selecione uma EJ para criar um pacote exclusivo, visível apenas para ela.</p>
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
