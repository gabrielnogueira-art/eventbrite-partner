import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell, useIsAdmin } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Users, Search, Pencil, Trash2 } from "lucide-react";

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
  const [editing, setEditing] = useState<any | null>(null);
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editQ, setEditQ] = useState("");

  const { data: profiles = [] } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () =>
      (
        await supabase
          .from("profiles")
          .select("id, email, full_name, ej_name, ej_slug, region")
          .order("ej_name")
      ).data ?? [],
  });

  const { data: directory = [] } = useQuery({
    queryKey: ["ej-directory"],
    queryFn: async () =>
      (await supabase.from("ej_directory").select("*").order("name")).data ?? [],
  });

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return profiles;
    return profiles.filter((p: any) =>
      [p.ej_name, p.email, p.region, p.full_name]
        .filter(Boolean)
        .some((s: string) => s.toLowerCase().includes(t)),
    );
  }, [profiles, q]);

  const filteredEjs = useMemo(() => {
    const t = editQ.trim().toLowerCase();
    if (!t) return directory;
    return directory.filter(
      (e: any) => e.name.toLowerCase().includes(t) || e.region.toLowerCase().includes(t),
    );
  }, [editQ, directory]);

  const openEdit = (p: any) => {
    setEditing(p);
    setEditName(p.full_name ?? "");
    setEditSlug(p.ej_slug ?? "");
    setEditQ("");
  };

  const saveEdit = async () => {
    if (!editing) return;
    const ej = directory.find((e: any) => e.slug === editSlug);
    const payload: any = { full_name: editName.trim() || null };
    if (ej) {
      payload.ej_slug = (ej as any).slug;
      payload.ej_name = (ej as any).name;
      payload.region = (ej as any).region;
    }
    const { error } = await supabase.from("profiles").update(payload).eq("id", editing.id);
    if (error) return toast.error(error.message);
    toast.success("Usuário atualizado");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["admin-profiles"] });
  };

  const remove = async (p: any) => {
    if (
      !confirm(
        `Remover ${p.ej_name ?? p.email} do portal? O login continua existindo, mas o usuário precisará refazer o cadastro de EJ ao entrar.`,
      )
    )
      return;
    const { error } = await supabase.from("profiles").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Usuário removido");
    qc.invalidateQueries({ queryKey: ["admin-profiles"] });
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-6 p-6 lg:p-10">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Usuários Cadastrados</h1>
            <p className="text-sm text-muted-foreground">
              EJs com login neste portal. Edite dados ou remova cadastros.
            </p>
          </div>
        </div>

        <Card className="p-4">
          <div className="relative mb-3">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por EJ, email ou região"
              className="pl-8"
            />
          </div>
          <div className="space-y-2">
            {filtered.map((p: any) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{p.ej_name ?? "(sem EJ cadastrada)"}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.email} · {p.region ?? "sem região"}
                    {p.full_name ? ` · ${p.full_name}` : ""}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(p)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => remove(p)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Nenhum usuário encontrado.
              </div>
            )}
          </div>
        </Card>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>E-mail</Label>
              <Input value={editing?.email ?? ""} disabled />
            </div>
            <div className="space-y-1">
              <Label>Nome completo</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>EJ vinculada</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={editQ}
                  onChange={(e) => setEditQ(e.target.value)}
                  placeholder="Buscar EJ"
                  className="pl-8"
                />
              </div>
              <div className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-md border p-2">
                {filteredEjs.map((e: any) => (
                  <button
                    key={e.slug}
                    type="button"
                    onClick={() => setEditSlug(e.slug)}
                    className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm ${
                      editSlug === e.slug ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                    }`}
                  >
                    <span className="font-medium">{e.name}</span>
                    <span
                      className={`text-xs ${
                        editSlug === e.slug ? "text-primary-foreground/80" : "text-muted-foreground"
                      }`}
                    >
                      {e.region}
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                A região é definida automaticamente pela EJ selecionada.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button onClick={saveEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
