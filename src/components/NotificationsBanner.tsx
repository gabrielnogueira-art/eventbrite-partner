import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, X } from "lucide-react";

export function NotificationsBanner() {
  const qc = useQueryClient();
  const { data: items = [] } = useQuery({
    queryKey: ["my-notifications"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", u.user.id)
        .is("read_at", null)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  if (items.length === 0) return null;

  const dismiss = async (id: string) => {
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["my-notifications"] });
  };

  return (
    <div className="space-y-2 px-6 pt-6 lg:px-10">
      {items.map((n: any) => (
        <Card
          key={n.id}
          className="flex items-start gap-3 border-amber-500/40 bg-amber-500/5 p-4 text-sm"
        >
          <Bell className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="flex-1">
            <div className="font-semibold text-amber-900 dark:text-amber-200">{n.title}</div>
            {n.body && <div className="text-amber-900/80 dark:text-amber-200/80">{n.body}</div>}
          </div>
          <Button size="icon" variant="ghost" onClick={() => dismiss(n.id)} title="Marcar como lido">
            <X className="h-4 w-4" />
          </Button>
        </Card>
      ))}
    </div>
  );
}
