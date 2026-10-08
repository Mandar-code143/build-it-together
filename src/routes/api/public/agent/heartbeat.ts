import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const n = z.number().finite().nullable().optional().transform((v) => v ?? null);
const Body = z.object({
  cpu_percent: n, memory_percent: n, disk_percent: n,
  memory_used_bytes: n, memory_total_bytes: n, disk_used_bytes: n, disk_total_bytes: n,
  load1: n, load5: n, load15: n, uptime_seconds: n, net_rx_bytes: n, net_tx_bytes: n,
  reported_health: z.enum(["healthy", "degraded", "unhealthy"]).optional(),
  agent_version: z.string().max(50).optional(),
  address: z.string().max(100).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export const Route = createFileRoute("/api/public/agent/heartbeat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const api = await import("@/lib/agent-api.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const auth = await api.authenticateNode(request);
        if ("response" in auth) return auth.response;
        const parsed = Body.safeParse(await api.parseJson(request));
        if (!parsed.success) return api.fail("Invalid heartbeat payload", 400, { issues: parsed.error.issues });
        const { agent_version, address, payload, ...m } = parsed.data;
        const nodeId = auth.node.nodeId;
        const now = new Date().toISOString();

        const { error } = await supabaseAdmin.from("heartbeats").insert({
          node_id: nodeId, ...m, reported_health: m.reported_health ?? "healthy",
          payload: (payload ?? {}) as never, received_at: now,
        });
        if (error) return api.fail("Could not store heartbeat", 500);

        const status = m.reported_health && m.reported_health !== "healthy" ? "degraded" : "online";
        const { data: prev } = await supabaseAdmin.from("nodes").select("status").eq("id", nodeId).single();
        await supabaseAdmin.from("nodes").update({
          last_heartbeat_at: now, last_metrics_at: now, status,
          ...(agent_version ? { agent_version } : {}), ...(address ? { address } : {}),
        }).eq("id", nodeId);
        if (prev && prev.status === "offline") {
          await api.audit("node.recovered", "node", nodeId, { previous: prev.status });
        }
        // Opportunistically sweep stale nodes on every heartbeat.
        await supabaseAdmin.rpc("evaluate_node_availability");

        return api.json({ ok: true, server_time: now });
      },
    },
  },
});
