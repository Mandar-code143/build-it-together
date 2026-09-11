import type { Database } from "@/integrations/supabase/types";

export type NodeRow = Database["public"]["Tables"]["nodes"]["Row"];
export type CommandRow = Database["public"]["Tables"]["commands"]["Row"];
export type HeartbeatRow = Database["public"]["Tables"]["heartbeats"]["Row"];
export type AlertRow = Database["public"]["Tables"]["alerts"]["Row"];
export type AuditRow = Database["public"]["Tables"]["audit_logs"]["Row"];
export type GroupRow = Database["public"]["Tables"]["node_groups"]["Row"];
export type NodeStatus = Database["public"]["Enums"]["node_status"];
export type CommandStatus = Database["public"]["Enums"]["command_status"];
export type AppRole = Database["public"]["Enums"]["app_role"];

/** Availability state machine, derived on read from heartbeat freshness. */
export const NODE_STATUS_META: Record<
  NodeStatus,
  { label: string; tone: "ok" | "warn" | "crit" | "info" | "idle"; glyph: string; description: string }
> = {
  online: { label: "Online", tone: "ok", glyph: "\u25CF", description: "Healthy and communicating" },
  degraded: { label: "Degraded", tone: "warn", glyph: "\u25D0", description: "Reachable, subsystem unhealthy" },
  offline: { label: "Offline", tone: "crit", glyph: "\u2715", description: "No heartbeat past threshold" },
  recovering: { label: "Recovering", tone: "info", glyph: "\u21BB", description: "Communication restored, stabilising" },
  enrolling: { label: "Enrolling", tone: "info", glyph: "\u25CC", description: "Onboarding in progress" },
  unknown: { label: "Unknown", tone: "idle", glyph: "?", description: "Insufficient information" },
  disabled: { label: "Disabled", tone: "idle", glyph: "\u2296", description: "Excluded from the fleet" },
};

export const COMMAND_STATUS_META: Record<
  CommandStatus,
  { label: string; tone: "ok" | "warn" | "crit" | "info" | "idle" }
> = {
  queued: { label: "Queued", tone: "idle" },
  dispatched: { label: "Dispatched", tone: "info" },
  running: { label: "Running", tone: "info" },
  succeeded: { label: "Succeeded", tone: "ok" },
  failed: { label: "Failed", tone: "crit" },
  timed_out: { label: "Timed out", tone: "warn" },
  cancelled: { label: "Cancelled", tone: "idle" },
  rejected: { label: "Rejected", tone: "warn" },
};

/**
 * Effective availability. Durable status lives in the database, but the UI must
 * not show a stale "online" node between availability sweeps, so freshness is
 * re-evaluated client-side using the same thresholds the control plane uses.
 */
export function effectiveStatus(node: Pick<NodeRow, "status" | "last_heartbeat_at" | "heartbeat_interval_seconds" | "enabled">): NodeStatus {
  if (!node.enabled) return "disabled";
  if (node.status === "enrolling") return "enrolling";
  const interval = Math.max(node.heartbeat_interval_seconds ?? 15, 5);
  if (!node.last_heartbeat_at) return node.status === "online" ? "unknown" : node.status;
  const age = (Date.now() - new Date(node.last_heartbeat_at).getTime()) / 1000;
  if (age > interval * 4) return "offline";
  if (age > interval * 2 && node.status === "online") return "degraded";
  return node.status;
}

export function heartbeatAgeSeconds(iso: string | null): number | null {
  if (!iso) return null;
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "never";
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 0) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function exactTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC");
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) return "—";
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatUptime(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function pct(value: number | null | undefined): string {
  return value == null ? "—" : `${Number(value).toFixed(1)}%`;
}

/** Command catalogue: only allow-listed, non-interactive operations may be queued. */
export const COMMAND_CATALOGUE = [
  { action: "system.uptime", label: "Read uptime", danger: false, description: "uptime -p" },
  { action: "system.disk_usage", label: "Disk usage", danger: false, description: "df -h" },
  { action: "system.memory", label: "Memory report", danger: false, description: "free -m" },
  { action: "system.top_processes", label: "Top processes", danger: false, description: "ps aux --sort=-%cpu | head" },
  { action: "service.status", label: "Service status", danger: false, description: "systemctl status <unit>" },
  { action: "service.restart", label: "Restart service", danger: true, description: "systemctl restart <unit>" },
  { action: "agent.collect_facts", label: "Re-collect facts", danger: false, description: "Refresh node inventory" },
  { action: "node_exporter.restart", label: "Restart node_exporter", danger: true, description: "systemctl restart node_exporter" },
  { action: "system.reboot", label: "Reboot host", danger: true, description: "systemctl reboot" },
] as const;

export function toneClasses(tone: "ok" | "warn" | "crit" | "info" | "idle") {
  switch (tone) {
    case "ok":
      return { text: "text-ok", bg: "bg-ok-soft", border: "border-ok/30", bar: "bg-ok" };
    case "warn":
      return { text: "text-warn", bg: "bg-warn-soft", border: "border-warn/30", bar: "bg-warn" };
    case "crit":
      return { text: "text-crit", bg: "bg-crit-soft", border: "border-crit/30", bar: "bg-crit" };
    case "info":
      return { text: "text-info", bg: "bg-info-soft", border: "border-info/30", bar: "bg-info" };
    default:
      return { text: "text-idle", bg: "bg-idle-soft", border: "border-idle/30", bar: "bg-idle" };
  }
}

export function utilisationTone(value: number | null | undefined): "ok" | "warn" | "crit" | "idle" {
  if (value == null) return "idle";
  if (value >= 90) return "crit";
  if (value >= 75) return "warn";
  return "ok";
}
