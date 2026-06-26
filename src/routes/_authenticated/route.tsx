import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) throw redirect({ to: "/auth" });
      return { user: data.user };
    } catch (error) {
      // Network blocks, stale sessions, or browser storage issues should not land the user
      // on the generic error boundary. Send them back to login so they can recover.
      console.error("Auth guard failed:", error);
      throw redirect({ to: "/auth" });
    }
  },
  component: () => <Outlet />,
});
