import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Console } from "@/components/console/AuthGate";
import { PageHeader, Panel, EmptyState, ErrorState, TableSkeleton, CodeBlock, inputClass } from "@/components/console/Primitives";
import { CommandStatusBadge } from "@/components/console/StatusBadge";
import { COMMAND_STATUS_META, relativeTime, exactTime } from "@/lib/fleet";
import type { CommandRow, CommandStatus, NodeRow } from "@/lib/fleet";

export const Route = createFileRoute("/commands")({
  head: () => ({
    meta: [
      { title: "Commands — FleetOps" },
      { name: "description", content: "Queue, track and audit allow-listed remote operations across the Linux fleet." },
      { property: "og:title", content: "Commands — FleetOps" },
      { property: "og:description", content: "Queue, track and audit allow-listed remote operations across the Linux fleet." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <Console>
      <CommandsPage />
    </Console>
  ),
});

function CommandsPage() {
  const [status, setStatus] = useState<"all" | CommandStatus>("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const nodes = useQuery({
    queryKey: ["nodes-lite"],
    queryFn: async () => {
      const { data, error } = await supabase.from("nodes").select("id,hostname");
      if (error) throw error;
      return (data ?? []) as Pick<NodeRow, "id" | "hostname">[];
    },
  });

  const commands = useQuery({
    queryKey: ["commands", status],
    refetchInterval: 5000,
    queryFn: async () => {
      let q = supabase.from("commands").select("*").order("queued_at", { ascending: false }).limit(200);
      if (status !== "all") q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as CommandRow[];
    },
  });

  const hostOf = (id: string) => nodes.data?.find((n) => n.id === id)?.hostname ?? id.slice(0, 8);
  const rows = commands.data ?? [];

  return (
    <>
      <PageHeader
        title="Commands"
        subtitle="Every operation is allow-listed, idempotency-keyed, timeout-bounded and attributed to an operator."
        actions={
          <select
            className={`${inputClass} w-44`}
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
            aria-label="Filter by command status"
          >
            <option value="all">all statuses</option>
            {Object.entries(COMMAND_STATUS_META).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label.toLowerCase()}
              </option>
            ))}
          </select>
        }
      />

      <Panel title={`Operations · ${rows.length}`} right={<span className="mono-num text-[11px] text-muted-foreground">auto-refresh 5s</span>}>
        {commands.isLoading ? (
          <TableSkeleton cols={6} />
        ) : commands.error ? (
          <ErrorState message={(commands.error as Error).message} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No commands recorded"
            hint="Open a node and queue an allow-listed operation; results stream back here."
            action={
              <Link to="/nodes" className="text-[12.5px] text-primary underline-offset-2 hover:underline">
                choose a node →
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="console-table">
              <thead>
                <tr>
                  <th>Queued</th>
                  <th>Node</th>
                  <th>Action</th>
                  <th>Status</th>
                  <th>Exit</th>
                  <th>Duration</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <>
                    <tr key={c.id}>
                      <td className="mono-num text-muted-foreground" title={exactTime(c.queued_at)}>
                        {relativeTime(c.queued_at)}
                      </td>
                      <td>
                        <Link
                          to="/nodes/$nodeId"
                          params={{ nodeId: c.node_id }}
                          className="font-mono text-[12.5px] text-primary underline-offset-2 hover:underline"
                        >
                          {hostOf(c.node_id)}
                        </Link>
                      </td>
                      <td className="font-mono text-[12.5px]">{c.action}</td>
                      <td>
                        <CommandStatusBadge status={c.status} />
                      </td>
                      <td className="mono-num">{c.exit_code ?? "—"}</td>
                      <td className="mono-num">{c.duration_ms == null ? "—" : `${c.duration_ms}ms`}</td>
                      <td>
                        <button
                          className="text-[11.5px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                          onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                        >
                          {expanded === c.id ? "hide" : "detail"}
                        </button>
                      </td>
                    </tr>
                    {expanded === c.id && (
                      <tr key={`${c.id}-d`}>
                        <td colSpan={7} className="bg-rail/60">
                          <div className="space-y-2 p-3">
                            <div className="mono-num text-[11.5px] text-muted-foreground">
                              id {c.id} · idempotency {c.idempotency_key} · timeout {c.timeout_seconds}s · attempt {c.attempt}
                              {c.dispatched_at && ` · dispatched ${exactTime(c.dispatched_at)}`}
                              {c.finished_at && ` · finished ${exactTime(c.finished_at)}`}
                            </div>
                            {c.reason && <p className="text-[12px]">reason: {c.reason}</p>}
                            {c.stdout && <CodeBlock label="stdout">{c.stdout}</CodeBlock>}
                            {c.stderr && <CodeBlock label="stderr">{c.stderr}</CodeBlock>}
                            {c.error && <CodeBlock label="error">{c.error}</CodeBlock>}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
