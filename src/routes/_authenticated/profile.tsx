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
import { User, Search, Clock } from "lucide-react";

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
      const { data } = await supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
      return { user: u.user, profile: data };
    },
  });

  const { data: directory = [] } = useQuery({
    queryKey: ["ej-directory"],
    queryFn: async () => (await supabase.from("ej_directory").select("*").order("name")).data ?? [],
  });

  const { data: pendingReq } = useQuery({
    queryKey: ["my-ej-change-request"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase
        .from("ej_change_requests" as any)
        .select("*")
        .eq("user_id", u.user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const [fullName, setFullName] = useState("");
  const [selectedSlug, setSelectedSlug] = useState<string>("");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

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
      (e: any) => e.name.toLowerCase().includes(t) || e.region.toLowerCase().includes(t),
    );
  }, [q, directory]);

  const currentSlug = profile?.profile?.ej_slug ?? "";
  const selectedEj = directory.find((e: any) => e.slug === selectedSlug);
  const ejChanged = selectedSlug && selectedSlug !== currentSlug;

  const saveName = async () => {
    if (!profile?.user) return;
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName.trim() || null })
      .eq("id", profile.user.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Nome atualizado");
    qc.invalidateQueries({ queryKey: ["profile-me"] });
    qc.invalidateQueries({ queryKey: ["current-profile"] });
  };

  const requestEjChange = async () => {
    if (!selectedSlug || !ejChanged) return;
    setBusy(true);
    const { error } = await supabase.rpc("request_ej_change" as any, { _slug: selectedSlug } as any);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Solicitação enviada. Aguarde aprovação do admin.");
    qc.invalidateQueries({ queryKey: ["my-ej-change-request"] });
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
            <p className="text-sm text-muted-foreground">Dados da EJ vinculada a este login.</p>
          </div>
        </div>

        <Card className="space-y-4 p-6">
          <div className="space-y-1">
            <Label>E-mail</Label>
            <Input value={profile?.user?.email ?? ""} disabled />
          </div>
          <div className="space-y-1">
            <Label>Nome completo</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="flex justify-end">
            <Button onClick={saveName} disabled={busy} variant="outline">
              Salvar nome
            </Button>
          </div>
        </Card>

        <Card className="space-y-4 p-6">
          <div>
            <h2 className="text-lg font-semibold">EJ vinculada</h2>
            <p className="text-sm text-muted-foreground">
              Trocar de EJ exige aprovação do administrador. A região é definida automaticamente.
            </p>
          </div>

          {profile?.profile?.ej_name && (
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
              <div className="text-xs uppercase text-muted-foreground">EJ atual</div>
              <div className="font-medium">{profile.profile.ej_name}</div>
              <div className="text-xs text-muted-foreground">Região: {profile.profile.region}</div>
            </div>
          )}

          {pendingReq && (
            <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              <Clock className="mt-0.5 h-4 w-4 text-amber-600" />
              <div>
                <div className="font-medium text-amber-700 dark:text-amber-500">Solicitação pendente</div>
                <div className="text-xs text-muted-foreground">
                  Você pediu troca para <span className="font-medium">{(pendingReq as any).requested_ej_name}</span> ({(pendingReq as any).requested_region}). Aguardando análise.
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Selecionar nova EJ</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar EJ por nome ou região"
                className="pl-8"
              />
            </div>
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border p-2">
              {filtered.map((e: any) => (
                <button
                  key={e.slug}
                  type="button"
                  onClick={() => setSelectedSlug(e.slug)}
                  className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors ${
                    selectedSlug === e.slug ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                  }`}
                >
                  <span className="font-medium">{e.name}</span>
                  <span
                    className={`text-xs ${
                      selectedSlug === e.slug ? "text-primary-foreground/80" : "text-muted-foreground"
                    }`}
                  >
                    {e.region}
                  </span>
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="p-3 text-center text-xs text-muted-foreground">Nenhuma EJ encontrada.</div>
              )}
            </div>
            {selectedEj && ejChanged && (
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                Nova EJ: <span className="font-medium text-foreground">{(selectedEj as any).name}</span> — Região {(selectedEj as any).region}
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button onClick={requestEjChange} disabled={busy || !ejChanged || !!pendingReq}>
              {pendingReq ? "Solicitação pendente" : "Solicitar troca de EJ"}
            </Button>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
