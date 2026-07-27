import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { REGIONS } from "@/lib/regions";
import { User } from "lucide-react";

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

  const [form, setForm] = useState({ full_name: "", ej_name: "", region: "" });
  const [busy, setBusy] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);

  useEffect(() => {
    if (profile?.profile) {
      setForm({
        full_name: profile.profile.full_name ?? "",
        ej_name: profile.profile.ej_name ?? "",
        region: profile.profile.region ?? "",
      });
    }
  }, [profile]);

  const save = async () => {
    if (!profile?.user) return;
    if (!form.ej_name.trim()) return toast.error("Informe o nome da EJ");
    if (!form.region) return toast.error("Selecione uma região");
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: form.full_name.trim() || null,
        ej_name: form.ej_name.trim(),
        region: form.region,
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
      <div className="mx-auto max-w-2xl p-6 lg:p-10 space-y-6">
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

        <Card className="p-6 space-y-4">
          <div className="space-y-1">
            <Label>E-mail</Label>
            <Input value={profile?.user?.email ?? ""} disabled />
          </div>
          <div className="space-y-1">
            <Label>Nome completo</Label>
            <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Nome da EJ</Label>
            <Input value={form.ej_name} onChange={(e) => setForm({ ...form, ej_name: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Região</Label>
            <Select value={form.region} onValueChange={(v) => setForm({ ...form, region: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione a região" /></SelectTrigger>
              <SelectContent>
                {REGIONS.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end">
            <Button onClick={save} disabled={busy}>{busy ? "Salvando..." : "Salvar alterações"}</Button>
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
              <Button type="submit" variant="outline" disabled={pwBusy}>{pwBusy ? "Atualizando..." : "Atualizar senha"}</Button>
            </div>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
