import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Console } from "@/components/console/AuthGate";
import { PageHeader, Panel, CodeBlock, StatTile, TableSkeleton } from "@/components/console/Primitives";
import { pct } from "@/lib/fleet";

export const Route = createFileRoute("/observability")({
  head: () => ({
    meta: [
      { title: "Observability — FleetOps" },
      { name: "description", content: "Fleet-wide telemetry rollups plus Prometheus service discovery and Grafana wiring." },
      { property: "og:title", content: "Observability — FleetOps" },
      { property: "og:description", content: "Fleet-wide telemetry rollups plus Prometheus service discovery and Grafana wiring." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <Console>
      <ObservabilityPage />
    </Console>
  ),
});

function ObservabilityPage() {
  const q = useQuery({
    queryKey: ["obs-rollup"],
    refetchInterval: 15000,
    queryFn: async () => {
      const since = new Date(Date.now() - 15 * 60_000).toISOString();
      const { data, error } = await supabase.from("heartbeats")
        .select("node_id,cpu_percent,memory_percent,disk_percent,received_at")
        .gte("received_at", since).order("received_at", { ascending: false }).limit(2000);
      if (error) throw error;
      const rows = data ?? [];
      const avg = (k: "cpu_percent" | "memory_percent" | "disk_percent") => {
        const v = rows.map((r) => r[k]).filter((x): x is number => x != null);
        return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
      };
      return { count: rows.length, nodes: new Set(rows.map((r) => r.node_id)).size, cpu: avg("cpu_percent"), mem: avg("memory_percent"), disk: avg("disk_percent") };
    },
  });
  const origin = typeof window !== "undefined" ? window.location.origin : "https://your-fleetops-host";

  return (
    <>
      <PageHeader title="Observability" subtitle="Last 15 minutes of agent telemetry, and how to wire Prometheus and Grafana." />
      {q.isLoading ? <TableSkeleton rows={1} cols={4} /> : (
        <div className="grid gap-3 sm:grid-cols-5">
          <StatTile label="heartbeats / 15m" value={String(q.data?.count ?? 0)} />
          <StatTile label="reporting nodes" value={String(q.data?.nodes ?? 0)} />
          <StatTile label="avg cpu" value={pct(q.data?.cpu)} />
          <StatTile label="avg memory" value={pct(q.data?.mem)} />
          <StatTile label="avg disk" value={pct(q.data?.disk)} />
        </div>
      )}
      <Panel title="Prometheus service discovery">
        <div className="space-y-2 p-3 text-[12.5px] text-muted-foreground">
          <p>Prometheus discovers node_exporter targets from the control plane. Requests must carry the shared <span className="font-mono">PROMETHEUS_SD_TOKEN</span>.</p>
          <CodeBlock label="prometheus.yml">{`scrape_configs:
  - job_name: fleetops-nodes
    http_sd_configs:
      - url: ${origin}/api/public/prometheus/targets
        refresh_interval: 60s
        authorization:
          type: Bearer
          credentials_file: /etc/prometheus/fleetops_sd_token`}</CodeBlock>
          <p>The full docker-compose stack, alert rules and a Grafana dashboard live in the repository under <span className="font-mono">deploy/</span>.</p>
        </div>
      </Panel>
    </>
  );
}
