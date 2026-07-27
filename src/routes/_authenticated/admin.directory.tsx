import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell, useIsAdmin } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { REGIONS } from "@/lib/regions";
import { Building2, Plus, Trash2, Pencil, Check, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/directory")({
  component: DirectoryPage,
});

function slugify(s: string) {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function DirectoryPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: isAdmin } = useIsAdmin();
  useEffect(() => {
    if (isAdmin === false) navigate({ to: "/" });
  }, [isAdmin, navigate]);

  const [q, setQ] = useState("");
  const [newEJ, setNewEJ] = useState({ name: "", region: REGIONS[0] as string });
  const [editing, setEditing] = useState<{ id: string; name: string; region: string } | null>(null);

  const { data: rows = [] } = useQuery({
    queryKey: ["ej-directory-admin"],
    queryFn: async () =>
      (await supabase.from("ej_directory").select("*").order("region").order("name")).data ?? [],
  });

  const grouped = useMemo(() => {
    const t = q.trim().toLowerCase();
    const filtered = t
      ? rows.filter((r: any) => r.name.toLowerCase().includes(t) || r.region.toLowerCase().includes(t))
      : rows;
    return REGIONS.map((r) => ({ region: r, items: filtered.filter((x: any) => x.region === r) }));
  }, [rows, q]);

  const add = async () => {
    if (!newEJ.name.trim()) return toast.error("Informe o nome");
    const { error } = await supabase.from("ej_directory").insert({
      name: newEJ.name.trim(),
      slug: slugify(newEJ.name),
      region: newEJ.region,
    });
    if (error) return toast.error(error.message);
    toast.success("EJ adicionada");
    setNewEJ({ name: "", region: REGIONS[0] as string });
    qc.invalidateQueries({ queryKey: ["ej-directory-admin"] });
    qc.invalidateQueries({ queryKey: ["ej-directory"] });
  };

  const save = async () => {
    if (!editing) return;
    const { error } = await supabase
      .from("ej_directory")
      .update({ name: editing.name.trim(), slug: slugify(editing.name), region: editing.region })
      .eq("id", editing.id);
    if (error) return toast.error(error.message);
    toast.success("Atualizado");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["ej-directory-admin"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Remover esta EJ do diretório?")) return;
    const { error } = await supabase.from("ej_directory").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Removido");
    qc.invalidateQueries({ queryKey: ["ej-directory-admin"] });
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl p-6 lg:p-10 space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Diretório de EJs Federadas</h1>
            <p className="text-sm text-muted-foreground">Base oficial de EJs federadas à RioJunior por região.</p>
          </div>
        </div>

        <Card className="p-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_200px_auto]">
            <div className="space-y-1">
              <Label className="text-xs">Nome</Label>
              <Input value={newEJ.name} onChange={(e) => setNewEJ({ ...newEJ, name: e.target.value })} placeholder="Nova EJ" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Região</Label>
              <Select value={newEJ.region} onValueChange={(v) => setNewEJ({ ...newEJ, region: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REGIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={add}><Plus className="mr-2 h-4 w-4" />Adicionar</Button>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar EJ ou região" className="mb-4" />
          <div className="space-y-6">
            {grouped.map(({ region, items }) => (
              <div key={region}>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{region}</h3>
                  <span className="text-xs text-muted-foreground">{items.length}</span>
                </div>
                <div className="space-y-1">
                  {items.map((r: any) =>
                    editing?.id === r.id ? (
                      <div key={r.id} className="grid gap-2 rounded-md border bg-muted/30 p-2 sm:grid-cols-[1fr_180px_auto]">
                        <Input value={editing.name} onChange={(e) => setEditing((s) => (s ? { ...s, name: e.target.value } : s))} />
                        <Select value={editing.region} onValueChange={(v) => setEditing((s) => (s ? { ...s, region: v } : s))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {REGIONS.map((rg) => <SelectItem key={rg} value={rg}>{rg}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <div className="flex gap-1">
                          <Button size="sm" onClick={save}><Check className="h-4 w-4" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditing(null)}><X className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    ) : (
                      <div key={r.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                        <span className="font-medium">{r.name}</span>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setEditing({ id: r.id, name: r.name, region: r.region })}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(r.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ),
                  )}
                  {items.length === 0 && (
                    <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">Nenhuma EJ nesta região.</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
