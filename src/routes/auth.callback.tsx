import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    const decide = async () => {
      try {
        const { data: u } = await supabase.auth.getUser();
        if (!mounted) return;
        if (!u.user) return navigate({ to: "/auth", replace: true });
        const { data: p } = await supabase
          .from("profiles")
          .select("ej_slug")
          .eq("id", u.user.id)
          .maybeSingle();
        if (!p?.ej_slug) navigate({ to: "/onboarding", replace: true });
        else navigate({ to: "/", replace: true });
      } catch (err) {
        console.error(err);
        navigate({ to: "/auth", replace: true });
      }
    };
    // small delay to allow session hydration from OAuth
    const t = setTimeout(decide, 200);
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") decide();
    });
    return () => {
      mounted = false;
      clearTimeout(t);
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Concluindo login...
      </div>
    </div>
  );
}
