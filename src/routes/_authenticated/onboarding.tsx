import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Building2, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: OnboardingPage,
});

function OnboardingPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fullName, setFullName] = useState("");

  const { data: profile } = useQuery({
    queryKey: ["me-profile-onboarding"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, ej_slug")
        .eq("id", u.user.id)
        .maybeSingle();
      return { user: u.user, profile: data };
    },
  });

  useEffect(() => {
    if (profile?.profile?.ej_slug) navigate({ to: "/", replace: true });
    if (profile?.profile?.full_name) setFullName(profile.profile.full_name);
    else if (profile?.user?.user_metadata?.full_name) setFullName(profile.user.user_metadata.full_name);
  }, [profile, navigate]);

  const { data: directory = [] } = useQuery({
    queryKey: ["ej-directory"],
    queryFn: async () =>
      (await supabase.from("ej_directory").select("*").order("name")).data ?? [],
  });

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return directory;
    return directory.filter((e: any) => e.name.toLowerCase().includes(t) || e.region.toLowerCase().includes(t));
  }, [q, directory]);

  const save = async () => {
    if (!selectedSlug) return toast.error("Selecione sua EJ");
    if (!fullName.trim()) return toast.error("Informe seu nome");
    const ej = directory.find((e: any) => e.slug === selectedSlug);
    if (!ej) return;
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("profiles").upsert({
      id: u.user.id,
      email: u.user.email,
      full_name: fullName.trim(),
      ej_name: ej.name,
      ej_slug: ej.slug,
      region: ej.region,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Perfil configurado!");
    navigate({ to: "/", replace: true });
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center p-6">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Building2 className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Selecione sua EJ</h1>
        <p className="text-sm text-muted-foreground">
          Para continuar, escolha qual Empresa Júnior você representa. Isso define sua região e quais ingressos ficam vinculados a você.
        </p>
      </div>
      <Card className="p-5">
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Seu nome</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Como você quer ser identificado" />
          </div>
          <div className="space-y-1">
            <Label>Buscar EJ</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome ou região" className="pl-8" />
            </div>
          </div>
          <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border p-2">
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
                <span className={`text-xs ${selectedSlug === e.slug ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                  {e.region}
                </span>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="p-3 text-center text-xs text-muted-foreground">Nenhuma EJ encontrada.</div>
            )}
          </div>
          <Button onClick={save} disabled={busy || !selectedSlug} className="w-full">
            {busy ? "Salvando..." : "Confirmar EJ"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
