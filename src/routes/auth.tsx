import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
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
  const [showForgot, setShowForgot] = useState(false);

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
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: String(fd.get("email")),
        password: String(fd.get("password")),
      });
      if (error) return toast.error(error.message || "Não foi possível entrar.");
    } finally {
      setLoading(false);
    }
    toast.success("Bem-vindo!");
    navigate({ to: "/", replace: true });
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: String(fd.get("email")),
        password: String(fd.get("password")),
        options: {
          emailRedirectTo: window.location.origin,
          data: { full_name: String(fd.get("full_name")) },
        },
      });
      if (error) return toast.error(error.message || "Não foi possível criar a conta.");
    } finally {
      setLoading(false);
    }
    toast.success("Conta criada! Você já pode entrar.");
  };

  const handleGoogle = async () => {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/auth/callback`,
      });
      if (result.error) return toast.error(result.error.message || "Falha no login Google");
      if (result.redirected) return;
      // popup flow (editor preview) — session set by helper
      navigate({ to: "/auth/callback", replace: true });
    } catch (err: any) {
      toast.error(err?.message ?? "Falha no login Google");
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email"));
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) return toast.error(error.message);
      toast.success("Enviamos um e-mail com as instruções de redefinição.");
      setShowForgot(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/30 px-4 py-8">
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
          {showForgot ? (
            <form onSubmit={handleForgot} className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Esqueci minha senha</h2>
                <p className="text-xs text-muted-foreground">
                  Informe o e-mail cadastrado; enviaremos um link para redefinir sua senha.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fp-email">E-mail</Label>
                <Input id="fp-email" name="email" type="email" required />
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowForgot(false)}>
                  Voltar
                </Button>
                <Button type="submit" className="flex-1" disabled={loading}>
                  {loading ? "Enviando..." : "Enviar"}
                </Button>
              </div>
            </form>
          ) : (
            <>
              <Button type="button" variant="outline" className="w-full" onClick={handleGoogle} disabled={loading}>
                <GoogleIcon className="mr-2 h-4 w-4" />
                Entrar com Google
              </Button>
              <div className="my-4 flex items-center gap-2 text-xs text-muted-foreground">
                <div className="h-px flex-1 bg-border" />
                ou
                <div className="h-px flex-1 bg-border" />
              </div>
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
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password">Senha</Label>
                        <button
                          type="button"
                          className="text-xs text-primary hover:underline"
                          onClick={() => setShowForgot(true)}
                        >
                          Esqueci minha senha
                        </button>
                      </div>
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
            </>
          )}
        </Card>
        <div className="mt-4 rounded-lg border bg-card p-3 text-xs">
          <div className="mb-1 font-semibold">Logins de teste</div>
          <ul className="space-y-1 text-muted-foreground">
            <li><strong>admin@portalej.test</strong> · Admin123! — Administrador</li>
            <li><strong>alqualis@portalej.test</strong> · Senha123! — ALQUALIS (Norte)</li>
            <li><strong>adjunior@portalej.test</strong> · Senha123! — AD JÚNIOR (Sul)</li>
            <li><strong>fluxo@portalej.test</strong> · Senha123! — Fluxo (Centro Sul 2)</li>
            <li><strong>poli@portalej.test</strong> · Senha123! — Poli Junior (Centro Sul 1)</li>
            <li><strong>ejfgv@portalej.test</strong> · Senha123! — EJFGV (Centro Sul 1)</li>
            <li><strong>rio@portalej.test</strong> · Senha123! — Rio Junior (Centro Sul 2)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#4285F4" d="M23.06 12.25c0-.78-.07-1.54-.2-2.27H12v4.3h6.2a5.3 5.3 0 0 1-2.3 3.48v2.9h3.72c2.18-2 3.44-4.97 3.44-8.41z"/>
      <path fill="#34A853" d="M12 24c3.11 0 5.72-1.03 7.62-2.79l-3.72-2.9c-1.03.69-2.35 1.1-3.9 1.1-3 0-5.53-2.02-6.44-4.74H1.72v2.98A12 12 0 0 0 12 24z"/>
      <path fill="#FBBC05" d="M5.56 14.67a7.2 7.2 0 0 1 0-4.6V7.09H1.72a12 12 0 0 0 0 10.56l3.84-2.98z"/>
      <path fill="#EA4335" d="M12 4.75c1.69 0 3.2.58 4.4 1.72l3.3-3.3C17.71 1.2 15.1 0 12 0A12 12 0 0 0 1.72 7.09l3.84 2.98C6.47 6.77 9 4.75 12 4.75z"/>
    </svg>
  );
}
