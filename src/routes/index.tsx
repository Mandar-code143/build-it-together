import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Console } from "@/components/console/AuthGate";
import { PageHeader, Panel, StatTile, EmptyState, ErrorState, TableSkeleton, MetricBar } from "@/components/console/Primitives";
import { NodeStatusBadge, SeverityBadge, CommandStatusBadge } from "@/components/console/StatusBadge";
import { effectiveStatus, relativeTime, pct } from "@/lib/fleet";
import type { NodeRow, AlertRow, CommandRow } from "@/lib/fleet";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Fleet overview — FleetOps" },
      { name: "description", content: "Live availability, saturation and incident overview for the managed Linux fleet." },
      { property: "og:title", content: "Fleet overview — FleetOps" },
      { property: "og:description", content: "Live availability, saturation and incident overview for the managed Linux fleet." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OverviewPage,
});

function OverviewPage() {
  return (
    <Console>
      <Overview />
    </Console>
  );
}

function Overview() {
  const nodes = useQuery({
    queryKey: ["overview-nodes"],
    refetchInterval: 10000,
    queryFn: async () => {
      const { data, error } = await supabase.from("nodes").select("*").order("hostname");
      if (error) throw error;
      return (data ?? []) as NodeRow[];
    },
  });

  const alerts = useQuery({
    queryKey: ["overview-alerts"],
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alerts")
        .select("*")
        .eq("state", "firing")
        .order("started_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return (data ?? []) as AlertRow[];
    },
  });

  const commands = useQuery({
    queryKey: ["overview-commands"],
    refetchInterval: 8000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commands")
        .select("*")
        .order("queued_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return (data ?? []) as CommandRow[];
    },
  });

  const latest = useQuery({
    queryKey: ["overview-heartbeats"],
    refetchInterval: 10000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("heartbeats")
        .select("node_id,cpu_percent,memory_percent,disk_percent,received_at")
        .order("received_at", { ascending: false })
        .limit(400);
      if (error) throw error;
      return data ?? [];
    },
  });

  const list = nodes.data ?? [];
  const states = list.map((n) => effectiveStatus(n));
  const count = (s: string) => states.filter((x) => x === s).length;

  const perNode = new Map<string, { cpu: number | null; mem: number | null; disk: number | null }>();
  for (const h of latest.data ?? []) {
    if (!perNode.has(h.node_id)) perNode.set(h.node_id, { cpu: h.cpu_percent, mem: h.memory_percent, disk: h.disk_percent });
  }
  const avg = (pick: (v: { cpu: number | null; mem: number | null; disk: number | null }) => number | null) => {
    const vals = [...perNode.values()].map(pick).filter((v): v is number => v != null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };

  const availability = list.length ? (count("online") / list.length) * 100 : null;

  return (
    <>
      <PageHeader
        title="Fleet overview"
        subtitle="Availability derived from heartbeat freshness; saturation from the newest sample per node."
        actions={
          <Link to="/nodes" className="text-[12.5px] text-primary underline-offset-2 hover:underline">
            inspect nodes →
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatTile label="Nodes managed" value={String(list.length).padStart(2, "0")} hint="enrolled in this control plane" />
        <StatTile label="Online" value={String(count("online")).padStart(2, "0")} tone="ok" hint="heartbeat within threshold" />
        <StatTile
          label="Degraded"
          value={String(count("degraded") + count("recovering")).padStart(2, "0")}
          tone="warn"
          hint="late heartbeat or unhealthy subsystem"
        />
        <StatTile label="Offline" value={String(count("offline")).padStart(2, "0")} tone="crit" hint="missed 4 intervals" />
        <StatTile
          label="Availability"
          value={availability == null ? "—" : `${availability.toFixed(1)}%`}
          tone={availability != null && availability >= 99 ? "ok" : availability != null && availability >= 90 ? "warn" : "crit"}
          hint="online / enrolled, instantaneous"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel title="Nodes" right={<span className="mono-num text-[11px] text-muted-foreground">auto-refresh 10s</span>}>
          {nodes.isLoading ? (
            <TableSkeleton />
          ) : nodes.error ? (
            <ErrorState message={(nodes.error as Error).message} />
          ) : list.length === 0 ? (
            <EmptyState
              title="No nodes enrolled yet"
              hint="Issue an enrollment token in Settings, then run the installer on a Linux host. Nodes appear here within one heartbeat interval."
              action={
                <Link to="/settings" className="text-[12.5px] text-primary underline-offset-2 hover:underline">
                  open Settings →
                </Link>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="console-table">
                <thead>
                  <tr>
                    <th>Host</th>
                    <th>Status</th>
                    <th>CPU</th>
                    <th>Memory</th>
                    <th>Disk</th>
                    <th>Heartbeat</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((n) => {
                    const m = perNode.get(n.id);
                    return (
                      <tr key={n.id}>
                        <td>
                          <Link
                            to="/nodes/$nodeId"
                            params={{ nodeId: n.id }}
                            className="font-mono text-[12.5px] text-primary underline-offset-2 hover:underline"
                          >
                            {n.hostname}
                          </Link>
                          <div className="text-[11px] text-muted-foreground">{n.environment}</div>
                        </td>
                        <td>
                          <NodeStatusBadge status={effectiveStatus(n)} since={n.last_heartbeat_at} compact />
                        </td>
                        <td className="mono-num">{pct(m?.cpu)}</td>
                        <td className="mono-num">{pct(m?.mem)}</td>
                        <td className="mono-num">{pct(m?.disk)}</td>
                        <td className="mono-num text-muted-foreground">{relativeTime(n.last_heartbeat_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel title="Fleet saturation" className="p-3">
            <div className="space-y-3">
              <MetricBar label="cpu (mean)" value={avg((v) => v.cpu)} />
              <MetricBar label="memory (mean)" value={avg((v) => v.mem)} />
              <MetricBar label="disk (mean)" value={avg((v) => v.disk)} />
            </div>
          </Panel>

          <Panel title="Firing alerts">
            {(alerts.data ?? []).length === 0 ? (
              <EmptyState title="No firing alerts" hint="Availability and saturation rules are evaluated on every heartbeat." />
            ) : (
              <ul className="divide-y divide-border">
                {(alerts.data ?? []).map((a) => (
                  <li key={a.id} className="space-y-1 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <SeverityBadge severity={a.severity} />
                      <span className="mono-num text-[11px] text-muted-foreground">{relativeTime(a.started_at)}</span>
                    </div>
                    <p className="text-[12.5px]">{a.summary}</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Recent commands">
            {(commands.data ?? []).length === 0 ? (
              <EmptyState title="No commands issued" hint="Only allow-listed operations can be queued against a node." />
            ) : (
              <ul className="divide-y divide-border">
                {(commands.data ?? []).map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <span className="font-mono text-[12px]">{c.action}</span>
                    <CommandStatusBadge status={c.status} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
