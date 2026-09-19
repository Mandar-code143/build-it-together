import { useState } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Console } from "@/components/console/AuthGate";
import {
  PageHeader,
  Panel,
  MetricBar,
  StatTile,
  EmptyState,
  ErrorState,
  TableSkeleton,
  CodeBlock,
  btnClass,
  btnPrimaryClass,
  btnDangerClass,
  inputClass,
} from "@/components/console/Primitives";
import { NodeStatusBadge, CommandStatusBadge } from "@/components/console/StatusBadge";
import { useCanOperate, useSession } from "@/hooks/useSession";
import {
  effectiveStatus,
  relativeTime,
  exactTime,
  formatBytes,
  formatUptime,
  COMMAND_CATALOGUE,
  NODE_STATUS_META,
} from "@/lib/fleet";
import type { NodeRow, HeartbeatRow, CommandRow } from "@/lib/fleet";

export const Route = createFileRoute("/nodes/$nodeId")({
  head: () => ({
    meta: [
      { title: "Node detail — FleetOps" },
      { name: "description", content: "Live telemetry, agent facts, command history and controlled remote actions for one node." },
      { property: "og:title", content: "Node detail — FleetOps" },
      { property: "og:description", content: "Live telemetry, agent facts, command history and controlled remote actions for one node." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <Console>
      <NodeDetail />
    </Console>
  ),
});

function NodeDetail() {
  const { nodeId } = useParams({ from: "/nodes/$nodeId" });
  const canOperate = useCanOperate();
  const { user } = useSession();
  const qc = useQueryClient();

  const node = useQuery({
    queryKey: ["node", nodeId],
    refetchInterval: 8000,
    queryFn: async () => {
      const { data, error } = await supabase.from("nodes").select("*").eq("id", nodeId).maybeSingle();
      if (error) throw error;
      return data as NodeRow | null;
    },
  });

  const beats = useQuery({
    queryKey: ["heartbeats", nodeId],
    refetchInterval: 8000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("heartbeats")
        .select("*")
        .eq("node_id", nodeId)
        .order("received_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return (data ?? []) as HeartbeatRow[];
    },
  });

  const commands = useQuery({
    queryKey: ["node-commands", nodeId],
    refetchInterval: 5000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commands")
        .select("*")
        .eq("node_id", nodeId)
        .order("queued_at", { ascending: false })
        .limit(25);
      if (error) throw error;
      return (data ?? []) as CommandRow[];
    },
  });

  const [action, setAction] = useState(COMMAND_CATALOGUE[0].action);
  const [argUnit, setArgUnit] = useState("");
  const [reason, setReason] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const selected = COMMAND_CATALOGUE.find((c) => c.action === action)!;
  const needsUnit = action.startsWith("service.");
  const n = node.data;

  async function queueCommand(e: React.FormEvent) {
    e.preventDefault();
    if (!n) return;
    setErr(null);
    if (selected.danger && confirmText !== n.hostname) {
      setErr(`Type the hostname "${n.hostname}" to confirm this disruptive operation.`);
      return;
    }
    if (needsUnit && !argUnit.trim()) {
      setErr("A systemd unit name is required for service operations.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.from("commands").insert({
        node_id: n.id,
        action,
        args: needsUnit ? { unit: argUnit.trim() } : {},
        reason: reason.trim() || null,
        idempotency_key: crypto.randomUUID(),
        requested_by: user?.id ?? null,
      });
      if (error) throw error;
      setReason("");
      setConfirmText("");
      setArgUnit("");
      await qc.invalidateQueries({ queryKey: ["node-commands", nodeId] });
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Could not queue the command");
    } finally {
      setBusy(false);
    }
  }

  async function setEnabled(enabled: boolean) {
    if (!n) return;
    await supabase.from("nodes").update({ enabled }).eq("id", n.id);
    await qc.invalidateQueries({ queryKey: ["node", nodeId] });
  }

  if (node.isLoading) return <TableSkeleton rows={8} />;
  if (node.error) return <ErrorState message={(node.error as Error).message} />;
  if (!n)
    return (
      <EmptyState
        title="Node not found"
        hint="It may have been removed from the fleet."
        action={
          <Link to="/nodes" className="text-[12.5px] text-primary underline-offset-2 hover:underline">
            back to nodes →
          </Link>
        }
      />
    );

  const eff = effectiveStatus(n);
  const latest = beats.data?.[0];

  return (
    <>
      <PageHeader
        title={n.hostname}
        subtitle={`${n.display_name ?? "no display name"} · ${n.environment} · enrolled ${exactTime(n.registered_at)}`}
        actions={
          <>
            <NodeStatusBadge status={eff} since={n.last_heartbeat_at} />
            {canOperate &&
              (n.enabled ? (
                <button className={btnClass} onClick={() => setEnabled(false)}>
                  Disable node
                </button>
              ) : (
                <button className={btnPrimaryClass} onClick={() => setEnabled(true)}>
                  Re-enable node
                </button>
              ))}
          </>
        }
      />

      <p className="text-[12.5px] text-muted-foreground">{NODE_STATUS_META[eff].description}.</p>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Uptime" value={formatUptime(latest?.uptime_seconds)} hint={`boot ${exactTime(n.boot_time)}`} />
        <StatTile label="Load 1m" value={latest?.load1 == null ? "—" : latest.load1.toFixed(2)} hint={`5m ${latest?.load5?.toFixed(2) ?? "—"} · 15m ${latest?.load15?.toFixed(2) ?? "—"}`} />
        <StatTile label="Heartbeat every" value={`${n.heartbeat_interval_seconds}s`} hint={`last ${relativeTime(n.last_heartbeat_at)}`} />
        <StatTile label="Samples held" value={String(beats.data?.length ?? 0)} hint="most recent window" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel title="Current saturation" className="p-3">
          <div className="space-y-3">
            <MetricBar label="cpu" value={latest?.cpu_percent} />
            <MetricBar
              label="memory"
              value={latest?.memory_percent}
              detail={`${formatBytes(latest?.memory_used_bytes)} / ${formatBytes(latest?.memory_total_bytes)}`}
            />
            <MetricBar
              label="disk"
              value={latest?.disk_percent}
              detail={`${formatBytes(latest?.disk_used_bytes)} / ${formatBytes(latest?.disk_total_bytes)}`}
            />
            <div className="mono-num text-[11px] text-muted-foreground">
              net rx {formatBytes(latest?.net_rx_bytes)} · tx {formatBytes(latest?.net_tx_bytes)}
            </div>
          </div>
        </Panel>

        <Panel title="Agent facts">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 p-3 text-[12.5px]">
            <Fact k="operating system" v={`${n.os ?? "—"} ${n.os_version ?? ""}`} />
            <Fact k="kernel" v={n.kernel ?? "—"} />
            <Fact k="architecture" v={n.architecture ?? "—"} />
            <Fact k="agent version" v={n.agent_version ?? "—"} />
            <Fact k="protocol" v={n.protocol_version ?? "—"} />
            <Fact k="address" v={n.address ?? "—"} />
            <Fact k="node_exporter" v={`:${n.node_exporter_port}`} />
            <Fact k="fingerprint" v={n.fingerprint ?? "—"} />
          </dl>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <Panel title="Queue a controlled operation">
          {!canOperate ? (
            <EmptyState title="Read-only access" hint="Only operators and admins may queue commands. Ask an admin for the operator role." />
          ) : (
            <form className="space-y-3 p-3" onSubmit={queueCommand}>
              <label className="block space-y-1">
                <span className="label-caps">operation</span>
                <select className={inputClass} value={action} onChange={(e) => setAction(e.target.value)}>
                  {COMMAND_CATALOGUE.map((c) => (
                    <option key={c.action} value={c.action}>
                      {c.label} {c.danger ? "(disruptive)" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <p className="font-mono text-[11.5px] text-muted-foreground">$ {selected.description}</p>

              {needsUnit && (
                <label className="block space-y-1">
                  <span className="label-caps">systemd unit</span>
                  <input className={inputClass} value={argUnit} onChange={(e) => setArgUnit(e.target.value)} placeholder="nginx.service" />
                </label>
              )}

              <label className="block space-y-1">
                <span className="label-caps">reason (recorded in audit log)</span>
                <input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="incident INC-1042 mitigation" />
              </label>

              {selected.danger && (
                <label className="block space-y-1">
                  <span className="label-caps">type “{n.hostname}” to confirm</span>
                  <input className={inputClass} value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
                </label>
              )}

              {err && <p className="rounded-sm border border-crit/40 bg-crit-soft px-2 py-1.5 text-[12px] text-crit">{err}</p>}

              <button className={selected.danger ? btnDangerClass : btnPrimaryClass} disabled={busy}>
                {busy ? "queueing…" : selected.danger ? "Queue disruptive operation" : "Queue operation"}
              </button>
              <p className="text-[11.5px] text-muted-foreground">
                Commands are queued, not pushed: the agent pulls them on its next poll, enforces the allow-list again locally and
                reports the result with a timeout.
              </p>
            </form>
          )}
        </Panel>

        <Panel title="Command history">
          {(commands.data ?? []).length === 0 ? (
            <EmptyState title="Nothing issued yet" hint="Queued operations and their captured output appear here." />
          ) : (
            <ul className="divide-y divide-border">
              {(commands.data ?? []).map((c) => (
                <li key={c.id} className="space-y-1.5 px-3 py-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-[12.5px]">{c.action}</span>
                    <CommandStatusBadge status={c.status} />
                  </div>
                  <div className="mono-num text-[11px] text-muted-foreground">
                    queued {relativeTime(c.queued_at)} · attempt {c.attempt} · timeout {c.timeout_seconds}s
                    {c.exit_code != null && ` · exit ${c.exit_code}`}
                    {c.duration_ms != null && ` · ${c.duration_ms}ms`}
                  </div>
                  {c.reason && <p className="text-[12px] text-muted-foreground">reason: {c.reason}</p>}
                  {(c.stdout || c.stderr || c.error) && (
                    <CodeBlock label="output">{c.stdout || c.stderr || c.error || ""}</CodeBlock>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Heartbeat stream">
        {beats.isLoading ? (
          <TableSkeleton cols={6} />
        ) : (beats.data ?? []).length === 0 ? (
          <EmptyState title="No telemetry received" hint="The agent has not delivered a heartbeat for this node yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="console-table">
              <thead>
                <tr>
                  <th>Received</th>
                  <th>CPU</th>
                  <th>Mem</th>
                  <th>Disk</th>
                  <th>Load 1/5/15</th>
                  <th>Reported health</th>
                </tr>
              </thead>
              <tbody>
                {(beats.data ?? []).map((b) => (
                  <tr key={b.id}>
                    <td className="mono-num text-muted-foreground">{exactTime(b.received_at)}</td>
                    <td className="mono-num">{b.cpu_percent?.toFixed(1) ?? "—"}</td>
                    <td className="mono-num">{b.memory_percent?.toFixed(1) ?? "—"}</td>
                    <td className="mono-num">{b.disk_percent?.toFixed(1) ?? "—"}</td>
                    <td className="mono-num">
                      {b.load1?.toFixed(2) ?? "—"} / {b.load5?.toFixed(2) ?? "—"} / {b.load15?.toFixed(2) ?? "—"}
                    </td>
                    <td className="text-[12px]">{b.reported_health ?? "—"}</td>
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

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div className="min-w-0">
      <dt className="label-caps">{k}</dt>
      <dd className="truncate font-mono text-[12px]" title={v}>
        {v}
      </dd>
    </div>
  );
}
