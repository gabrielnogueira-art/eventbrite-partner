import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, useIsAdmin } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { signedUrl, fileExt } from "@/lib/storage";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  component: AdminSettingsPage,
});

function AdminSettingsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: isAdmin, isLoading } = useIsAdmin();
  useEffect(() => {
    if (!isLoading && isAdmin === false) navigate({ to: "/" });
  }, [isAdmin, isLoading, navigate]);

  const { data: settings } = useQuery({
    queryKey: ["app-settings"],
    queryFn: async () =>
      (await supabase.from("app_settings").select("*").eq("id", 1).maybeSingle()).data,
  });

  const [form, setForm] = useState({
    pix_key: "",
    pix_key_type: "email",
    pix_recipient_name: "",
    pix_instructions: "",
    pix_qr_url: "",
  });
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setForm({
      pix_key: settings.pix_key ?? "",
      pix_key_type: settings.pix_key_type ?? "email",
      pix_recipient_name: settings.pix_recipient_name ?? "",
      pix_instructions: settings.pix_instructions ?? "",
      pix_qr_url: settings.pix_qr_url ?? "",
    });
    if (settings.pix_qr_url)
      signedUrl("pix-assets", settings.pix_qr_url, 3600).then(setQrPreview);
  }, [settings]);

  const handleQrUpload = async (file: File) => {
    setUploading(true);
    const path = `qr-${Date.now()}.${fileExt(file.name)}`;
    const { error } = await supabase.storage.from("pix-assets").upload(path, file, {
      upsert: false,
      contentType: file.type,
    });
    if (error) {
      setUploading(false);
      return toast.error(error.message);
    }
    setForm((s) => ({ ...s, pix_qr_url: path }));
    const url = await signedUrl("pix-assets", path, 3600);
    setQrPreview(url);
    setUploading(false);
    toast.success("QR Code carregado. Clique em Salvar para confirmar.");
  };

  const save = async () => {
    const { error } = await supabase.from("app_settings").update(form).eq("id", 1);
    if (error) return toast.error(error.message);
    toast.success("Configurações salvas");
    qc.invalidateQueries({ queryKey: ["app-settings"] });
  };

  if (!isAdmin)
    return (
      <AppShell>
        <div className="p-10 text-sm text-muted-foreground">Verificando permissão...</div>
      </AppShell>
    );

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl p-6 lg:p-10 space-y-6">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-primary">Admin</div>
          <h1 className="text-2xl font-bold tracking-tight">Configurações de pagamento</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Dados PIX exibidos para as EJs na tela de checkout. Atualize sempre que necessário.
          </p>
        </div>

        <Card className="p-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Tipo da chave</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={form.pix_key_type}
                onChange={(e) => setForm({ ...form, pix_key_type: e.target.value })}
              >
                <option value="email">E-mail</option>
                <option value="cpf">CPF</option>
                <option value="cnpj">CNPJ</option>
                <option value="phone">Telefone</option>
                <option value="random">Chave aleatória</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>Chave PIX *</Label>
              <Input
                value={form.pix_key}
                onChange={(e) => setForm({ ...form, pix_key: e.target.value })}
                placeholder="pix@exemplo.com"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Nome do recebedor</Label>
              <Input
                value={form.pix_recipient_name}
                onChange={(e) => setForm({ ...form, pix_recipient_name: e.target.value })}
                placeholder="Razão social ou nome"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Instruções (opcional)</Label>
              <Textarea
                value={form.pix_instructions}
                onChange={(e) => setForm({ ...form, pix_instructions: e.target.value })}
                placeholder="Ex.: Coloque o nome da sua EJ na descrição da transferência."
                rows={3}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>QR Code (imagem)</Label>
            <div className="flex flex-wrap items-start gap-4">
              {qrPreview ? (
                <img
                  src={qrPreview}
                  alt="QR PIX"
                  className="h-48 w-48 rounded-lg border bg-white object-contain p-2"
                />
              ) : (
                <div className="flex h-48 w-48 items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">
                  Nenhum QR enviado
                </div>
              )}
              <div className="flex-1 min-w-[200px] space-y-2">
                <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm hover:bg-accent">
                  <Upload className="h-4 w-4" />
                  {uploading ? "Enviando..." : "Selecionar imagem do QR"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleQrUpload(e.target.files[0])}
                  />
                </label>
                <p className="text-xs text-muted-foreground">
                  Use a imagem gerada pelo seu banco. Pode embutir valor/identificador.
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={save}>Salvar configurações</Button>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
