import { createFileRoute } from "@tanstack/react-router";

/** Agent polls for queued commands. Returns at most 5, marking them dispatched. */
export const Route = createFileRoute("/api/public/agent/commands")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const api = await import("@/lib/agent-api.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const auth = await api.authenticateNode(request);
        if ("response" in auth) return auth.response;
        const nodeId = auth.node.nodeId;
        const now = new Date();

        // Time out commands that were dispatched/running past their deadline.
        const { data: stale } = await supabaseAdmin
          .from("commands").select("id,dispatched_at,timeout_seconds")
          .eq("node_id", nodeId).in("status", ["dispatched", "running"]);
        for (const c of stale ?? []) {
          if (c.dispatched_at && now.getTime() - new Date(c.dispatched_at).getTime() > (c.timeout_seconds + 30) * 1000) {
            await supabaseAdmin.from("commands").update({
              status: "timed_out", finished_at: now.toISOString(), error: "No result before timeout",
            }).eq("id", c.id);
          }
        }

        const { data: queued, error } = await supabaseAdmin
          .from("commands").select("id,action,args,timeout_seconds,idempotency_key,attempt")
          .eq("node_id", nodeId).eq("status", "queued").order("queued_at").limit(5);
        if (error) return api.fail("Could not load commands", 500);
        const ids = (queued ?? []).map((c) => c.id);
        if (ids.length) {
          await supabaseAdmin.from("commands")
            .update({ status: "dispatched", dispatched_at: now.toISOString() })
            .in("id", ids).eq("status", "queued");
        }
        return api.json({ commands: queued ?? [] });
      },
    },
  },
});
