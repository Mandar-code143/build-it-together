import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Console } from "@/components/console/AuthGate";
import { PageHeader, Panel, EmptyState, ErrorState, TableSkeleton, btnClass, inputClass } from "@/components/console/Primitives";
import { SeverityBadge } from "@/components/console/StatusBadge";
import { useCanOperate, useSession } from "@/hooks/useSession";
import { relativeTime, exactTime } from "@/lib/fleet";
import type { AlertRow, NodeRow } from "@/lib/fleet";

export const Route = createFileRoute("/alerts")({
  head: () => ({
    meta: [
      { title: "Alerts — FleetOps" },
      { name: "description", content: "Availability and saturation alerts raised by the control plane, with acknowledgement trail." },
      { property: "og:title", content: "Alerts — FleetOps" },
      { property: "og:description", content: "Availability and saturation alerts raised by the control plane, with acknowledgement trail." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <Console>
      <AlertsPage />
    </Console>
  ),
});

function AlertsPage() {
  const [state, setState] = useState<"firing" | "resolved" | "all">("firing");
  const canOperate = useCanOperate();
  const { user } = useSession();
  const qc = useQueryClient();

  const nodes = useQuery({
    queryKey: ["nodes-lite"],
    queryFn: async () => {
      const { data, error } = await supabase.from("nodes").select("id,hostname");
      if (error) throw error;
      return (data ?? []) as Pick<NodeRow, "id" | "hostname">[];
    },
  });

  const alerts = useQuery({
    queryKey: ["alerts", state],
    refetchInterval: 10000,
    queryFn: async () => {
      let q = supabase.from("alerts").select("*").order("started_at", { ascending: false }).limit(200);
      if (state !== "all") q = q.eq("state", state);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as AlertRow[];
    },
  });

  async function acknowledge(id: string) {
    await supabase
      .from("alerts")
      .update({ acknowledged_at: new Date().toISOString(), acknowledged_by: user?.id ?? null })
      .eq("id", id);
    await qc.invalidateQueries({ queryKey: ["alerts", state] });
  }

  const rows = alerts.data ?? [];
  const hostOf = (id: string | null) => (id ? nodes.data?.find((n) => n.id === id)?.hostname ?? id.slice(0, 8) : "fleet");

  return (
    <>
      <PageHeader
        title="Alerts"
        subtitle="Raised when heartbeats lapse or saturation crosses threshold; auto-resolved on recovery."
        actions={
          <select
            className={`${inputClass} w-40`}
            value={state}
            onChange={(e) => setState(e.target.value as typeof state)}
            aria-label="Filter alerts"
          >
            <option value="firing">firing</option>
            <option value="resolved">resolved</option>
            <option value="all">all</option>
          </select>
        }
      />

      <Panel title={`Alerts · ${rows.length}`}>
        {alerts.isLoading ? (
          <TableSkeleton cols={5} />
        ) : alerts.error ? (
          <ErrorState message={(alerts.error as Error).message} />
        ) : rows.length === 0 ? (
          <EmptyState title="Nothing to escalate" hint="Fleet is healthy for the selected filter." />
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((a) => (
              <li key={a.id} className="flex flex-wrap items-start justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <SeverityBadge severity={a.severity} />
                    <span className="font-mono text-[11.5px] text-muted-foreground">{a.rule}</span>
                    {a.node_id && (
                      <Link
                        to="/nodes/$nodeId"
                        params={{ nodeId: a.node_id }}
                        className="font-mono text-[12px] text-primary underline-offset-2 hover:underline"
                      >
                        {hostOf(a.node_id)}
                      </Link>
                    )}
                  </div>
                  <p className="text-[12.5px]">{a.summary}</p>
                  {a.detail && <p className="text-[11.5px] text-muted-foreground">{a.detail}</p>}
                  <p className="mono-num text-[11px] text-muted-foreground">
                    started {exactTime(a.started_at)} ({relativeTime(a.started_at)})
                    {a.resolved_at && ` · resolved ${relativeTime(a.resolved_at)}`}
                    {a.acknowledged_at && ` · acknowledged ${relativeTime(a.acknowledged_at)}`}
                  </p>
                </div>
                {canOperate && a.state === "firing" && !a.acknowledged_at && (
                  <button className={btnClass} onClick={() => acknowledge(a.id)}>
                    Acknowledge
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
