import { createFileRoute } from "@tanstack/react-router";

/**
 * Prometheus HTTP service discovery. Protected by PROMETHEUS_SD_TOKEN (Bearer).
 * Returns only enabled nodes with a known address.
 */
export const Route = createFileRoute("/api/public/prometheus/targets")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const api = await import("@/lib/agent-api.server");
        const expected = process.env["PROMETHEUS_SD_TOKEN"];
        const got = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
        if (!expected || !got || !api.safeEqual(await api.sha256Hex(got), await api.sha256Hex(expected))) {
          return api.fail("Unauthorized", 401);
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("nodes").select("id,hostname,address,node_exporter_port,environment,status")
          .eq("enabled", true).not("address", "is", null);
        if (error) return api.fail("Unavailable", 503);
        return api.json((data ?? []).map((n) => ({
          targets: [`${n.address}:${n.node_exporter_port}`],
          labels: { node_id: n.id, hostname: n.hostname, environment: n.environment, fleet_status: n.status },
        })));
      },
    },
  },
});
