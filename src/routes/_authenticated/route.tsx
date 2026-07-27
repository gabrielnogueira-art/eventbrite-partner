import { createFileRoute, Outlet, redirect, isRedirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) throw redirect({ to: "/auth" });

      // Enforce EJ selection (onboarding) for non-admins.
      const isOnboarding = location.pathname.startsWith("/onboarding");
      if (!isOnboarding && data.user.email !== "admin@portalej.test") {
        const { data: p } = await supabase
          .from("profiles")
          .select("ej_slug")
          .eq("id", data.user.id)
          .maybeSingle();
        if (!p?.ej_slug) throw redirect({ to: "/onboarding" });
      }
      return { user: data.user };
    } catch (error) {
      if (isRedirect(error)) throw error;
      console.error("Auth guard failed:", error);
      throw redirect({ to: "/auth" });
    }
  },
  component: () => <Outlet />,
});
