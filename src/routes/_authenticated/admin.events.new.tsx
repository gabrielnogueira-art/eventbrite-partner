import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell, useIsAdmin } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/events/new")({
  component: NewEventPage,
});

function NewEventPage() {
  const navigate = useNavigate();
  const { data: isAdmin } = useIsAdmin();
  useEffect(() => { if (isAdmin === false) navigate({ to: "/" }); }, [isAdmin, navigate]);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    const file = fd.get("cover") as File | null;
    let cover_url: string | null = null;
    if (file && file.size > 0) {
      const ext = file.name.split(".").pop();
      const path = `${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from("event-covers").upload(path, file);
      if (up.error) { setBusy(false); return toast.error(up.error.message); }
      const { data } = await supabase.storage.from("event-covers").createSignedUrl(path, 60 * 60 * 24 * 365);
      cover_url = data?.signedUrl ?? null;
    }
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from("events").insert({
      title: String(fd.get("title")),
      organizer: String(fd.get("organizer")),
      description: String(fd.get("description") ?? ""),
      location_name: String(fd.get("location_name") ?? ""),
      address: String(fd.get("address") ?? ""),
      starts_at: new Date(String(fd.get("starts_at"))).toISOString(),
      ends_at: new Date(String(fd.get("ends_at"))).toISOString(),
      cancellation_policy: String(fd.get("cancellation_policy") ?? ""),
      max_tickets_per_user: Number(fd.get("max_tickets_per_user") || 5),
      cover_url,
      created_by: user?.id,
    }).select("id").maybeSingle();
    setBusy(false);
    if (error || !data) return toast.error(error?.message ?? "Erro ao criar");
    toast.success("Evento criado!");
    navigate({ to: "/admin/events/$id", params: { id: data.id } });
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl p-6 lg:p-10">
        <h1 className="mb-6 text-2xl font-bold tracking-tight">Novo evento</h1>
        <Card className="p-6">
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2"><Label>Título *</Label><Input name="title" required /></div>
            <div className="space-y-1"><Label>Organizador *</Label><Input name="organizer" required /></div>
            <div className="space-y-1"><Label>Máx. ingressos por usuário</Label><Input type="number" name="max_tickets_per_user" defaultValue={5} min={1} max={20} /></div>
            <div className="space-y-1 sm:col-span-2"><Label>Descrição</Label><Textarea name="description" rows={4} /></div>
            <div className="space-y-1"><Label>Início *</Label><Input type="datetime-local" name="starts_at" required /></div>
            <div className="space-y-1"><Label>Término *</Label><Input type="datetime-local" name="ends_at" required /></div>
            <div className="space-y-1"><Label>Local</Label><Input name="location_name" /></div>
            <div className="space-y-1"><Label>Endereço</Label><Input name="address" /></div>
            <div className="space-y-1 sm:col-span-2"><Label>Política de cancelamento</Label><Textarea name="cancellation_policy" rows={3} /></div>
            <div className="space-y-1 sm:col-span-2"><Label>Capa</Label><Input type="file" name="cover" accept="image/*" /></div>
            <div className="sm:col-span-2 flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => navigate({ to: "/admin" })}>Cancelar</Button><Button type="submit" disabled={busy}>{busy ? "Criando..." : "Criar evento"}</Button></div>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
