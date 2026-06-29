import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const createPaddleTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { orderId: string; environment: "sandbox" | "live" }) => data,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: order, error } = await supabase
      .from("orders")
      .select("id, user_id, status, quantity, total_cents, event_id, events(title)")
      .eq("id", data.orderId)
      .maybeSingle();
    if (error || !order) throw new Error("Pedido não encontrado");
    if (order.user_id !== userId) throw new Error("Pedido não pertence ao usuário");
    if (order.status !== "pending") throw new Error("Pedido não está pendente");

    const { getPaddleClient } = await import("@/lib/paddle.server");
    const paddle = getPaddleClient(data.environment);

    const eventTitle = (order.events as any)?.title ?? "Pacote de ingressos";
    const unitCents = Math.max(70, Math.round(order.total_cents / order.quantity));

    const tx = await paddle.transactions.create({
      items: [
        {
          quantity: order.quantity,
          price: {
            description: `${eventTitle} — pacote EJ`,
            name: eventTitle.slice(0, 50),
            unitPrice: { amount: String(unitCents), currencyCode: "BRL" as any },
            taxMode: "internal" as any,
            product: { name: eventTitle.slice(0, 50), taxCategory: "standard" as any },
          } as any,
        },
      ],
      customData: { orderId: order.id, userId: order.user_id },
    } as any);

    return { transactionId: tx.id };
  });
