import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Ticket } from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      supabase.auth
        .getUser()
        .then(({ data }) => {
          if (data?.user) navigate({ to: "/", replace: true });
        })
        .catch((err) => console.error("Supabase getUser error:", err));
    } catch (err) {
      console.error("Erro ao verificar usuário do Supabase:", err);
    }
  }, [navigate]);

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: String(fd.get("email")),
      password: String(fd.get("password")),
    });
    setLoading(false);
    if (error) {
      console.error("DEBUG LOGIN ERROR:", error);
      const rawError = JSON.stringify(error, Object.getOwnPropertyNames(error));
      // @ts-ignore - access internal supabaseUrl if possible
      const url = supabase.supabaseUrl || "unknown url";
      return toast.error(`Erro detalhado: ${error.message || "Sem mensagem"} | URL: ${url} | Raw: ${rawError}`);
    }
    toast.success("Bem-vindo!");
    navigate({ to: "/", replace: true });
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: String(fd.get("email")),
      password: String(fd.get("password")),
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: String(fd.get("full_name")) },
      },
    });
    setLoading(false);
    if (error) {
      console.error("DEBUG SIGNUP ERROR:", error);
      const rawError = JSON.stringify(error, Object.getOwnPropertyNames(error));
      // @ts-ignore - access internal supabaseUrl if possible
      const url = supabase.supabaseUrl || "unknown url";
      return toast.error(`Erro detalhado: ${error.message || "Sem mensagem"} | URL: ${url} | Raw: ${rawError}`);
    }
    toast.success("Conta criada! Você já pode entrar.");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/30 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Ticket className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Portal EJ</h1>
          <p className="text-sm text-muted-foreground">
            Eventos e ingressos para Empresas Juniores
          </p>
        </div>
        <Card className="p-6">
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar conta</TabsTrigger>
            </TabsList>
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" name="email" type="email" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input id="password" name="password" type="password" required minLength={6} />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Entrando..." : "Entrar"}
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="su-name">Nome completo</Label>
                  <Input id="su-name" name="full_name" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="su-email">E-mail</Label>
                  <Input id="su-email" name="email" type="email" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="su-pw">Senha</Label>
                  <Input id="su-pw" name="password" type="password" required minLength={8} />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Criando..." : "Criar conta"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </Card>
        <div className="mt-4 rounded-lg border bg-card p-3 text-xs">
          <div className="mb-1 font-semibold">Logins de teste</div>
          <ul className="space-y-1 text-muted-foreground">
            <li><strong>admin@portalej.test</strong> · Admin123! — Administrador</li>
            <li><strong>user@portalej.test</strong> · User123! — Empresa Júnior Demo</li>
            <li><strong>rio@portalej.test</strong> · Senha123! — Rio Junior</li>
            <li><strong>fluxo@portalej.test</strong> · Senha123! — Fluxo Consultoria</li>
            <li><strong>ejfgv@portalej.test</strong> · Senha123! — EJFGV</li>
            <li><strong>poli@portalej.test</strong> · Senha123! — Poli Junior</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
