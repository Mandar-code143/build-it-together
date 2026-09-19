import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Console } from "@/components/console/AuthGate";
import { PageHeader, Panel, EmptyState, ErrorState, TableSkeleton, inputClass } from "@/components/console/Primitives";
import { NodeStatusBadge } from "@/components/console/StatusBadge";
import { effectiveStatus, relativeTime, NODE_STATUS_META } from "@/lib/fleet";
import type { NodeRow, NodeStatus } from "@/lib/fleet";

export const Route = createFileRoute("/nodes/")({
  head: () => ({
    meta: [
      { title: "Nodes — FleetOps" },
      { name: "description", content: "Inventory of every enrolled Linux node with live availability and agent facts." },
      { property: "og:title", content: "Nodes — FleetOps" },
      { property: "og:description", content: "Inventory of every enrolled Linux node with live availability and agent facts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <Console>
      <NodesPage />
    </Console>
  ),
});

function NodesPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | NodeStatus>("all");

  const nodes = useQuery({
    queryKey: ["nodes"],
    refetchInterval: 10000,
    queryFn: async () => {
      const { data, error } = await supabase.from("nodes").select("*").order("hostname");
      if (error) throw error;
      return (data ?? []) as NodeRow[];
    },
  });

  const rows = (nodes.data ?? []).filter((n) => {
    const eff = effectiveStatus(n);
    if (status !== "all" && eff !== status) return false;
    if (!q) return true;
    const needle = q.toLowerCase();
    return (
      n.hostname.toLowerCase().includes(needle) ||
      (n.display_name ?? "").toLowerCase().includes(needle) ||
      (n.address ?? "").toLowerCase().includes(needle) ||
      n.environment.toLowerCase().includes(needle)
    );
  });

  return (
    <>
      <PageHeader
        title="Nodes"
        subtitle="Every enrolled host, its reported facts and derived availability."
        actions={
          <>
            <input
              className={`${inputClass} w-56`}
              placeholder="filter host / env / address"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Filter nodes"
            />
            <select
              className={`${inputClass} w-40`}
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
              aria-label="Filter by status"
            >
              <option value="all">all statuses</option>
              {Object.entries(NODE_STATUS_META).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label.toLowerCase()}
                </option>
              ))}
            </select>
          </>
        }
      />

      <Panel title={`Inventory · ${rows.length}`}>
        {nodes.isLoading ? (
          <TableSkeleton cols={6} />
        ) : nodes.error ? (
          <ErrorState message={(nodes.error as Error).message} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No nodes match"
            hint="Enroll a host with the installer, or relax the filters above."
            action={
              <Link to="/settings" className="text-[12.5px] text-primary underline-offset-2 hover:underline">
                issue enrollment token →
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
                  <th>OS / kernel</th>
                  <th>Agent</th>
                  <th>Address</th>
                  <th>Heartbeat</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((n) => (
                  <tr key={n.id}>
                    <td>
                      <Link
                        to="/nodes/$nodeId"
                        params={{ nodeId: n.id }}
                        className="font-mono text-[12.5px] text-primary underline-offset-2 hover:underline"
                      >
                        {n.hostname}
                      </Link>
                      <div className="text-[11px] text-muted-foreground">
                        {n.display_name ?? "—"} · {n.environment}
                      </div>
                    </td>
                    <td>
                      <NodeStatusBadge status={effectiveStatus(n)} since={n.last_heartbeat_at} compact />
                    </td>
                    <td className="text-[12px]">
                      {n.os ?? "—"} {n.os_version ?? ""}
                      <div className="font-mono text-[11px] text-muted-foreground">{n.kernel ?? "—"}</div>
                    </td>
                    <td className="mono-num">{n.agent_version ?? "—"}</td>
                    <td className="mono-num text-muted-foreground">{n.address ?? "—"}</td>
                    <td className="mono-num text-muted-foreground">{relativeTime(n.last_heartbeat_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
