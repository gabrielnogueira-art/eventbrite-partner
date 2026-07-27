import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { User, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const qc = useQueryClient();
  const { data: profile } = useQuery({
    queryKey: ["profile-me"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", u.user.id)
        .maybeSingle();
      return { user: u.user, profile: data };
    },
  });

  const { data: directory = [] } = useQuery({
    queryKey: ["ej-directory"],
    queryFn: async () =>
      (await supabase.from("ej_directory").select("*").order("name")).data ?? [],
  });

  const [fullName, setFullName] = useState("");
  const [selectedSlug, setSelectedSlug] = useState<string>("");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);

  useEffect(() => {
    if (profile?.profile) {
      setFullName(profile.profile.full_name ?? "");
      setSelectedSlug(profile.profile.ej_slug ?? "");
    }
  }, [profile]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return directory;
    return directory.filter(
      (e: any) =>
        e.name.toLowerCase().includes(t) || e.region.toLowerCase().includes(t),
    );
  }, [q, directory]);

  const selectedEj = directory.find((e: any) => e.slug === selectedSlug);

  const save = async () => {
    if (!profile?.user) return;
    if (!selectedSlug || !selectedEj) return toast.error("Selecione sua EJ");
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim() || null,
        ej_name: (selectedEj as any).name,
        ej_slug: (selectedEj as any).slug,
        region: (selectedEj as any).region,
      })
      .eq("id", profile.user.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Perfil atualizado");
    qc.invalidateQueries({ queryKey: ["current-profile"] });
    qc.invalidateQueries({ queryKey: ["profile-me"] });
  };

  const changePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const pw = String(fd.get("password"));
    if (pw.length < 8) return toast.error("Mínimo 8 caracteres");
    setPwBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setPwBusy(false);
    if (error) return toast.error(error.message);
    (e.currentTarget as HTMLFormElement).reset();
    toast.success("Senha atualizada");
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-6 p-6 lg:p-10">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <User className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Meu perfil</h1>
            <p className="text-sm text-muted-foreground">
              Dados da EJ vinculada a este login.
            </p>
          </div>
        </div>

        <Card className="space-y-4 p-6">
          <div className="space-y-1">
            <Label>E-mail</Label>
            <Input value={profile?.user?.email ?? ""} disabled />
          </div>
          <div className="space-y-1">
            <Label>Nome completo</Label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Sua EJ</Label>
            {selectedEj && (
              <div className="mb-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
                <div className="font-medium">{(selectedEj as any).name}</div>
                <div className="text-xs text-muted-foreground">
                  Região: {(selectedEj as any).region}
                </div>
              </div>
            )}
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar EJ por nome ou região"
                className="pl-8"
              />
            </div>
            <div className="mt-2 max-h-56 space-y-1 overflow-y-auto rounded-md border p-2">
              {filtered.map((e: any) => (
                <button
                  key={e.slug}
                  type="button"
                  onClick={() => setSelectedSlug(e.slug)}
                  className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors ${
                    selectedSlug === e.slug
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent"
                  }`}
                >
                  <span className="font-medium">{e.name}</span>
                  <span
                    className={`text-xs ${
                      selectedSlug === e.slug
                        ? "text-primary-foreground/80"
                        : "text-muted-foreground"
                    }`}
                  >
                    {e.region}
                  </span>
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="p-3 text-center text-xs text-muted-foreground">
                  Nenhuma EJ encontrada.
                </div>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              A região é definida automaticamente com base na EJ selecionada.
            </p>
          </div>
          <div className="flex justify-end">
            <Button onClick={save} disabled={busy}>
              {busy ? "Salvando..." : "Salvar alterações"}
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold">Alterar senha</h2>
          <form onSubmit={changePassword} className="space-y-3">
            <div className="space-y-1">
              <Label>Nova senha</Label>
              <Input type="password" name="password" minLength={8} required />
            </div>
            <div className="flex justify-end">
              <Button type="submit" variant="outline" disabled={pwBusy}>
                {pwBusy ? "Atualizando..." : "Atualizar senha"}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
