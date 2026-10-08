import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/** Scheduled sweep that marks stale nodes offline and raises/resolves alerts. */
export const Route = createFileRoute("/api/public/cron/availability")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin.rpc("evaluate_node_availability");
        if (error) return new Response("sweep failed", { status: 500 });
        return Response.json({ ok: true });
      },
    },
  },
});
